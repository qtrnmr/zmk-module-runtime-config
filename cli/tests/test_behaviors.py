import pytest

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path for zmk_studio_api
import zmk_studio_api as zmk
from zmk_runtime_cli.behaviors import (
    BehaviorSpec,
    _resolve_keycode,
    parse_behavior,
)

TAB = int(zmk.Keycode.TAB)  # 0x07002B


def test_keypress():
    assert parse_behavior("KP A") == BehaviorSpec("KeyPress", ("A",))


def test_keypress_lowercase_head():
    assert parse_behavior("kp ENTER") == BehaviorSpec("KeyPress", ("ENTER",))


def test_transparent():
    assert parse_behavior("trans") == BehaviorSpec("Transparent", ())


def test_momentary_layer():
    assert parse_behavior("MO 5") == BehaviorSpec("MomentaryLayer", (5,))


def test_raw():
    assert parse_behavior("RAW 12 1 0") == BehaviorSpec("Raw", (12, 1, 0))


def test_rt_macro():
    assert parse_behavior("rt_macro 1") == BehaviorSpec("RtMacro", (1,))


def test_rt_macro_arity_error():
    with pytest.raises(ValueError):
        parse_behavior("rt_macro")


def test_unknown_raises():
    with pytest.raises(ValueError):
        parse_behavior("WAT 1")


def test_keypress_arity_error():
    with pytest.raises(ValueError):
        parse_behavior("KP")


def test_resolve_bare_keycode():
    assert _resolve_keycode("TAB", zmk) == TAB


def test_resolve_single_modifier():
    # LG(TAB) = TAB | (MOD_LGUI=0x08 << 24)
    assert _resolve_keycode("LG(TAB)", zmk) == TAB | (0x08 << 24)


def test_resolve_nested_modifiers():
    # LG(LS(TAB)) = TAB | LGUI | LSHIFT
    assert _resolve_keycode("LG(LS(TAB))", zmk) == TAB | (0x08 << 24) | (0x02 << 24)


def test_resolve_all_modifier_bits():
    cases = {"LC": 0x01, "LS": 0x02, "LA": 0x04, "LG": 0x08,
             "RC": 0x10, "RS": 0x20, "RA": 0x40, "RG": 0x80}
    for fn, bit in cases.items():
        assert _resolve_keycode(f"{fn}(TAB)", zmk) == TAB | (bit << 24)


def test_resolve_numeric_base():
    assert _resolve_keycode("LG(0x07002B)", zmk) == TAB | (0x08 << 24)


def test_resolve_unknown_wrapper_raises():
    with pytest.raises(ValueError):
        _resolve_keycode("XY(TAB)", zmk)


def test_resolve_unbalanced_raises():
    with pytest.raises(ValueError):
        _resolve_keycode("LG(TAB", zmk)
