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

#: Every key of the /api/features document, in document order. Also the set of
#: names `GET /api/features?only=` accepts.
FEATURE_KEYS = ("macros", "holdtaps", "condlayers", "combos", "encoder", "trackball")


#: Combos and encoder bindings report behavior_id 0 for "never overridden at
#: runtime, still the devicetree binding" — see make_binding() in
#: src/runtime_combo.c, which uses the const DT binding when local_id is 0. It
#: is not a behavior id (live ids start at 1), so label_for's unknown-behavior
#: fallback ("#0 458795 0" / behavior "?") would be actively misleading.
DT_DEFAULT_LABEL = {"text": "DT 既定", "behavior": "devicetree"}


def _unavailable(exc: Exception) -> dict:
    return {"available": False, "error": f"{type(exc).__name__}: {exc}"}


def binding_label(binding: dict, by_id: dict, layers_by_index: dict, rev: dict) -> dict:
    if binding["behavior_id"] == 0:
        return dict(DT_DEFAULT_LABEL)
    return labels.label_for(binding, by_id.get(binding["behavior_id"]),
                            layers_by_index, rev)


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
            b["label"] = binding_label(b, by_id, layers_by_index, rev)
            dt = info.get("dt_binding")
            if dt is not None:
                dt["label"] = binding_label(dt, by_id, layers_by_index, rev)
            # What the combo really does right now: the runtime override if
            # there is one, else the devicetree binding (only known on firmware
            # that reports dt_binding; older firmware keeps the DT 既定 label).
            src = b if b["behavior_id"] != 0 else (dt if dt is not None else b)
            info["effective"] = dict(src)
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
                    b["label"] = binding_label(b, by_id, layers_by_index, rev)
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


def build_features(session, layers_by_index, behaviors, rev, only=None) -> dict:
    """The features document. `only` (a set of FEATURE_KEYS) collects just those;
    every other feature is omitted from the document entirely."""
    by_id = {b["id"]: b for b in behaviors}
    wanted = set(FEATURE_KEYS) if only is None else set(only)
    collectors = {
        "macros": lambda: collect_macros(session, rev),
        "holdtaps": lambda: collect_holdtaps(session),
        "condlayers": lambda: collect_condlayers(session),
        "combos": lambda: collect_combos(session, by_id, layers_by_index, rev),
        "encoder": lambda: collect_encoder(session, by_id, layers_by_index, rev),
        "trackball": lambda: collect_trackball(session),
    }
    with session:
        return {k: collectors[k]() for k in FEATURE_KEYS if k in wanted}


def build_features_doc(session, only=None) -> dict:
    """Gather the layer names / behaviors the labels need, then build the doc."""
    with session:
        layers_by_index = {layer["index"]: layer["name"]
                           for layer in session.keymap_client().get_layers()}
        behaviors = session.behaviors()
    rev = state.reverse_keycodes(state.keycode_table())
    return build_features(session, layers_by_index, behaviors, rev, only=only)
