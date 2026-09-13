"""Assemble the /api/state document."""
from __future__ import annotations

from ..backup import BACKUP_LOG
from .labels import label_for
from .session import DeviceSession

_KEYCODES: dict[str, int] | None = None


def keycode_table() -> dict[str, int]:
    global _KEYCODES
    if _KEYCODES is None:
        import zmk_studio_api as zmk  # enum only; never opens a port
        K = zmk.Keycode
        table: dict[str, int] = {}
        for name in dir(K):
            if name.startswith("_"):
                continue
            try:
                table[name] = int(getattr(K, name))
            except (TypeError, ValueError):
                continue
        _KEYCODES = table
    return _KEYCODES


def reverse_keycodes(table: dict[str, int]) -> dict[int, str]:
    rev: dict[int, str] = {}
    for name, val in sorted(table.items(), key=lambda kv: (len(kv[0]), kv[0])):
        rev.setdefault(val, name)
    return rev


def build_state(session: DeviceSession) -> dict:
    with session:
        n = session.native()
        device = n.get_device_info()
        lock = n.get_lock_state()
        layout = n.get_physical_layouts()
        keymap = _keymap_with_labels(n.get_keymap(), session.behaviors())
        behaviors = session.behaviors()
    return {"device": {"name": device["name"], "lock_state": lock,
                       "serial_port": session.port_name},
            "layout": layout, "keymap": keymap, "behaviors": behaviors,
            "keycodes": keycode_table(), "backup_log_path": str(BACKUP_LOG)}


def _keymap_with_labels(km, behaviors: list[dict]) -> dict:
    from .native_client import keymap_to_dict
    d = keymap_to_dict(km)
    by_id = {b["id"]: b for b in behaviors}
    layers_by_index = {layer["index"]: layer["name"] for layer in d["layers"]}
    rev = reverse_keycodes(keycode_table())
    for layer in d["layers"]:
        for b in layer["bindings"]:
            b["label"] = label_for(b, by_id.get(b["behavior_id"]), layers_by_index, rev)
    return d


def label_binding(session: DeviceSession, layers_by_index: dict[int, str], binding: dict) -> dict:
    """Label one binding (used by POST /api/key responses)."""
    by_id = {b["id"]: b for b in session.behaviors()}
    binding["label"] = label_for(binding, by_id.get(binding["behavior_id"]),
                                 layers_by_index, reverse_keycodes(keycode_table()))
    return binding
