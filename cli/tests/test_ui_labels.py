from zmk_runtime_cli.ui import labels as L

REV = {0x70004: "A", 0x7002B: "TAB", 0x7001D: "Z", 0xC00E9: "C_VOL_UP", 0x700E0: "LCTRL",
       0x7002E: "EQL", (0x02 << 24) | 0x7002E: "PLUS"}
LAYERS = {0: "DEFAULT", 4: "NUM", 8: "SETTING"}
HID = [{"name": "Key", "type": "hid_usage", "keyboard_max": 255, "consumer_max": 1024}]
LAYER = [{"name": "Layer", "type": "layer_id"}]
NIL = [{"name": "", "type": "nil"}]


def beh(name, p1, p2=()):
    return {"id": 1, "display_name": name, "metadata": [{"param1": list(p1), "param2": list(p2)}]}


def b(p1=0, p2=0):
    return {"pos": 0, "behavior_id": 1, "param1": p1, "param2": p2}


def test_keycode_text_plain_and_modified_and_unknown():
    assert L.keycode_text(0x70004, REV) == "A"
    assert L.keycode_text((0x08 << 24) | 0x7002B, REV) == "LG(TAB)"
    assert L.keycode_text((0x01 << 24) | (0x02 << 24) | 0x7001D, REV) == "LC(LS(Z))"
    assert L.keycode_text(0x70099, REV) == "0x70099"


def test_keycode_text_prefers_the_symbol_name_over_shift_plus_base():
    # PLUS is defined as LS(EQL); the keymap author wrote PLUS, so show PLUS.
    assert L.keycode_text((0x02 << 24) | 0x7002E, REV) == "PLUS"


def test_key_press():
    assert L.label_for(b(0x70004), beh("Key Press", HID), LAYERS, REV) == {"text": "A", "behavior": "Key Press"}


def test_transparent_and_none():
    assert L.label_for(b(), beh("Transparent", NIL), LAYERS, REV) == {"text": "▽", "behavior": "Transparent"}
    assert L.label_for(b(), beh("None", NIL), LAYERS, REV) == {"text": "∅", "behavior": "None"}


def test_momentary_layer_uses_layer_name_or_fallback():
    assert L.label_for(b(4), beh("Momentary Layer", LAYER), LAYERS, REV) == {"text": "NUM", "behavior": "Momentary Layer"}
    assert L.label_for(b(9), beh("Momentary Layer", LAYER), LAYERS, REV) == {"text": "L9", "behavior": "Momentary Layer"}


def test_empty_layer_name_falls_back_to_index():
    """roBa has no `display-name` on its layer nodes, so the device reports "" for
    every layer; an empty name must render as L<n>, not as an empty label."""
    unnamed = {i: "" for i in range(12)}
    assert L.label_for(b(8), beh("Momentary Layer", LAYER), unnamed, REV) == \
        {"text": "L8", "behavior": "Momentary Layer"}
    assert L.label_for(b(7, 0x70004), beh("Layer-Tap", LAYER, HID), unnamed, REV) == \
        {"hold": "L7", "tap": "A", "behavior": "Layer-Tap"}


def test_mod_tap_and_layer_tap_are_hold_tap():
    assert L.label_for(b(0x700E0, 0x70004), beh("Mod-Tap", HID, HID), LAYERS, REV) == \
        {"hold": "LCTRL", "tap": "A", "behavior": "Mod-Tap"}
    assert L.label_for(b(8, 0x7002B), beh("LAYER_TAP_TO_0", LAYER, HID), LAYERS, REV) == \
        {"hold": "SETTING", "tap": "TAB", "behavior": "LAYER_TAP_TO_0"}


def test_constant_and_range_params():
    consts = [{"name": "Select Profile", "type": "constant", "value": 0}, {"name": "Clear", "type": "constant", "value": 2}]
    assert L.label_for(b(2), beh("Bluetooth", consts), LAYERS, REV)["text"] == "Clear"
    rng = [{"name": "Slot", "type": "range", "min": 0, "max": 7}]
    assert L.label_for(b(3), beh("rt_macro", rng), LAYERS, REV) == {"text": "3", "behavior": "rt_macro"}


def test_unknown_behavior_fallback():
    assert L.label_for({"pos": 0, "behavior_id": 77, "param1": 1, "param2": 2}, None, LAYERS, REV) == \
        {"text": "#77 1 2", "behavior": "?"}


def test_param_kind_prefers_matching_constant_then_range():
    descs = [{"name": "X", "type": "constant", "value": 5}, {"name": "R", "type": "range", "min": 0, "max": 9}]
    assert L.param_kind(descs, 5)[0] == "constant"
    assert L.param_kind(descs, 7)[0] == "range"
    assert L.param_kind(descs, 99)[0] == "unknown"
