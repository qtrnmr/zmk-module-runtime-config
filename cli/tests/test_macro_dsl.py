import pytest
from zmk_runtime_cli.macro_dsl import parse


def test_type_text():
    steps = parse("type hi")
    assert [s["keycode"] for s in steps] == [0x0B, 0x0C]  # h=0x0B, i=0x0C


def test_modified_key():
    s = parse("C-c")[0]
    assert s["keycode"] == 0x01000006  # LC(c): ctrl bit (0x01<<24) | c(0x06)


def test_wait_attaches_to_prev():
    steps = parse("C-c | wait 200")
    assert steps[-1]["wait_ms"] == 200


def test_unknown_token_raises():
    with pytest.raises(ValueError):
        parse("frobnicate x")


def test_too_many_steps_raises():
    # "type " + 33 identical characters produces 33 steps, exceeding MAX_STEPS=32
    with pytest.raises(ValueError, match="max is 32"):
        parse("type " + "a" * 33)


from zmk_runtime_cli.macro_dsl import _resolve_key


def test_named_keycodes_full_page_encoding():
    assert _resolve_key("GLOBE") == 0x0C029D == 787101
    assert _resolve_key("LEFT") == 0x070050
    assert _resolve_key("RIGHT") == 0x07004F
    assert _resolve_key("UP") == 0x070052
    assert _resolve_key("DOWN") == 0x070051


def test_resolve_key_fallbacks():
    assert _resolve_key("c") == 0x06           # single char via _HID
    assert _resolve_key("C-c") == 0x01000006   # mod form
    assert _resolve_key("0x1234") == 0x1234    # raw hex
    assert _resolve_key("258") == 258          # raw decimal


def test_press_release_tap_types():
    steps = parse("press GLOBE | tap LEFT | release GLOBE")
    assert [s["type"] for s in steps] == [1, 0, 2]
    assert [s["keycode"] for s in steps] == [0x0C029D, 0x070050, 0x0C029D]


def test_tap_single_char():
    s = parse("tap c")[0]
    assert s["type"] == 0 and s["keycode"] == 0x06
