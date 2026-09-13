import pytest
import zmk_runtime_cli.proto  # noqa: F401
import studio_pb2, keymap_pb2, behaviors_pb2, core_pb2, meta_pb2
from zmk_runtime_cli.framing import encode_frame
from zmk_runtime_cli.ui import native_client as nc


class FakeSerial:
    """Serves one pre-encoded response frame per write() (scripted, in order)."""

    def __init__(self, frames: list[bytes]):
        self._frames = list(frames)
        self._payload = bytearray()
        self.written: list[bytes] = []

    def write(self, b):
        self.written.append(bytes(b))
        self._payload = bytearray(self._frames.pop(0)) if self._frames else bytearray()

    def flush(self):
        pass

    def read(self, n):
        out = bytes(self._payload[:n])
        del self._payload[:n]
        return out


def _rr(rid=1):
    r = studio_pb2.Response()
    r.request_response.request_id = rid
    return r


def _frame(resp):
    return encode_frame(resp.SerializeToString())


def test_builders_select_subsystem_and_type():
    assert nc.req_get_device_info(1).core.get_device_info is True
    assert nc.req_get_lock_state(1).core.get_lock_state is True
    assert nc.req_reset_settings(1).core.reset_settings is True
    assert nc.req_get_keymap(1).keymap.get_keymap is True
    assert nc.req_get_physical_layouts(1).keymap.get_physical_layouts is True
    assert nc.req_list_behaviors(1).behaviors.list_all_behaviors is True
    assert nc.req_behavior_details(1, 42).behaviors.get_behavior_details.behavior_id == 42
    slb = nc.req_set_layer_binding(9, 3, 7, 123, 5, 6).keymap.set_layer_binding
    assert (slb.layer_id, slb.key_position) == (3, 7)
    assert (slb.binding.behavior_id, slb.binding.param1, slb.binding.param2) == (123, 5, 6)
    assert nc.req_set_layer_binding(9, 3, 7, 123, 5, 6).request_id == 9


def test_lock_state_name():
    assert nc.lock_state_name(core_pb2.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED) == "LOCKED"
    assert nc.lock_state_name(core_pb2.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) == "UNLOCKED"


def test_layouts_to_dict_uses_active_layout():
    pl = keymap_pb2.PhysicalLayouts(active_layout_index=1)
    pl.layouts.add(name="Other")
    l1 = pl.layouts.add(name="Default")
    l1.keys.add(width=100, height=100, x=437, y=350, r=1000, rx=437, ry=350)
    out = nc.layouts_to_dict(pl)
    assert out["name"] == "Default"
    assert out["keys"] == [{"pos": 0, "x": 437, "y": 350, "w": 100, "h": 100, "r": 1000, "rx": 437, "ry": 350}]


def test_keymap_to_dict():
    km = keymap_pb2.Keymap(available_layers=0, max_layer_name_length=20)
    l0 = km.layers.add(id=3, name="DEFAULT")
    l0.bindings.add(behavior_id=1, param1=2, param2=3)
    out = nc.keymap_to_dict(km)
    assert out["available_layers"] == 0 and out["max_layer_name_length"] == 20
    assert out["layers"] == [{"index": 0, "id": 3, "name": "DEFAULT",
                              "bindings": [{"pos": 0, "behavior_id": 1, "param1": 2, "param2": 3}]}]


def test_param_desc_to_dict_all_types():
    P = behaviors_pb2.BehaviorParameterValueDescription
    assert nc.param_desc_to_dict(P(name="n", nil=behaviors_pb2.BehaviorParameterNil())) == {"name": "n", "type": "nil"}
    assert nc.param_desc_to_dict(P(name="c", constant=7)) == {"name": "c", "type": "constant", "value": 7}
    assert nc.param_desc_to_dict(P(name="r", range=behaviors_pb2.BehaviorParameterValueDescriptionRange(min=0, max=7))) == {"name": "r", "type": "range", "min": 0, "max": 7}
    assert nc.param_desc_to_dict(P(name="k", hid_usage=behaviors_pb2.BehaviorParameterHidUsage(keyboard_max=255, consumer_max=1024))) == {"name": "k", "type": "hid_usage", "keyboard_max": 255, "consumer_max": 1024}
    assert nc.param_desc_to_dict(P(name="l", layer_id=behaviors_pb2.BehaviorParameterLayerId())) == {"name": "l", "type": "layer_id"}


def test_behavior_to_dict():
    d = behaviors_pb2.GetBehaviorDetailsResponse(id=5, display_name="Key Press")
    ms = d.metadata.add()
    ms.param1.add(name="Key", hid_usage=behaviors_pb2.BehaviorParameterHidUsage(keyboard_max=255, consumer_max=1024))
    out = nc.behavior_to_dict(d)
    assert out == {"id": 5, "display_name": "Key Press",
                   "metadata": [{"param1": [{"name": "Key", "type": "hid_usage", "keyboard_max": 255, "consumer_max": 1024}], "param2": []}]}


def test_raise_if_meta_error():
    rr = studio_pb2.RequestResponse()
    rr.meta.simple_error = meta_pb2.UNLOCK_REQUIRED
    with pytest.raises(nc.RpcError, match="UNLOCK_REQUIRED"):
        nc.raise_if_meta_error(rr)
    ok = studio_pb2.RequestResponse()
    ok.keymap.save_changes.ok = True
    nc.raise_if_meta_error(ok)  # no raise


def _client(frames):
    rid = iter(range(1, 100))
    return nc.NativeClient(FakeSerial(frames), lambda: next(rid))


def test_client_get_lock_state_and_device_info():
    r1 = _rr()
    r1.request_response.core.get_lock_state = core_pb2.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    r2 = _rr(2)
    r2.request_response.core.get_device_info.name = "roBa"
    r2.request_response.core.get_device_info.serial_number = b"\x01\x02"
    c = _client([_frame(r1), _frame(r2)])
    assert c.get_lock_state() == "UNLOCKED"
    assert c.get_device_info() == {"name": "roBa", "serial_number": "0102"}


def test_client_set_layer_binding_ok_and_err():
    ok = _rr()
    ok.request_response.keymap.set_layer_binding = keymap_pb2.SET_LAYER_BINDING_RESP_OK
    err = _rr()
    err.request_response.keymap.set_layer_binding = keymap_pb2.SET_LAYER_BINDING_RESP_INVALID_PARAMETERS
    c = _client([_frame(ok), _frame(err)])
    assert c.set_layer_binding(0, 1, 5, 6, 7) == {"ok": True, "error": ""}
    assert c.set_layer_binding(0, 1, 5, 6, 7) == {"ok": False, "error": "SET_LAYER_BINDING_RESP_INVALID_PARAMETERS"}


def test_client_list_behaviors_and_details_and_layouts():
    lb = _rr()
    lb.request_response.behaviors.list_all_behaviors.behaviors.extend([5, 9])
    bd = _rr()
    bd.request_response.behaviors.get_behavior_details.id = 5
    bd.request_response.behaviors.get_behavior_details.display_name = "Transparent"
    pl = _rr()
    pl.request_response.keymap.get_physical_layouts.layouts.add(name="Default").keys.add(width=100, height=100, x=1, y=2)
    c = _client([_frame(lb), _frame(bd), _frame(pl)])
    assert c.list_behaviors() == [5, 9]
    assert c.get_behavior_details(5)["display_name"] == "Transparent"
    assert c.get_physical_layouts()["keys"][0]["x"] == 1


def test_client_meta_error_raises():
    bad = _rr()
    bad.request_response.meta.simple_error = meta_pb2.RPC_NOT_FOUND
    with pytest.raises(nc.RpcError, match="RPC_NOT_FOUND"):
        _client([_frame(bad)]).get_keymap()
