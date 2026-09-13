import http.client, json, threading
import pytest
from zmk_runtime_cli.ui import server as SV
from zmk_runtime_cli import backup


class StubNative:
    def __init__(self, lock="UNLOCKED"):
        self.lock = lock
        self.calls = []

    def get_lock_state(self): return self.lock

    def set_layer_binding(self, *a):
        self.calls.append(("set", a))
        return {"ok": True, "error": ""}

    def save_changes(self):
        self.calls.append(("save",))
        return {"ok": True, "error": ""}

    def get_keymap_bytes(self): return b"\x01\x02\x03"

    def reset_settings(self):
        self.calls.append(("reset",))
        return True


class StubKeymap:
    def __init__(self): self.calls = []

    def get_layers(self): return [{"index": 0, "id": 0, "name": "DEFAULT", "bindings": 1}]

    def rename(self, i, n):
        self.calls.append(("rename", i, n))
        return {"ok": True, "error": ""}

    def add(self): return {"ok": False, "error": "ADD_LAYER_ERR_NO_SPACE"}

    def remove(self, i):
        self.calls.append(("remove", i))
        return {"ok": True, "error": ""}

    def move(self, s, d):
        self.calls.append(("move", s, d))
        return {"ok": True, "error": ""}

    def restore(self, i, a):
        self.calls.append(("restore", i, a))
        return {"ok": True, "error": ""}

    def save(self):
        self.calls.append(("save",))
        return {"ok": True, "error": ""}


class StubSession:
    def __init__(self, lock="UNLOCKED"):
        self.n = StubNative(lock)
        self.k = StubKeymap()
        self.lock_ = threading.RLock()
        self.port_name = "/dev/fake"

    lock = property(lambda self: self.lock_)

    def __enter__(self): return self

    def __exit__(self, *_): pass

    def native(self): return self.n

    def keymap_client(self): return self.k

    def behaviors(self):
        return [{"id": 5, "display_name": "Key Press",
                 "metadata": [{"param1": [{"name": "Key", "type": "hid_usage",
                                           "keyboard_max": 255, "consumer_max": 1024}],
                               "param2": []}]}]


@pytest.fixture
def srv(tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_LOG", tmp_path / "b.jsonl")
    monkeypatch.setattr(SV, "build_state", lambda s: {"stub": True, "keymap": {"layers": s.k.get_layers()}})
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<h1>hi</h1>")
    sess = StubSession()
    httpd = SV.make_server(sess, "127.0.0.1", 0, static)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    yield sess, httpd.server_address[1]
    httpd.shutdown()


def _req(port, method, path, body=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request(method, path, body=json.dumps(body) if body is not None else None,
              headers={"Content-Type": "application/json"})
    r = c.getresponse()
    data = r.read()
    return r.status, (json.loads(data) if r.getheader("Content-Type", "").startswith("application/json") else data)


def test_static_index_and_state(srv):
    sess, port = srv
    assert _req(port, "GET", "/") == (200, b"<h1>hi</h1>")
    assert _req(port, "GET", "/api/state")[1]["stub"] is True
    assert _req(port, "GET", "/nope")[0] == 404


def test_key_set_writes_backup_then_rpc_then_save(srv):
    sess, port = srv
    st, body = _req(port, "POST", "/api/key", {"layer_id": 0, "position": 3, "behavior_id": 5, "param1": 0x70004, "param2": 0})
    assert st == 200 and body["ok"] is True
    assert body["binding"]["label"] == {"text": "A", "behavior": "Key Press"}
    assert sess.n.calls == [("set", (0, 3, 5, 0x70004, 0)), ("save",)]
    log = backup.read_backup_log()
    assert log[-1]["op"] == "ui_key_set" and log[-1]["layer_id"] == 0 and log[-1]["position"] == 3


def test_key_set_validates_body(srv):
    _, port = srv
    assert _req(port, "POST", "/api/key", {"layer_id": 0})[0] == 400


def test_locked_device_rejects_mutations(srv):
    sess, port = srv
    sess.n.lock = "LOCKED"
    st, body = _req(port, "POST", "/api/layer/rename", {"layer_id": 0, "name": "X"})
    assert st == 423 and "LOCKED" in body["error"]
    assert sess.k.calls == []


def test_layer_routes(srv):
    sess, port = srv
    assert _req(port, "POST", "/api/layer/rename", {"layer_id": 0, "name": "BASE"})[1]["ok"] is True
    assert _req(port, "POST", "/api/layer/add", {})[1] == {"ok": False, "error": "ADD_LAYER_ERR_NO_SPACE"}
    assert _req(port, "POST", "/api/layer/move", {"start": 1, "dest": 2})[1]["ok"] is True
    assert _req(port, "POST", "/api/layer/remove", {"index": 1})[1]["ok"] is True
    assert _req(port, "POST", "/api/layer/restore", {"layer_id": 1, "at_index": 1})[1]["ok"] is True
    assert ("rename", 0, "BASE") in sess.k.calls and sess.k.calls.count(("save",)) == 4  # add failed -> no save


def test_rename_accepts_empty_name_and_rejects_non_string(srv):
    """Devices without `display-name` report "" for every layer, so clearing a
    name back to "" must be possible; a non-string is still a 400."""
    sess, port = srv
    assert _req(port, "POST", "/api/layer/rename", {"layer_id": 7, "name": ""})[1]["ok"] is True
    assert ("rename", 7, "") in sess.k.calls
    assert _req(port, "POST", "/api/layer/rename", {"layer_id": 7, "name": 5})[0] == 400


def test_snapshot_reset_and_backup_log(srv, tmp_path):
    sess, port = srv
    st, body = _req(port, "POST", "/api/snapshot", {})
    assert st == 200 and body["bytes"] == 3 and body["path"].endswith(".bin")
    st, body = _req(port, "POST", "/api/reset", {})
    assert st == 200 and body["ok"] is True and ("reset",) in sess.n.calls
    st, body = _req(port, "GET", "/api/backup-log?limit=5")
    assert st == 200 and [e["op"] for e in body["entries"]][-1] == "ui_reset"
