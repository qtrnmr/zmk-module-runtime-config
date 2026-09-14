"""MonitorClient: the live key / layer / keycode stream over `zmk__monitor`.

Same 2-step custom envelope as HoldtapClient: list_custom_subsystems ->
resolve "zmk__monitor" index -> call(payload=monitor.Request). Unlike the other
clients, most of what this subsystem produces does not come back as a response
at all: once `enable()` is sent the firmware pushes custom *notifications*
until `disable()`. Reading them is the job of `ui.mux_serial.MuxSerial`; this
module only builds the three requests and provides the pure
`decode_notification()` that turns one notification payload into a dict.
"""
from __future__ import annotations

import serial

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path
import studio_pb2
import custom_pb2
from zmk_runtime_cli.proto.zmk.monitor import monitor_pb2 as mon_pb2

from . import rpc

SUBSYSTEM_ID = "zmk__monitor"


def layer_ids(mask: int) -> list[int]:
    """Layer *ids* set in a zmk_keymap_layer_state() bitmask, ascending."""
    return [i for i in range(32) if mask & (1 << i)]


def build_get_layers_request() -> "mon_pb2.Request":
    req = mon_pb2.Request()
    req.get_layers.SetInParent()
    return req


def build_enable_request() -> "mon_pb2.Request":
    req = mon_pb2.Request()
    req.enable.SetInParent()
    return req


def build_disable_request() -> "mon_pb2.Request":
    req = mon_pb2.Request()
    req.disable.SetInParent()
    return req


def layers_to_dict(layers: "mon_pb2.LayerState") -> dict:
    return {
        "type": "layers",
        "mask": layers.mask,
        "highest": layers.highest,
        "ids": layer_ids(layers.mask),
    }


def decode_notification(payload: bytes) -> dict | None:
    """One zmk.monitor.Notification payload -> a JSON-ready dict.

    Returns None for a payload that is not a monitor notification (an empty
    oneof, or bytes from another subsystem that reached us by mistake), so the
    caller can drop it instead of forwarding a meaningless event.
    """
    note = mon_pb2.Notification()
    try:
        note.ParseFromString(payload)
    except Exception:  # noqa: BLE001  a foreign payload is not an error here
        return None
    which = note.WhichOneof("type")
    if which == "key":
        return {
            "type": "key",
            "position": note.key.position,
            "pressed": bool(note.key.pressed),
            "source": note.key.source,
        }
    if which == "layers":
        return layers_to_dict(note.layers)
    if which == "keycode":
        return {
            "type": "keycode",
            "usage_page": note.keycode.usage_page,
            "keycode": note.keycode.keycode,
            "pressed": bool(note.keycode.pressed),
            "modifiers": note.keycode.modifiers,
        }
    return None


class MonitorClient:
    def __init__(self, port: str | None = None, baud: int = rpc.DEFAULT_BAUD, _ser=None):
        if _ser is not None:
            self._ser = _ser
        else:
            self._ser = serial.Serial(port or rpc.find_port(), baud, timeout=0.1)
        self._index: int | None = None
        self._rid = 0

    def close(self) -> None:
        self._ser.close()

    def __enter__(self) -> "MonitorClient":
        return self

    def __exit__(self, *_) -> None:
        self.close()

    def _next_rid(self) -> int:
        self._rid += 1
        return self._rid

    def resolve_index(self) -> int:
        """Index of `zmk__monitor` in list_custom_subsystems.

        Raises RuntimeError on firmware built without CONFIG_ZMK_RUNTIME_MONITOR
        — that is the `unavailable` path the UI reports to the browser.
        """
        if self._index is not None:
            return self._index
        req = studio_pb2.Request()
        req.request_id = self._next_rid()
        req.custom.list_custom_subsystems.CopyFrom(custom_pb2.ListCustomSubsystemRequest())
        resp = rpc.send_recv(self._ser, req)
        css = resp.request_response.custom.list_custom_subsystems
        for sub in css.subsystems:
            if sub.identifier == SUBSYSTEM_ID:
                self._index = sub.index
                return sub.index
        raise RuntimeError(
            f"'{SUBSYSTEM_ID}' subsystem not found. "
            f"Available: {[(s.identifier, s.index) for s in css.subsystems]}"
        )

    # kept for symmetry with the other clients, which spell it with a leading _
    _resolve_index = resolve_index

    def _call(self, mon_req: "mon_pb2.Request") -> "mon_pb2.Response":
        idx = self.resolve_index()
        sreq = studio_pb2.Request()
        sreq.request_id = self._next_rid()
        sreq.custom.call.subsystem_index = idx
        sreq.custom.call.payload = mon_req.SerializeToString()
        sresp = rpc.send_recv(self._ser, sreq)
        mon_resp = mon_pb2.Response()
        mon_resp.ParseFromString(sresp.request_response.custom.call.payload)
        return mon_resp

    def enable(self) -> bool:
        return bool(self._call(build_enable_request()).ok.ok)

    def disable(self) -> bool:
        return bool(self._call(build_disable_request()).ok.ok)

    def get_layers(self) -> dict:
        return layers_to_dict(self._call(build_get_layers_request()).layers)
