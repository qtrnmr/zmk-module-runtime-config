"""Studio *native* RPCs (core / keymap / behaviors) over the shared pyserial handle.

Pure request builders + response decoders (unit-tested) and a thin NativeClient that
uses rpc.send_recv. Mirrors keymap_client.py; used by the UI server so that every RPC
goes through ONE serial handle (never zmk_studio_api.StudioClient).
"""
from __future__ import annotations

from typing import Callable

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path
import studio_pb2
import keymap_pb2
import behaviors_pb2
import core_pb2
import meta_pb2

from .. import rpc
from ..keymap_client import decode_status, req_save_changes


class RpcError(RuntimeError):
    """Raised when the device answers with meta.simple_error (e.g. UNLOCK_REQUIRED)."""


def _req(rid: int) -> "studio_pb2.Request":
    r = studio_pb2.Request()
    r.request_id = rid
    return r


def req_get_device_info(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.core.get_device_info = True
    return r


def req_get_lock_state(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.core.get_lock_state = True
    return r


def req_reset_settings(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.core.reset_settings = True
    return r


def req_get_keymap(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.keymap.get_keymap = True
    return r


def req_get_physical_layouts(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.keymap.get_physical_layouts = True
    return r


def req_list_behaviors(rid: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.behaviors.list_all_behaviors = True
    return r


def req_behavior_details(rid: int, behavior_id: int) -> "studio_pb2.Request":
    r = _req(rid)
    r.behaviors.get_behavior_details.behavior_id = behavior_id
    return r


def req_set_layer_binding(rid: int, layer_id: int, position: int,
                          behavior_id: int, param1: int, param2: int) -> "studio_pb2.Request":
    r = _req(rid)
    s = r.keymap.set_layer_binding
    s.layer_id = layer_id
    s.key_position = position
    s.binding.behavior_id = behavior_id
    s.binding.param1 = param1
    s.binding.param2 = param2
    return r


def lock_state_name(v: int) -> str:
    return "LOCKED" if v == core_pb2.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED else "UNLOCKED"


def layouts_to_dict(pl: "keymap_pb2.PhysicalLayouts") -> dict:
    if not pl.layouts:
        return {"name": "", "keys": []}
    lay = pl.layouts[min(pl.active_layout_index, len(pl.layouts) - 1)]
    return {"name": lay.name,
            "keys": [{"pos": i, "x": k.x, "y": k.y, "w": k.width, "h": k.height,
                      "r": k.r, "rx": k.rx, "ry": k.ry} for i, k in enumerate(lay.keys)]}


def keymap_to_dict(km: "keymap_pb2.Keymap") -> dict:
    return {"available_layers": km.available_layers,
            "max_layer_name_length": km.max_layer_name_length,
            "layers": [{"index": i, "id": layer.id, "name": layer.name,
                        "bindings": [{"pos": p, "behavior_id": b.behavior_id,
                                      "param1": b.param1, "param2": b.param2}
                                     for p, b in enumerate(layer.bindings)]}
                       for i, layer in enumerate(km.layers)]}


def param_desc_to_dict(p: "behaviors_pb2.BehaviorParameterValueDescription") -> dict:
    kind = p.WhichOneof("value_type")
    out: dict = {"name": p.name, "type": kind or "nil"}
    if kind == "constant":
        out["value"] = p.constant
    elif kind == "range":
        out["min"], out["max"] = p.range.min, p.range.max
    elif kind == "hid_usage":
        out["keyboard_max"] = p.hid_usage.keyboard_max
        out["consumer_max"] = p.hid_usage.consumer_max
    return out


def behavior_to_dict(d: "behaviors_pb2.GetBehaviorDetailsResponse") -> dict:
    return {"id": d.id, "display_name": d.display_name,
            "metadata": [{"param1": [param_desc_to_dict(p) for p in m.param1],
                          "param2": [param_desc_to_dict(p) for p in m.param2]} for m in d.metadata]}


def raise_if_meta_error(rr: "studio_pb2.RequestResponse") -> None:
    if rr.WhichOneof("subsystem") == "meta" and rr.meta.WhichOneof("response_type") == "simple_error":
        raise RpcError(meta_pb2.ErrorConditions.Name(rr.meta.simple_error))


class NativeClient:
    """Thin RPC facade bound to an already-open serial handle and a shared rid counter."""

    def __init__(self, ser, next_rid: Callable[[], int]):
        self._ser = ser
        self._next_rid = next_rid

    def _call(self, req: "studio_pb2.Request") -> "studio_pb2.RequestResponse":
        rr = rpc.send_recv(self._ser, req).request_response
        raise_if_meta_error(rr)
        return rr

    def get_device_info(self) -> dict:
        i = self._call(req_get_device_info(self._next_rid())).core.get_device_info
        return {"name": i.name, "serial_number": bytes(i.serial_number).hex()}

    def get_lock_state(self) -> str:
        return lock_state_name(self._call(req_get_lock_state(self._next_rid())).core.get_lock_state)

    def reset_settings(self) -> bool:
        return bool(self._call(req_reset_settings(self._next_rid())).core.reset_settings)

    def get_keymap(self) -> "keymap_pb2.Keymap":
        return self._call(req_get_keymap(self._next_rid())).keymap.get_keymap

    def get_keymap_bytes(self) -> bytes:
        return self.get_keymap().SerializeToString()

    def get_physical_layouts(self) -> dict:
        return layouts_to_dict(
            self._call(req_get_physical_layouts(self._next_rid())).keymap.get_physical_layouts)

    def list_behaviors(self) -> list[int]:
        return list(self._call(req_list_behaviors(self._next_rid())).behaviors.list_all_behaviors.behaviors)

    def get_behavior_details(self, behavior_id: int) -> dict:
        return behavior_to_dict(
            self._call(req_behavior_details(self._next_rid(), behavior_id)).behaviors.get_behavior_details)

    def set_layer_binding(self, layer_id: int, position: int,
                          behavior_id: int, param1: int, param2: int) -> dict:
        return decode_status(self._call(req_set_layer_binding(
            self._next_rid(), layer_id, position, behavior_id, param1, param2)).keymap)

    def save_changes(self) -> dict:
        return decode_status(self._call(req_save_changes(self._next_rid())).keymap)
