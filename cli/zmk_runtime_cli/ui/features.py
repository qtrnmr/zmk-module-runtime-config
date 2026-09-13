"""Assemble the /api/features document (macros, hold-tap, condlayers, combos,
encoder, trackball).

Each feature lives behind its own custom RPC subsystem, and a keyboard may ship
any subset of them. So every collector catches its own failure and reports
`{"available": False, "error": ...}` rather than taking the whole document down:
the browser then shows that message on that one tab.
"""
from __future__ import annotations

from .. import macro_dsl, rip_client
from ..holdtap_client import FLAVORS
from ..proto.macros import macros_pb2
from . import labels, state

#: Upper bound for the macro slot probe (see count_macro_slots).
MACRO_SLOTS_PROBE = 64


def _unavailable(exc: Exception) -> dict:
    return {"available": False, "error": f"{type(exc).__name__}: {exc}"}


def _macro_slot_exists(client, slot: int) -> bool:
    """True when the firmware answers get_macro for `slot`.

    An out-of-range slot does NOT raise: the firmware handler returns rc<0 and
    the dispatcher encodes that as a *set_macro* error response, which
    MacroClient.get_macro would silently read back as an empty step list. So
    probe on the response type instead of on the decoded steps.
    """
    req = macros_pb2.Request()
    req.get_macro.slot = slot
    try:
        resp = client._call(req)
    except Exception:  # noqa: BLE001  timeout / missing subsystem end the range too
        return False
    return resp.WhichOneof("response_type") == "get_macro"


def count_macro_slots(client, probe: int = MACRO_SLOTS_PROBE) -> int:
    """Number of configured macro slots (CONFIG_ZMK_RUNTIME_MACRO_SLOTS).

    There is no count RPC for macros, so walk slots from 0 until the firmware
    stops answering get_macro.
    """
    n = 0
    for slot in range(probe):
        if not _macro_slot_exists(client, slot):
            break
        n += 1
    return n


def collect_macros(session, rev) -> dict:
    try:
        c = session.macro_client()
        # Resolve the subsystem up front: the per-slot probe below swallows
        # exceptions to find the end of the range, and would otherwise report a
        # keyboard without zmk__macros as "available with 0 slots".
        c._resolve_index()
        if getattr(session, "macro_slot_count", None) is None:
            session.macro_slot_count = count_macro_slots(c)
        slots = []
        for slot in range(session.macro_slot_count):
            steps = c.get_macro(slot)
            for s in steps:
                s["label"] = labels.keycode_text(s["keycode"], rev)
            slots.append({"slot": slot, "steps": steps})
        return {"available": True, "max_steps": macro_dsl.MAX_STEPS, "slots": slots}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def collect_holdtaps(session) -> dict:
    try:
        return {"available": True, "flavors": list(FLAVORS),
                "slots": session.holdtap_client().list()}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def collect_condlayers(session) -> dict:
    try:
        return {"available": True, "entries": session.condlayer_client().list()}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def collect_combos(session, by_id, layers_by_index, rev) -> dict:
    try:
        entries = []
        for r in session.combos_client().list():
            info = r["info"]
            b = info["binding"]
            b["label"] = labels.label_for(b, by_id.get(b["behavior_id"]),
                                          layers_by_index, rev)
            entries.append(info)
        return {"available": True, "entries": entries}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def collect_encoder(session, by_id, layers_by_index, rev) -> dict:
    try:
        c = session.encoder_client()
        sensors = c.sensors().get("sensors", [])
        bindings = []
        for s in sensors:
            got = c.get(s["index"])
            layers = got.get("bindings", [])
            for lb in layers:
                for d in ("cw", "ccw"):
                    b = lb[d]
                    b["label"] = labels.label_for(b, by_id.get(b["behavior_id"]),
                                                  layers_by_index, rev)
            bindings.append({"sensor": s["index"], "layers": layers})
        return {"available": True, "sensors": sensors, "bindings": bindings}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def collect_trackball(session) -> dict:
    try:
        procs = session.rip_client().list().get("processors", [])
        return {"available": True, "processors": procs, "fields": rip_client.FIELD_UI}
    except Exception as exc:  # noqa: BLE001
        return _unavailable(exc)


def build_features(session, layers_by_index, behaviors, rev) -> dict:
    by_id = {b["id"]: b for b in behaviors}
    with session:
        return {
            "macros": collect_macros(session, rev),
            "holdtaps": collect_holdtaps(session),
            "condlayers": collect_condlayers(session),
            "combos": collect_combos(session, by_id, layers_by_index, rev),
            "encoder": collect_encoder(session, by_id, layers_by_index, rev),
            "trackball": collect_trackball(session),
        }


def build_features_doc(session) -> dict:
    """Gather the layer names / behaviors the labels need, then build the doc."""
    with session:
        layers_by_index = {layer["index"]: layer["name"]
                           for layer in session.keymap_client().get_layers()}
        behaviors = session.behaviors()
    rev = state.reverse_keycodes(state.keycode_table())
    return build_features(session, layers_by_index, behaviors, rev)
