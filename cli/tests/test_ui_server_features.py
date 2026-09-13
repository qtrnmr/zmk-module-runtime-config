"""Feature routes: validate -> lock check -> backup(before) -> RPC.

Same StubSession shape as test_ui_server.py, with one recording stub per feature
client, so these tests pin the wire contract the browser panels rely on.
"""
import http.client
import json
import threading

import pytest

from zmk_runtime_cli import backup
from zmk_runtime_cli.ui import server as SV
from zmk_runtime_cli.ui import features as F


class _Rec:
    """Records every call as (method, *args) and answers ok."""

    def __init__(self):
        self.calls = []


class StubMacro(_Rec):
    def __init__(self):
        super().__init__()
        self.steps = [{"type": 0, "keycode": 4, "wait_ms": 0, "tap_ms": 0}]

    def get_macro(self, slot):
        self.calls.append(("get", slot))
        return self.steps

    def set_macro(self, slot, steps):
        self.calls.append(("set", slot, steps))
        return {"ok": True, "error": 0}


class StubHoldtap(_Rec):
    def get(self, slot):
        self.calls.append(("get", slot))
        return {"slot": slot, "tapping_term_ms": 200, "flavor": "balanced"}

    def set(self, slot, field, value):
        self.calls.append(("set", slot, field, value))
        return {"ok": True, "error": 0}

    def reset(self, slot):
        self.calls.append(("reset", slot))
        return {"ok": True, "error": 0}


class StubCondlayer(_Rec):
    def get(self, index):
        self.calls.append(("get", index))
        return {"index": index, "if_layers": [1, 6], "then_layer": 9}

    def set(self, index, if_csv, then_layer):
        self.calls.append(("set", index, if_csv, then_layer))
        return {"ok": True, "error": 0}

    def reset(self, index):
        self.calls.append(("reset", index))
        return {"ok": True, "error": 0}


class StubCombos(_Rec):
    def get(self, index):
        self.calls.append(("get", index))
        return {"ok": True, "error": "", "info": {"index": index, "timeout_ms": 50}}

    def set(self, index, field, value):
        self.calls.append(("set", index, field, value))
        return {"ok": True, "error": ""}

    def set_binding(self, index, behavior_id, p1, p2):
        self.calls.append(("set_binding", index, behavior_id, p1, p2))
        return {"ok": True, "error": ""}

    def reset(self, index):
        self.calls.append(("reset", index))
        return {"ok": True, "error": ""}


class StubEncoder(_Rec):
    def get(self, sensor):
        self.calls.append(("get", sensor))
        return {"ok": True, "bindings": [{"layer": 0, "cw": {}, "ccw": {}}]}

    def set_raw(self, sensor, layer, direction, behavior_id, p1, p2, tap_ms):
        self.calls.append(("set_raw", sensor, layer, direction, behavior_id, p1, p2, tap_ms))
        return {"ok": True, "error": ""}

    def reset(self, sensor, layer):
        self.calls.append(("reset", sensor, layer))
        return {"ok": True, "error": ""}


class StubRip(_Rec):
    def get(self, id):
        self.calls.append(("get", id))
        return {"ok": True, "processor": {"id": id, "x_invert": False}}

    def set(self, field, id, raw_value):
        self.calls.append(("set", field, id, raw_value))
        return {"ok": True, "error": ""}

    def reset(self, id):
        self.calls.append(("reset", id))
        return {"ok": True, "error": ""}


class StubNative:
    def __init__(self, lock="UNLOCKED"):
        self.lock = lock

    def get_lock_state(self):
        return self.lock


class StubSession:
    def __init__(self):
        self.n = StubNative()
        self.macro = StubMacro()
        self.holdtap = StubHoldtap()
        self.condlayer = StubCondlayer()
        self.combos = StubCombos()
        self.encoder = StubEncoder()
        self.rip = StubRip()
        self.lock_ = threading.RLock()
        self.port_name = "/dev/fake"

    lock = property(lambda self: self.lock_)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def native(self):
        return self.n

    macro_client = property(lambda self: lambda: self.macro)
    holdtap_client = property(lambda self: lambda: self.holdtap)
    condlayer_client = property(lambda self: lambda: self.condlayer)
    combos_client = property(lambda self: lambda: self.combos)
    encoder_client = property(lambda self: lambda: self.encoder)
    rip_client = property(lambda self: lambda: self.rip)


@pytest.fixture
def srv(tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_LOG", tmp_path / "b.jsonl")
    def _doc(s, only=None):
        full = {k: {"available": True, "slots": []} for k in F.FEATURE_KEYS}
        return full if only is None else {k: full[k] for k in F.FEATURE_KEYS if k in only}
    monkeypatch.setattr(SV, "build_features_doc", _doc)
    static = tmp_path / "static"
    static.mkdir()
    sess = StubSession()
    httpd = SV.make_server(sess, "127.0.0.1", 0, static)
    # poll_interval bounds how long shutdown() blocks; the default 0.5s would
    # add half a second of teardown to each of these ~40 tests.
    t = threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.01},
                         daemon=True)
    t.start()
    yield sess, httpd.server_address[1]
    httpd.shutdown()


def _req(port, method, path, body=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request(method, path, body=json.dumps(body) if body is not None else None,
              headers={"Content-Type": "application/json"})
    r = c.getresponse()
    return r.status, json.loads(r.read())


def _last_backup():
    return backup.read_backup_log()[-1]


# ---- features document ----------------------------------------------------
def test_features_document(srv):
    _, port = srv
    st, body = _req(port, "GET", "/api/features")
    assert st == 200 and body["macros"]["available"] is True


def test_features_only_query_limits_the_document(srv):
    _, port = srv
    st, doc = _req(port, "GET", "/api/features?only=holdtaps,combos")
    assert st == 200 and set(doc) == {"holdtaps", "combos"}


def test_features_only_rejects_an_unknown_name(srv):
    _, port = srv
    st, doc = _req(port, "GET", "/api/features?only=nope")
    assert st == 400 and "nope" in doc["error"]


# ---- macros ---------------------------------------------------------------
def test_macro_parse_ok_and_error(srv):
    _, port = srv
    st, body = _req(port, "POST", "/api/macro/parse", {"dsl": "press LEFT | release LEFT"})
    assert st == 200 and body["ok"] is True
    assert [s["type"] for s in body["steps"]] == [1, 2]

    st, body = _req(port, "POST", "/api/macro/parse", {"dsl": "press NOPE_KEY"})
    assert st == 200 and body["ok"] is False and body["error"]

    assert _req(port, "POST", "/api/macro/parse", {"dsl": 5})[0] == 400


def test_macro_parse_never_touches_the_device(srv):
    sess, port = srv
    _req(port, "POST", "/api/macro/parse", {"dsl": "type ab"})
    assert sess.macro.calls == []


def test_macro_set_records_before_steps_and_applies(srv):
    sess, port = srv
    steps = [{"type": 1, "keycode": 458756, "wait_ms": 50, "tap_ms": 0},
             {"type": 2, "keycode": 458756, "wait_ms": 0, "tap_ms": 0}]
    st, body = _req(port, "POST", "/api/macro", {"slot": 7, "steps": steps})
    assert st == 200 and body["ok"] is True and body["warning"] is None
    assert sess.macro.calls == [("get", 7), ("set", 7, steps)]
    e = _last_backup()
    assert e["op"] == "ui_macro_set" and e["slot"] == 7
    assert e["before_steps"] == sess.macro.steps and e["new_steps"] == steps


def test_macro_set_warns_about_unbalanced_press_but_still_applies(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/macro", {
        "slot": 0, "steps": [{"type": 1, "keycode": 4, "wait_ms": 0, "tap_ms": 0}]})
    assert st == 200 and body["ok"] is True
    assert "press without release" in body["warning"]
    assert ("set", 0, [{"type": 1, "keycode": 4, "wait_ms": 0, "tap_ms": 0}]) in sess.macro.calls


def test_macro_set_warns_about_release_without_press(srv):
    _, port = srv
    _, body = _req(port, "POST", "/api/macro", {
        "slot": 0, "steps": [{"type": 2, "keycode": 4, "wait_ms": 0, "tap_ms": 0}]})
    assert "release" in body["warning"]


@pytest.mark.parametrize("steps", [
    "not a list",
    [{"type": 3, "keycode": 4}],                 # unknown step type
    [{"type": 0, "keycode": -1}],                # negative keycode
    [{"type": 0, "keycode": 4, "wait_ms": "x"}],  # non-int wait
    [{"type": 0, "keycode": 4}] * 33,            # over MAX_STEPS
])
def test_macro_set_rejects_bad_steps(srv, steps):
    sess, port = srv
    assert _req(port, "POST", "/api/macro", {"slot": 0, "steps": steps})[0] == 400
    assert sess.macro.calls == []


def test_macro_set_accepts_an_empty_list_to_clear_a_slot(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/macro", {"slot": 3, "steps": []})
    assert st == 200 and body["ok"] is True and body["warning"] is None
    assert ("set", 3, []) in sess.macro.calls


# ---- hold-tap -------------------------------------------------------------
def test_holdtap_set_stringifies_the_value_and_backs_up_before(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/holdtap",
                    {"slot": 0, "field": "tapping-term-ms", "value": 210})
    assert st == 200 and body["ok"] is True
    assert sess.holdtap.calls == [("get", 0), ("set", 0, "tapping-term-ms", "210")]
    e = _last_backup()
    assert e["op"] == "ui_holdtap_set" and e["before"]["tapping_term_ms"] == 200


def test_holdtap_set_accepts_a_flavor_string(srv):
    sess, port = srv
    _req(port, "POST", "/api/holdtap", {"slot": 1, "field": "flavor", "value": "tap-preferred"})
    assert ("set", 1, "flavor", "tap-preferred") in sess.holdtap.calls


def test_holdtap_rejects_an_unknown_field(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/holdtap",
                {"slot": 0, "field": "nope", "value": 1})[0] == 400
    assert sess.holdtap.calls == []


def test_holdtap_reset(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/holdtap/reset", {"slot": 2})[1]["ok"] is True
    assert sess.holdtap.calls == [("get", 2), ("reset", 2)]
    assert _last_backup()["op"] == "ui_holdtap_reset"


# ---- conditional layers ---------------------------------------------------
def test_condlayer_set_joins_the_csv(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/condlayer",
                    {"index": 0, "if_layers": [2, 6], "then_layer": 10})
    assert st == 200 and body["ok"] is True
    assert sess.condlayer.calls == [("get", 0), ("set", 0, "2,6", 10)]
    assert _last_backup()["op"] == "ui_condlayer_set"


def test_condlayer_set_rejects_a_non_int_layer_list(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/condlayer",
                {"index": 0, "if_layers": [1, "x"], "then_layer": 9})[0] == 400
    assert _req(port, "POST", "/api/condlayer",
                {"index": 0, "if_layers": 3, "then_layer": 9})[0] == 400
    assert sess.condlayer.calls == []


def test_condlayer_reset(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/condlayer/reset", {"index": 1})[1]["ok"] is True
    assert sess.condlayer.calls == [("get", 1), ("reset", 1)]


# ---- combos ---------------------------------------------------------------
def test_combo_binding_uses_the_id_direct_setter(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/combo", {
        "index": 0, "field": "binding",
        "binding": {"behavior_id": 8, "param1": 458795, "param2": 0}})
    assert st == 200 and body["ok"] is True
    assert ("set_binding", 0, 8, 458795, 0) in sess.combos.calls
    assert _last_backup()["before"]["timeout_ms"] == 50


def test_combo_int_and_bool_and_layer_fields(srv):
    sess, port = srv
    _req(port, "POST", "/api/combo", {"index": 0, "field": "timeout-ms", "value": 60})
    _req(port, "POST", "/api/combo", {"index": 1, "field": "slow-release", "value": True})
    _req(port, "POST", "/api/combo", {"index": 2, "field": "layers", "value": [1, 7]})
    _req(port, "POST", "/api/combo", {"index": 3, "field": "layers", "value": []})
    sets = [c for c in sess.combos.calls if c[0] == "set"]
    assert ("set", 0, "timeout-ms", 60) in sets
    assert ("set", 1, "slow-release", True) in sets
    assert ("set", 2, "layers", "1,7") in sets
    # an empty list must go as the int mask 0, not as "" (which would not parse)
    assert ("set", 3, "layers", 0) in sets


def test_combo_rejects_wrong_value_types(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/combo",
                {"index": 0, "field": "timeout-ms", "value": "60"})[0] == 400
    assert _req(port, "POST", "/api/combo",
                {"index": 0, "field": "slow-release", "value": 1})[0] == 400
    assert _req(port, "POST", "/api/combo",
                {"index": 0, "field": "binding", "binding": {"behavior_id": 8}})[0] == 400
    assert _req(port, "POST", "/api/combo", {"index": 0, "field": "nope"})[0] == 400
    assert [c for c in sess.combos.calls if c[0] != "get"] == []


def test_combo_reset(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/combo/reset", {"index": 4})[1]["ok"] is True
    assert ("reset", 4) in sess.combos.calls


# ---- encoder --------------------------------------------------------------
def test_encoder_set_passes_raw_ids(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/encoder", {
        "sensor": 0, "layer": 1, "direction": "ccw",
        "behavior_id": 7, "param1": 65526, "param2": 0, "tap_ms": 30})
    assert st == 200 and body["ok"] is True
    assert ("set_raw", 0, 1, "ccw", 7, 65526, 0, 30) in sess.encoder.calls
    assert _last_backup()["op"] == "ui_encoder_set"


def test_encoder_rejects_an_unknown_direction(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/encoder", {
        "sensor": 0, "layer": 0, "direction": "up",
        "behavior_id": 1, "param1": 0, "param2": 0, "tap_ms": 20})[0] == 400
    assert [c for c in sess.encoder.calls if c[0] != "get"] == []


def test_encoder_reset(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/encoder/reset", {"sensor": 0, "layer": 2})[1]["ok"] is True
    assert ("reset", 0, 2) in sess.encoder.calls


# ---- trackball ------------------------------------------------------------
def test_trackball_set_stringifies_by_type(srv):
    sess, port = srv
    _req(port, "POST", "/api/trackball", {"id": 0, "field": "x-invert", "value": True})
    _req(port, "POST", "/api/trackball", {"id": 0, "field": "y-invert", "value": False})
    _req(port, "POST", "/api/trackball", {"id": 0, "field": "scale-multiplier", "value": 3})
    _req(port, "POST", "/api/trackball", {"id": 0, "field": "axis-snap-mode", "value": "x"})
    sets = [c for c in sess.rip.calls if c[0] == "set"]
    assert sets == [("set", "x-invert", 0, "true"), ("set", "y-invert", 0, "false"),
                    ("set", "scale-multiplier", 0, "3"), ("set", "axis-snap-mode", 0, "x")]
    assert _last_backup()["before"]["x_invert"] is False


def test_trackball_rejects_an_unknown_field(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/trackball",
                {"id": 0, "field": "nope", "value": 1})[0] == 400
    assert [c for c in sess.rip.calls if c[0] != "get"] == []


def test_trackball_reset_records_the_whole_processor(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/trackball/reset", {"id": 0})[1]["ok"] is True
    assert ("reset", 0) in sess.rip.calls
    e = _last_backup()
    assert e["op"] == "ui_trackball_reset" and e["before"] == {"id": 0, "x_invert": False}


# ---- lock -----------------------------------------------------------------
LOCKED_CASES = [
    ("/api/macro", {"slot": 0, "steps": []}),
    ("/api/holdtap", {"slot": 0, "field": "tapping-term-ms", "value": 200}),
    ("/api/holdtap/reset", {"slot": 0}),
    ("/api/condlayer", {"index": 0, "if_layers": [1], "then_layer": 2}),
    ("/api/condlayer/reset", {"index": 0}),
    ("/api/combo", {"index": 0, "field": "timeout-ms", "value": 50}),
    ("/api/combo/reset", {"index": 0}),
    ("/api/encoder", {"sensor": 0, "layer": 0, "direction": "cw",
                      "behavior_id": 1, "param1": 0, "param2": 0, "tap_ms": 20}),
    ("/api/encoder/reset", {"sensor": 0, "layer": 0}),
    ("/api/trackball", {"id": 0, "field": "x-invert", "value": True}),
    ("/api/trackball/reset", {"id": 0}),
]


@pytest.mark.parametrize("path,body", LOCKED_CASES)
def test_locked_device_rejects_every_feature_mutation(srv, path, body):
    sess, port = srv
    sess.n.lock = "LOCKED"
    st, resp = _req(port, "POST", path, body)
    assert st == 423 and "LOCKED" in resp["error"]
    for client in (sess.macro, sess.holdtap, sess.condlayer,
                   sess.combos, sess.encoder, sess.rip):
        assert client.calls == []
