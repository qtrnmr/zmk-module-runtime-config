import threading
import zmk_runtime_cli.proto  # noqa: F401
import studio_pb2, keymap_pb2, behaviors_pb2, core_pb2
from zmk_runtime_cli.framing import encode_frame
from zmk_runtime_cli.ui import state as S
from zmk_runtime_cli.ui.session import DeviceSession
from test_ui_native_client import FakeSerial, _rr, _frame  # tests/ is on sys.path


def test_keycode_table_and_reverse():
    t = S.keycode_table()
    assert t["A"] == 0x70004 and t["TAB"] == 0x7002B
    rev = S.reverse_keycodes({"ASTERISK": 1, "ASTRK": 1, "B": 2})
    assert rev == {1: "ASTRK", 2: "B"}


def _device_frames():
    di = _rr()
    di.request_response.core.get_device_info.name = "roBa"
    ls = _rr()
    ls.request_response.core.get_lock_state = core_pb2.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    pl = _rr()
    pl.request_response.keymap.get_physical_layouts.layouts.add(name="Default").keys.add(
        width=100, height=100, x=0, y=37)
    km = _rr()
    k = km.request_response.keymap.get_keymap
    k.available_layers = 0
    k.max_layer_name_length = 20
    l0 = k.layers.add(id=0, name="DEFAULT")
    l0.bindings.add(behavior_id=5, param1=0x70004, param2=0)
    l1 = k.layers.add(id=1, name="NUM")
    l1.bindings.add(behavior_id=9, param1=0, param2=0)
    lb = _rr()
    lb.request_response.behaviors.list_all_behaviors.behaviors.extend([5, 9])
    b5 = _rr()
    d = b5.request_response.behaviors.get_behavior_details
    d.id = 5
    d.display_name = "Key Press"
    d.metadata.add().param1.add(name="Key", hid_usage=behaviors_pb2.BehaviorParameterHidUsage(
        keyboard_max=255, consumer_max=1024))
    b9 = _rr()
    d9 = b9.request_response.behaviors.get_behavior_details
    d9.id = 9
    d9.display_name = "Transparent"
    d9.metadata.add().param1.add(name="", nil=behaviors_pb2.BehaviorParameterNil())
    return [_frame(x) for x in (di, ls, pl, km, lb, b5, b9)]


def test_build_state_document():
    sess = DeviceSession(_ser=FakeSerial(_device_frames()))
    st = S.build_state(sess)
    assert st["device"] == {"name": "roBa", "lock_state": "UNLOCKED", "serial_port": "(injected)"}
    assert st["layout"]["keys"][0]["y"] == 37
    l0, l1 = st["keymap"]["layers"]
    assert l0["bindings"][0]["label"] == {"text": "A", "behavior": "Key Press"}
    assert l1["bindings"][0]["label"] == {"text": "▽", "behavior": "Transparent"}
    assert [b["id"] for b in st["behaviors"]] == [5, 9]
    assert st["keycodes"]["A"] == 0x70004
    assert st["backup_log_path"].endswith(".zmkrt-backup.jsonl")


def test_session_caches_behaviors_and_serializes_calls():
    sess = DeviceSession(_ser=FakeSerial(_device_frames()))
    S.build_state(sess)
    assert len(sess.behaviors()) == 2          # no extra frames needed -> served from cache
    assert isinstance(sess.lock, type(threading.RLock()))
    with sess:                                  # re-entrant, no deadlock
        with sess:
            pass
