"""Sub-project 2 client additions: id-direct combo/encoder setters and the
trackball field table the browser form is generated from."""
import zmk_runtime_cli.proto  # noqa: F401  sets sys.path for the generated modules
import studio_pb2

from zmk_runtime_cli.framing import decode_frame, encode_frame
from zmk_runtime_cli import combos_client as cc, encoder_client as ec, rip_client as rc
from zmk_runtime_cli.proto.zmk.combos import combos_pb2 as cb_pb2
from zmk_runtime_cli.proto.cormoran.rsr import custom_pb2 as rsr_pb2

from test_ui_native_client import FakeSerial


def _custom_frame(payload: bytes) -> bytes:
    s = studio_pb2.Response()
    s.request_response.request_id = 1
    s.request_response.custom.call.payload = payload
    return encode_frame(s.SerializeToString())


def _sent(ser: FakeSerial) -> studio_pb2.Request:
    req = studio_pb2.Request()
    req.ParseFromString(decode_frame(ser.written[-1]))
    return req


def test_combos_set_binding_sends_ids_directly():
    ok = cb_pb2.Response()
    ok.set.ok = True
    ser = FakeSerial([_custom_frame(ok.SerializeToString())])
    c = cc.CombosClient(_ser=ser)
    c._index = 3  # subsystem already resolved: no list_custom_subsystems round trip
    assert c.set_binding(2, 8, 458795, 0) == {"ok": True, "error": ""}
    inner = cb_pb2.Request()
    inner.ParseFromString(_sent(ser).custom.call.payload)
    assert inner.set.index == 2
    assert inner.set.binding.behavior_id == 8
    assert inner.set.binding.param1 == 458795
    assert inner.set.binding.param2 == 0


def test_combos_set_binding_reports_failure():
    bad = cb_pb2.Response()
    bad.set.ok = False
    ser = FakeSerial([_custom_frame(bad.SerializeToString())])
    c = cc.CombosClient(_ser=ser)
    c._index = 3
    assert c.set_binding(0, 1, 2, 3) == {"ok": False, "error": "set failed"}


def test_encoder_set_raw():
    ok = rsr_pb2.Response()
    ok.set_layer_ccw_binding.success = True
    ser = FakeSerial([_custom_frame(ok.SerializeToString())])
    c = ec.EncoderClient(_ser=ser)
    c._index = 4
    assert c.set_raw(0, 1, "ccw", 7, 65526, 0, 30)["ok"] is True
    inner = rsr_pb2.Request()
    inner.ParseFromString(_sent(ser).custom.call.payload)
    sub = inner.set_layer_ccw_binding
    assert (sub.sensor_index, sub.layer) == (0, 1)
    assert (sub.binding.behavior_id, sub.binding.param1, sub.binding.param2,
            sub.binding.tap_ms) == (7, 65526, 0, 30)


def test_encoder_set_raw_cw_direction():
    ok = rsr_pb2.Response()
    ok.set_layer_cw_binding.success = True
    ser = FakeSerial([_custom_frame(ok.SerializeToString())])
    c = ec.EncoderClient(_ser=ser)
    c._index = 4
    assert c.set_raw(0, 2, "cw", 9, 1, 0, 20)["ok"] is True
    inner = rsr_pb2.Request()
    inner.ParseFromString(_sent(ser).custom.call.payload)
    assert inner.WhichOneof("request_type") == "set_layer_cw_binding"


def test_field_ui_covers_field_specs():
    assert [f["name"] for f in rc.FIELD_UI] == list(rc.FIELD_SPECS)
    assert all(f["kind"] in ("int", "bool", "enum", "layer") for f in rc.FIELD_UI)
    assert next(f for f in rc.FIELD_UI if f["name"] == "axis-snap-mode")["options"] == [
        "none", "x", "y"]


def test_field_ui_info_keys_exist_on_the_processor_message():
    """Every info_key must name a real InputProcessorInfo field, or the browser
    form would render blanks for values the device actually reports."""
    from zmk_runtime_cli.proto.cormoran.rip import custom_pb2 as rip_pb2
    known = {f.name for f in rip_pb2.InputProcessorInfo.DESCRIPTOR.fields}
    assert {f["info_key"] for f in rc.FIELD_UI} <= known
