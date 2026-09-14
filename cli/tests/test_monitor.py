"""monitor_client: the three requests, the notification decoder, index resolution."""
import pytest

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path
import studio_pb2
import custom_pb2
from zmk_runtime_cli import monitor_client as mc
from zmk_runtime_cli.framing import encode_frame
from zmk_runtime_cli.proto.zmk.monitor import monitor_pb2 as mon_pb2

from test_ui_native_client import FakeSerial


def _subsystems(*names: str) -> bytes:
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    resp = custom_pb2.ListCustomSubsystemResponse()
    for i, name in enumerate(names):
        sub = resp.subsystems.add()
        sub.identifier = name
        sub.index = i
    s.request_response.custom.list_custom_subsystems.CopyFrom(resp)
    return encode_frame(s.SerializeToString())


def _call(payload: bytes) -> bytes:
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    s.request_response.custom.call.payload = payload
    return encode_frame(s.SerializeToString())


def _ok(ok=True) -> bytes:
    r = mon_pb2.Response()
    r.ok.ok = ok
    return _call(r.SerializeToString())


def _layers(mask: int, highest: int) -> bytes:
    r = mon_pb2.Response()
    r.layers.mask = mask
    r.layers.highest = highest
    return _call(r.SerializeToString())


# ---- pure builders / decoders ---------------------------------------------
def test_request_builders_select_the_right_oneof():
    assert mc.build_get_layers_request().WhichOneof("request_type") == "get_layers"
    assert mc.build_enable_request().WhichOneof("request_type") == "enable"
    assert mc.build_disable_request().WhichOneof("request_type") == "disable"


def test_layer_ids_reads_the_mask_as_ids():
    assert mc.layer_ids(0b101) == [0, 2]
    assert mc.layer_ids(0) == []
    assert mc.layer_ids(1 << 31) == [31]


def test_decode_key_notification():
    n = mon_pb2.Notification()
    n.key.position = 42
    n.key.pressed = True
    n.key.source = 255  # ZMK_POSITION_STATE_CHANGE_SOURCE_LOCAL
    assert mc.decode_notification(n.SerializeToString()) == {
        "type": "key", "position": 42, "pressed": True, "source": 255}


def test_decode_key_release_from_a_peripheral():
    n = mon_pb2.Notification()
    n.key.position = 3
    n.key.pressed = False
    n.key.source = 1
    assert mc.decode_notification(n.SerializeToString()) == {
        "type": "key", "position": 3, "pressed": False, "source": 1}


def test_decode_layers_notification_expands_the_mask():
    n = mon_pb2.Notification()
    n.layers.mask = 0b1011
    n.layers.highest = 3
    assert mc.decode_notification(n.SerializeToString()) == {
        "type": "layers", "mask": 0b1011, "highest": 3, "ids": [0, 1, 3]}


def test_decode_keycode_notification_keeps_the_modifier_bitmask():
    n = mon_pb2.Notification()
    n.keycode.usage_page = 0x07
    n.keycode.keycode = 0x1D  # Z
    n.keycode.pressed = True
    n.keycode.modifiers = 0x02  # LSHIFT
    assert mc.decode_notification(n.SerializeToString()) == {
        "type": "keycode", "usage_page": 0x07, "keycode": 0x1D,
        "pressed": True, "modifiers": 0x02}


def test_decode_empty_notification_is_dropped():
    assert mc.decode_notification(mon_pb2.Notification().SerializeToString()) is None
    assert mc.decode_notification(b"") is None


# ---- the thin client ------------------------------------------------------
def test_resolve_index_finds_the_subsystem_among_others():
    ser = FakeSerial([_subsystems("cormoran_rip", "zmk__holdtap", "zmk__monitor")])
    assert mc.MonitorClient(_ser=ser).resolve_index() == 2


def test_resolve_index_raises_on_firmware_without_the_subsystem():
    ser = FakeSerial([_subsystems("cormoran_rip", "zmk__holdtap")])
    with pytest.raises(RuntimeError, match="zmk__monitor"):
        mc.MonitorClient(_ser=ser).resolve_index()


def test_enable_and_disable_report_ok():
    ser = FakeSerial([_subsystems("zmk__monitor"), _ok(True)])
    assert mc.MonitorClient(_ser=ser).enable() is True
    ser = FakeSerial([_subsystems("zmk__monitor"), _ok(True)])
    assert mc.MonitorClient(_ser=ser).disable() is True


def test_get_layers_returns_mask_highest_and_ids():
    ser = FakeSerial([_subsystems("zmk__monitor"), _layers(0b101, 2)])
    assert mc.MonitorClient(_ser=ser).get_layers() == {
        "type": "layers", "mask": 0b101, "highest": 2, "ids": [0, 2]}
