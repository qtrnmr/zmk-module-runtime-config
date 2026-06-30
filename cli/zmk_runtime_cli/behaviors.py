from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BehaviorSpec:
    kind: str
    args: tuple


# ZMK implicit-modifier wrappers -> bit, shifted into the keycode's high byte.
# Mirrors MOD_* in zmk keys.h (same <<24 convention as macro_dsl._MOD_BITS).
# Left side LC/LS/LA/LG = ctrl/shift/alt/gui; right side RC/RS/RA/RG.
_MOD_FUNCS = {
    "LC": 0x01 << 24, "LS": 0x02 << 24, "LA": 0x04 << 24, "LG": 0x08 << 24,
    "RC": 0x10 << 24, "RS": 0x20 << 24, "RA": 0x40 << 24, "RG": 0x80 << 24,
}


def _resolve_base_keycode(name: str, zmk) -> int:
    """Resolve a bare keycode (no modifier wrapper) to its numeric HID usage.
    Accepts a decimal / 0x.. literal, or a ZMK keycode name (e.g. TAB, ESC)."""
    try:
        return int(name, 0)
    except ValueError:
        val = getattr(zmk.Keycode, name.upper(), None)
        if val is None:
            raise ValueError(f"unknown keycode {name!r}")
        return int(val)


def _resolve_keycode(token: str, zmk) -> int:
    """Resolve a keycode token to its 32-bit value, peeling ZMK implicit-modifier
    wrappers (LG(TAB), LC(LS(X)), ...) into mod bits OR'd onto the base usage.
    zmk_studio_api's KeyPress already accepts this encoded int (high byte = mods),
    so the whole modified-keycode story lives here on the host, no firmware change."""
    mods = 0
    inner = token.strip()
    while len(inner) >= 3 and inner[2] == "(":
        head = inner[:2].upper()
        if head not in _MOD_FUNCS:
            raise ValueError(f"unknown modifier wrapper {inner[:2]!r} in {token!r}")
        if inner[-1] != ")":
            raise ValueError(f"unbalanced modifier wrapper in {token!r}")
        mods |= _MOD_FUNCS[head]
        inner = inner[3:-1].strip()
    return mods | _resolve_base_keycode(inner, zmk)


def parse_behavior(spec: str) -> BehaviorSpec:
    parts = spec.split()
    if not parts:
        raise ValueError("empty behavior spec")
    head = parts[0].upper()
    rest = parts[1:]
    if head in ("KP", "KEYPRESS"):
        if len(rest) != 1:
            raise ValueError("KP requires exactly one keycode, e.g. 'KP A'")
        return BehaviorSpec("KeyPress", (rest[0].upper(),))
    if head in ("TRANS", "TRANSPARENT"):
        return BehaviorSpec("Transparent", ())
    if head in ("MO", "MOMENTARYLAYER"):
        if len(rest) != 1:
            raise ValueError("MO requires one layer id, e.g. 'MO 5'")
        return BehaviorSpec("MomentaryLayer", (int(rest[0]),))
    if head == "RAW":
        if len(rest) != 3:
            raise ValueError("RAW requires behavior_id param1 param2")
        return BehaviorSpec("Raw", (int(rest[0]), int(rest[1]), int(rest[2])))
    if head in ("RT_MACRO", "RTMACRO"):
        if len(rest) != 1:
            raise ValueError("RT_MACRO requires one slot index, e.g. 'rt_macro 1'")
        return BehaviorSpec("RtMacro", (int(rest[0]),))
    raise ValueError(f"unknown behavior: {spec!r}")


def build_behavior(spec: BehaviorSpec, zmk):
    if spec.kind == "KeyPress":
        return zmk.KeyPress(_resolve_keycode(spec.args[0], zmk))
    if spec.kind == "Transparent":
        return zmk.Transparent()
    if spec.kind == "MomentaryLayer":
        return zmk.MomentaryLayer(spec.args[0])
    if spec.kind == "Raw":
        return zmk.Raw(*spec.args)
    raise ValueError(f"cannot build behavior of kind {spec.kind!r}")
