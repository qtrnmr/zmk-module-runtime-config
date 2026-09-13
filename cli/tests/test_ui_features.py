"""features.py: the /api/features document, one collector per custom subsystem.

Every collector must degrade to {"available": False, "error": ...} on its own,
so a keyboard that ships only some of the runtime-config subsystems still gets a
usable page instead of a 500.
"""
import zmk_runtime_cli.proto  # noqa: F401  sets sys.path for the generated modules
import studio_pb2
import custom_pb2

from zmk_runtime_cli.framing import encode_frame
from zmk_runtime_cli.ui import features as F
from zmk_runtime_cli.ui.session import DeviceSession
from zmk_runtime_cli.ui.state import keycode_table, reverse_keycodes

from zmk_runtime_cli.proto.macros import macros_pb2
from zmk_runtime_cli.proto.holdtap import holdtap_pb2 as ht_pb2
from zmk_runtime_cli.proto.condlayers import condlayers_pb2 as cl_pb2
from zmk_runtime_cli.proto.zmk.combos import combos_pb2 as cb_pb2
from zmk_runtime_cli.proto.cormoran.rsr import custom_pb2 as rsr_pb2
from zmk_runtime_cli.proto.cormoran.rip import custom_pb2 as rip_pb2

from test_ui_native_client import FakeSerial

REV = reverse_keycodes(keycode_table())
KEY_A = 0x070004
KEY_PRESS = {"id": 8, "display_name": "Key Press",
             "metadata": [{"param1": [{"name": "Key", "type": "hid_usage",
                                       "keyboard_max": 255, "consumer_max": 1024}],
                           "param2": []}]}
BY_ID = {8: KEY_PRESS}
LAYERS = {0: "DEFAULT", 1: "APPLE"}


# ---- frame helpers --------------------------------------------------------
def _subsystems(*names: str) -> bytes:
    """A list_custom_subsystems response; index = position in `names`."""
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    resp = custom_pb2.ListCustomSubsystemResponse()
    for i, name in enumerate(names):
        sub = resp.subsystems.add()
        sub.identifier = name
        sub.index = i
    s.request_response.custom.list_custom_subsystems.CopyFrom(resp)
    return encode_frame(s.SerializeToString())


def _call(payload: bytes) -> bytes:
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    s.request_response.custom.call.payload = payload
    return encode_frame(s.SerializeToString())


def _notification(payload: bytes) -> bytes:
    s = studio_pb2.Response()
    s.notification.custom.custom_notification.payload = payload
    return encode_frame(s.SerializeToString())


def _session(frames: list[bytes]) -> DeviceSession:
    return DeviceSession(_ser=FakeSerial(frames))


# ---- macros ---------------------------------------------------------------
def _macro_get(*steps) -> bytes:
    r = macros_pb2.Response()
    for t, kc, w, tm in steps:
        s = r.get_macro.steps.add()
        s.type, s.keycode, s.wait_ms, s.tap_ms = t, kc, w, tm
    r.get_macro.SetInParent()
    return _call(r.SerializeToString())


def _macro_out_of_range() -> bytes:
    """What the firmware really answers for a slot past the configured count:
    the dispatcher turns rc<0 into a set_macro error response, NOT an error
    frame and NOT an empty get_macro."""
    r = macros_pb2.Response()
    r.set_macro.ok = False
    r.set_macro.error = 22
    return _call(r.SerializeToString())


def test_collect_macros_probes_the_slot_count_and_labels_keycodes():
    frames = [
        _subsystems("zmk__macros"),
        _macro_get((1, KEY_A, 80, 0)),   # probe slot 0
        _macro_get(),                    # probe slot 1 (empty but valid)
        _macro_out_of_range(),           # probe slot 2 -> count is 2
        _macro_get((1, KEY_A, 80, 0)),   # collect slot 0
        _macro_get(),                    # collect slot 1
    ]
    sess = _session(frames)
    out = F.collect_macros(sess, REV)
    assert out["available"] is True
    assert out["max_steps"] == 32
    assert [s["slot"] for s in out["slots"]] == [0, 1]
    assert out["slots"][0]["steps"] == [
        {"type": 1, "keycode": KEY_A, "wait_ms": 80, "tap_ms": 0, "label": "A"}]
    assert out["slots"][1]["steps"] == []
    assert sess.macro_slot_count == 2


def test_collect_macros_reuses_the_cached_slot_count():
    sess = _session([_subsystems("zmk__macros"), _macro_get(), _macro_get()])
    sess.macro_slot_count = 2
    out = F.collect_macros(sess, REV)
    assert [s["slot"] for s in out["slots"]] == [0, 1]


def test_collect_macros_unavailable_without_the_subsystem():
    out = F.collect_macros(_session([_subsystems("zmk__holdtap")]), REV)
    assert out["available"] is False
    assert "zmk__macros" in out["error"]


# ---- hold-tap -------------------------------------------------------------
def test_collect_holdtaps():
    count = ht_pb2.Response()
    count.count.count = 1
    got = ht_pb2.Response()
    got.get.slot = 0
    got.get.tapping_term_ms = 200
    got.get.quick_tap_ms = 0
    got.get.require_prior_idle_ms = 0
    got.get.flavor = 1
    got.get.found = True
    out = F.collect_holdtaps(_session([
        _subsystems("zmk__holdtap"),
        _call(count.SerializeToString()),
        _call(got.SerializeToString()),
    ]))
    assert out["available"] is True
    assert out["flavors"][1] == "balanced"
    assert out["slots"] == [{"slot": 0, "tapping_term_ms": 200, "quick_tap_ms": 0,
                             "require_prior_idle_ms": 0, "flavor": "balanced",
                             "flavor_index": 1, "found": True, "behavior_id": 0}]


def test_collect_holdtaps_unavailable_names_the_missing_subsystem():
    out = F.collect_holdtaps(_session([_subsystems("zmk__macros")]))
    assert out["available"] is False
    assert "zmk__holdtap" in out["error"]


# ---- conditional layers ---------------------------------------------------
def test_collect_condlayers_expands_the_mask_to_indices():
    count = cl_pb2.Response()
    count.count.count = 1
    got = cl_pb2.Response()
    got.get.index = 0
    got.get.if_layers_mask = (1 << 1) | (1 << 6)
    got.get.then_layer = 9
    got.get.found = True
    out = F.collect_condlayers(_session([
        _subsystems("zmk__condlayers"),
        _call(count.SerializeToString()),
        _call(got.SerializeToString()),
    ]))
    assert out["available"] is True
    assert out["entries"][0]["if_layers"] == [1, 6]
    assert out["entries"][0]["then_layer"] == 9


# ---- combos ---------------------------------------------------------------
def test_collect_combos_labels_the_binding():
    count = cb_pb2.Response()
    count.count.count = 1
    got = cb_pb2.Response()
    info = got.get.info
    info.index = 0
    info.key_positions.extend([11, 10])
    info.binding.behavior_id = 8
    info.binding.param1 = KEY_A
    info.timeout_ms = 50
    info.layer_mask = 0
    info.found = True
    out = F.collect_combos(_session([
        _subsystems("zmk__combos"),
        _call(count.SerializeToString()),
        _call(got.SerializeToString()),
    ]), BY_ID, LAYERS, REV)
    assert out["available"] is True
    e = out["entries"][0]
    assert e["key_positions"] == [11, 10]
    assert e["binding"]["label"] == {"text": "A", "behavior": "Key Press"}
    assert e["timeout_ms"] == 50 and e["layers"] == []


def test_collect_combos_marks_an_untouched_devicetree_binding():
    """roBa reports behavior_id 0 for every combo it has never overridden at
    runtime (make_binding() in src/runtime_combo.c falls back to the const DT
    binding when local_id is 0). Live behavior ids start at 1, so the generic
    unknown-behavior label '#0 458795 0' would misread that as a broken id."""
    count = cb_pb2.Response()
    count.count.count = 1
    got = cb_pb2.Response()
    info = got.get.info
    info.index = 0
    info.key_positions.extend([11, 10])
    info.binding.behavior_id = 0
    info.binding.param1 = 458795
    info.found = True
    out = F.collect_combos(_session([
        _subsystems("zmk__combos"),
        _call(count.SerializeToString()),
        _call(got.SerializeToString()),
    ]), BY_ID, LAYERS, REV)
    assert out["entries"][0]["binding"]["label"] == F.DT_DEFAULT_LABEL


# ---- encoder --------------------------------------------------------------
def test_collect_encoder_labels_both_directions():
    sensors = rsr_pb2.Response()
    s = sensors.get_sensors.sensors.add()
    s.index, s.name = 0, "encoder"
    got = rsr_pb2.Response()
    lb = got.get_all_layer_bindings.bindings.add()
    lb.layer = 0
    lb.cw_binding.behavior_id = 8
    lb.cw_binding.param1 = KEY_A
    lb.cw_binding.tap_ms = 20
    lb.ccw_binding.behavior_id = 8
    lb.ccw_binding.param1 = KEY_A
    lb.ccw_binding.tap_ms = 20
    out = F.collect_encoder(_session([
        _subsystems("cormoran_rsr"),
        _call(sensors.SerializeToString()),
        _call(got.SerializeToString()),
    ]), BY_ID, LAYERS, REV)
    assert out["available"] is True
    assert out["sensors"] == [{"index": 0, "name": "encoder"}]
    layer0 = out["bindings"][0]["layers"][0]
    assert layer0["layer"] == 0
    assert layer0["cw"]["label"] == {"text": "A", "behavior": "Key Press"}
    assert layer0["ccw"]["tap_ms"] == 20


def test_collect_encoder_marks_an_unconfigured_layer_as_devicetree_default():
    """roBa's second encoder reports an all-zero binding on every layer."""
    sensors = rsr_pb2.Response()
    s = sensors.get_sensors.sensors.add()
    s.index, s.name = 1, "encoder_right"
    got = rsr_pb2.Response()
    got.get_all_layer_bindings.bindings.add().layer = 0
    out = F.collect_encoder(_session([
        _subsystems("cormoran_rsr"),
        _call(sensors.SerializeToString()),
        _call(got.SerializeToString()),
    ]), BY_ID, LAYERS, REV)
    layer0 = out["bindings"][0]["layers"][0]
    assert layer0["cw"]["label"] == F.DT_DEFAULT_LABEL
    assert layer0["ccw"]["label"] == F.DT_DEFAULT_LABEL


# ---- trackball ------------------------------------------------------------
def test_collect_trackball_reads_the_notification_path_and_carries_the_field_table():
    n = rip_pb2.Notification()
    p = n.input_processor_changed.processor
    p.id, p.name = 0, "trackball"
    p.scale_multiplier, p.scale_divisor = 1, 1
    p.x_invert = True
    out = F.collect_trackball(_session([
        _subsystems("cormoran_rip"),
        _notification(n.SerializeToString()),
    ]))
    assert out["available"] is True
    assert out["processors"][0]["name"] == "trackball"
    assert out["processors"][0]["x_invert"] is True
    assert [f["name"] for f in out["fields"]][:1] == ["scale-multiplier"]


# ---- whole document -------------------------------------------------------
class _StubSession:
    """build_features must call every collector even when some of them fail."""

    def __init__(self):
        self.entered = 0

    def __enter__(self):
        self.entered += 1
        return self

    def __exit__(self, *_):
        pass

    def _boom(self):
        raise RuntimeError("no subsystem")

    macro_client = holdtap_client = condlayer_client = _boom
    combos_client = encoder_client = rip_client = _boom


def test_build_features_isolates_failures_per_feature():
    doc = F.build_features(_StubSession(), LAYERS, [KEY_PRESS], REV)
    assert set(doc) == {"macros", "holdtaps", "condlayers", "combos", "encoder", "trackball"}
    assert all(v["available"] is False for v in doc.values())
    assert all("no subsystem" in v["error"] for v in doc.values())


def test_session_exposes_one_client_factory_per_feature():
    sess = _session([])
    for name in ("macro_client", "holdtap_client", "condlayer_client",
                 "combos_client", "encoder_client", "rip_client"):
        client = getattr(sess, name)()
        assert client._ser is sess.serial, f"{name} must share the session's serial"
