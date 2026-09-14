"""MuxSerial: the monitor stream is split off; everything else is untouched.

The whole point of the wrapper is that `rpc.send_recv` and RipClient's raw
read loop keep seeing the bytes they see today, so most of these tests assert
about what *still* works rather than about the new feature.
"""
import queue
import time

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path
import studio_pb2
import custom_pb2
from zmk_runtime_cli import rpc
from zmk_runtime_cli.framing import encode_frame, decode_frame
from zmk_runtime_cli.proto.cormoran.rip import custom_pb2 as rip_pb2
from zmk_runtime_cli.proto.zmk.monitor import monitor_pb2 as mon_pb2
from zmk_runtime_cli.ui.mux_serial import MuxSerial
from zmk_runtime_cli.ui.session import DeviceSession

MONITOR_INDEX = 1
RIP_INDEX = 0


class StreamSerial:
    """A port that hands out a fixed byte stream, a chunk at a time.

    Unlike test_ui_native_client.FakeSerial this is not scripted per write():
    the firmware pushes notifications whenever it likes, so the bytes are
    already there before anyone writes anything.
    """
    timeout = 0.1

    def __init__(self, data: bytes = b""):
        self._buf = bytearray(data)
        self.written: list[bytes] = []
        self.closed = False

    def feed(self, data: bytes) -> None:
        self._buf += data

    def write(self, b):
        self.written.append(bytes(b))
        return len(b)

    def flush(self):
        pass

    def read(self, n=1):
        out = bytes(self._buf[:n])
        del self._buf[:n]
        return out

    def close(self):
        self.closed = True


# ---- frames ---------------------------------------------------------------
def _response_frame(rid=1) -> bytes:
    s = studio_pb2.Response()
    s.request_response.request_id = rid
    s.request_response.custom.call.payload = b"\x01\x02"
    return encode_frame(s.SerializeToString())


def _custom_notification(index: int, payload: bytes) -> bytes:
    s = studio_pb2.Response()
    s.notification.custom.custom_notification.subsystem_index = index
    s.notification.custom.custom_notification.payload = payload
    return encode_frame(s.SerializeToString())


def _rip_frame() -> bytes:
    n = rip_pb2.Notification()
    n.input_processor_changed.processor.id = 3
    return _custom_notification(RIP_INDEX, n.SerializeToString())


def _mon_key(position: int, pressed: bool) -> bytes:
    n = mon_pb2.Notification()
    n.key.position = position
    n.key.pressed = pressed
    n.key.source = 255
    return _custom_notification(MONITOR_INDEX, n.SerializeToString())


def _mon_layers(mask: int, highest: int) -> bytes:
    n = mon_pb2.Notification()
    n.layers.mask = mask
    n.layers.highest = highest
    return _custom_notification(MONITOR_INDEX, n.SerializeToString())


def _drain(mux, deadline=1.0) -> bytes:
    """Read until the wrapper goes quiet, like RipClient._list_processors."""
    out = bytearray()
    end = time.monotonic() + deadline
    idle = 0
    while time.monotonic() < end and idle < 3:
        chunk = mux.read(256)
        if chunk:
            out += chunk
            idle = 0
        else:
            idle += 1
    return bytes(out)


# ---- pass-through ---------------------------------------------------------
def test_without_subscribers_read_and_write_go_straight_through():
    real = StreamSerial(b"hello")
    mux = MuxSerial(real)
    mux.write(b"ping")
    assert real.written == [b"ping"]
    assert mux.read(5) == b"hello"
    assert mux.subscribers == 0


def test_send_recv_still_gets_its_response_past_interleaved_notifications():
    stream = _rip_frame() + _mon_key(7, True) + _response_frame(rid=9) + _mon_layers(0b11, 1)
    mux = MuxSerial(StreamSerial(stream))
    mux.set_monitor_index(MONITOR_INDEX)
    q = mux.subscribe()
    try:
        req = studio_pb2.Request()
        req.request_id = 9
        req.custom.list_custom_subsystems.CopyFrom(custom_pb2.ListCustomSubsystemRequest())
        resp = rpc.send_recv(mux, req, timeout=2.0)
        assert resp.request_response.request_id == 9
        assert q.get(timeout=1.0) == {
            "type": "key", "position": 7, "pressed": True, "source": 255}
        assert q.get(timeout=1.0) == {
            "type": "layers", "mask": 0b11, "highest": 1, "ids": [0, 1]}
    finally:
        mux.unsubscribe(q)


def test_a_foreign_notification_reaches_read_as_the_original_frame_bytes():
    rip = _rip_frame()
    mux = MuxSerial(StreamSerial(_mon_key(1, True) + rip + _mon_key(1, False)))
    mux.set_monitor_index(MONITOR_INDEX)
    q = mux.subscribe()
    try:
        assert _drain(mux) == rip  # byte for byte, and nothing of the monitor's
        assert q.get(timeout=1.0)["position"] == 1
        assert q.get(timeout=1.0)["pressed"] is False
    finally:
        mux.unsubscribe(q)
    # and the frame still parses the way RipClient parses it
    note = studio_pb2.Response()
    note.ParseFromString(decode_frame(rip))
    parsed = rip_pb2.Notification()
    parsed.ParseFromString(note.notification.custom.custom_notification.payload)
    assert parsed.input_processor_changed.processor.id == 3


def test_before_set_monitor_index_nothing_is_intercepted():
    key = _mon_key(4, True)
    mux = MuxSerial(StreamSerial(key))
    q = mux.subscribe()  # subscribed, but the index is still unknown
    try:
        assert _drain(mux) == key
        assert q.qsize() == 0
    finally:
        mux.unsubscribe(q)


def test_every_subscriber_sees_every_event():
    mux = MuxSerial(StreamSerial(b""))
    mux.set_monitor_index(MONITOR_INDEX)
    a, b = mux.subscribe(), mux.subscribe()
    try:
        mux._real.feed(_mon_key(2, True))
        assert a.get(timeout=1.0)["position"] == 2
        assert b.get(timeout=1.0)["position"] == 2
    finally:
        mux.unsubscribe(a)
        mux.unsubscribe(b)


# ---- thread lifecycle -----------------------------------------------------
def test_the_reader_stops_with_the_last_subscriber():
    mux = MuxSerial(StreamSerial(b""))
    a, b = mux.subscribe(), mux.subscribe()
    assert mux._running is True
    mux.unsubscribe(a)
    assert mux._running is True
    mux.unsubscribe(b)
    assert mux._running is False
    assert mux._thread is None


def test_a_half_read_frame_is_handed_back_to_read_when_the_reader_stops():
    frame = _response_frame(rid=5)
    mux = MuxSerial(StreamSerial(frame[:-1]))  # no EOF yet
    q = mux.subscribe()
    time.sleep(0.05)
    mux.unsubscribe(q)
    mux._real.feed(frame[-1:])
    assert _drain(mux) == frame


def test_a_dead_port_calls_back_and_stops_the_reader():
    class Dying(StreamSerial):
        def read(self, n=1):
            raise OSError("device disconnected")

    seen = []
    mux = MuxSerial(Dying(), on_error=lambda: seen.append(True))
    q = mux.subscribe()
    for _ in range(100):
        if mux.error:
            break
        time.sleep(0.01)
    assert mux.error is True
    assert seen == [True]
    assert mux._running is False
    mux.unsubscribe(q)


# ---- session wiring -------------------------------------------------------
def test_session_wraps_an_injected_handle_once():
    real = StreamSerial(b"")
    session = DeviceSession(_ser=real)
    first = session.serial
    assert isinstance(first, MuxSerial)
    assert session.serial is first  # not wrapped again on every access


def test_ensure_monitor_index_resolves_once_and_tells_the_mux():
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    listing = custom_pb2.ListCustomSubsystemResponse()
    for i, name in enumerate(["cormoran_rip", "zmk__monitor"]):
        sub = listing.subsystems.add()
        sub.identifier, sub.index = name, i
    s.request_response.custom.list_custom_subsystems.CopyFrom(listing)

    session = DeviceSession(_ser=StreamSerial(encode_frame(s.SerializeToString())))
    assert session.ensure_monitor_index() is True
    assert session.serial.monitor_index == 1
    # second call must not need another frame on the wire
    assert session.ensure_monitor_index() is True


def test_ensure_monitor_index_is_false_on_firmware_without_the_subsystem():
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    listing = custom_pb2.ListCustomSubsystemResponse()
    sub = listing.subsystems.add()
    sub.identifier, sub.index = "cormoran_rip", 0
    s.request_response.custom.list_custom_subsystems.CopyFrom(listing)

    session = DeviceSession(_ser=StreamSerial(encode_frame(s.SerializeToString())))
    assert session.ensure_monitor_index() is False
    assert session.serial.monitor_index is None
