"""Turn a raw Studio binding (behavior_id, param1, param2) into a human label using the
behavior's parameter metadata. Canonical ZMK names only; prettifying lives in the UI."""
from __future__ import annotations

MOD_ORDER = ("LC", "LS", "LA", "LG", "RC", "RS", "RA", "RG")
MOD_BIT = {"LC": 0x01 << 24, "LS": 0x02 << 24, "LA": 0x04 << 24, "LG": 0x08 << 24,
           "RC": 0x10 << 24, "RS": 0x20 << 24, "RA": 0x40 << 24, "RG": 0x80 << 24}
_WELL_KNOWN = {"transparent": "▽", "none": "∅"}


def keycode_text(value: int, rev: dict[int, str]) -> str:
    base = value & 0x00FFFFFF
    text = rev.get(base, f"0x{base:X}")
    for mod in reversed(MOD_ORDER):  # innermost wrap first -> LC(LS(Z)) reads outer->inner
        if value & MOD_BIT[mod]:
            text = f"{mod}({text})"
    return text


def param_kind(descs: list[dict], value: int) -> tuple[str, dict | None]:
    """Pick the description that explains `value`: exact constant > in-range > hid/layer > nil."""
    for d in descs:
        if d["type"] == "constant" and d.get("value") == value:
            return "constant", d
    for d in descs:
        if d["type"] == "range" and d.get("min", 0) <= value <= d.get("max", 0):
            return "range", d
    for d in descs:
        if d["type"] in ("hid_usage", "layer_id"):
            return d["type"], d
    for d in descs:
        if d["type"] == "nil":
            return "nil", d
    return "unknown", None


def param_text(descs: list[dict], value: int, layers_by_index: dict[int, str],
               rev: dict[int, str]) -> str | None:
    kind, d = param_kind(descs, value)
    if kind == "nil":
        return None
    if kind == "constant":
        return d["name"]
    if kind in ("range", "unknown"):
        return str(value)
    if kind == "hid_usage":
        return keycode_text(value, rev)
    if kind == "layer_id":
        # real devices report an empty Layer.name unless the devicetree sets
        # `display-name`, so treat "" the same as "missing" and fall back to L<n>
        return layers_by_index.get(value) or f"L{value}"
    return str(value)


def label_for(binding: dict, behavior: dict | None, layers_by_index: dict[int, str],
              rev: dict[int, str]) -> dict:
    if behavior is None:
        return {"text": f"#{binding['behavior_id']} {binding['param1']} {binding['param2']}",
                "behavior": "?"}
    name = behavior["display_name"]
    wk = _WELL_KNOWN.get(name.lower())
    if wk:
        return {"text": wk, "behavior": name}
    meta = behavior.get("metadata") or [{"param1": [], "param2": []}]
    p1d, p2d = meta[0].get("param1", []), meta[0].get("param2", [])
    t1 = param_text(p1d, binding["param1"], layers_by_index, rev) if p1d else None
    t2 = param_text(p2d, binding["param2"], layers_by_index, rev) if p2d else None
    if t1 is not None and t2 is not None:
        return {"hold": t1, "tap": t2, "behavior": name}
    if t1 is not None:
        return {"text": t1, "behavior": name}
    if t2 is not None:
        return {"text": t2, "behavior": name}
    return {"text": name, "behavior": name}
