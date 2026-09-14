"""GET/POST /api/ui-meta: the UI-only layer groups in .zmkrt-ui.json.

Nothing here touches the device except the *suggestion*, which reads layer
names — so the stub session only needs get_layers().
"""
import http.client, json, threading
import pytest
from zmk_runtime_cli.ui import server as SV
from zmk_runtime_cli import backup


class StubKeymap:
    def __init__(self, layers):
        self.layers = layers

    def get_layers(self):
        return self.layers


class StubSession:
    def __init__(self, layers):
        self.k = StubKeymap(layers)
        self.port_name = "/dev/fake"

    def __enter__(self): return self

    def __exit__(self, *_): pass

    def keymap_client(self): return self.k


ROBA_LAYERS = [
    {"index": 0, "id": 0, "name": "DEFAULT"},
    {"index": 1, "id": 1, "name": "APPLE"},
    {"index": 2, "id": 2, "name": "ANDROID"},
    {"index": 3, "id": 9, "name": "APPLE_NUM"},
    {"index": 4, "id": 4, "name": "SETTING"},
]


def _serve(layers, tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_LOG", tmp_path / "b.jsonl")
    monkeypatch.setattr(backup, "UI_META", tmp_path / ".zmkrt-ui.json")
    static = tmp_path / "static"
    static.mkdir()
    httpd = SV.make_server(StubSession(layers), "127.0.0.1", 0, static)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


@pytest.fixture
def srv(tmp_path, monkeypatch):
    httpd = _serve(ROBA_LAYERS, tmp_path, monkeypatch)
    yield httpd.server_address[1], tmp_path / ".zmkrt-ui.json"
    httpd.shutdown()


def _req(port, method, path, body=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request(method, path, body=json.dumps(body) if body is not None else None,
              headers={"Content-Type": "application/json"})
    r = c.getresponse()
    return r.status, json.loads(r.read())


GROUPS = [
    {"name": "Apple", "color": "sky", "layers": [1, 9]},
    {"name": "Windows", "color": "violet", "layers": [0]},
]


def test_get_defaults_when_file_absent(srv):
    port, path = srv
    st, body = _req(port, "GET", "/api/ui-meta")
    assert st == 200
    assert body["version"] == 1 and body["groups"] == []
    assert not path.exists()  # a GET never creates the file


def test_suggestion_from_layer_names(srv):
    port, _ = srv
    _, body = _req(port, "GET", "/api/ui-meta")
    assert [(g["id"], g["name"], g["color"], g["layers"]) for g in body["suggested"]] == [
        ("windows", "Windows", "violet", [0]),
        ("apple", "Apple", "sky", [1, 9]),
        ("android", "Android", "emerald", [2]),
    ]


def test_no_suggestion_below_two_groups(tmp_path, monkeypatch):
    """One matching rule is not a grouping worth offering."""
    httpd = _serve([{"index": 0, "id": 0, "name": "DEFAULT"},
                    {"index": 1, "id": 1, "name": "SETTING"}], tmp_path, monkeypatch)
    try:
        _, body = _req(httpd.server_address[1], "GET", "/api/ui-meta")
        assert "suggested" not in body
    finally:
        httpd.shutdown()


def test_round_trip_and_no_suggestion_once_saved(srv):
    port, path = srv
    st, body = _req(port, "POST", "/api/ui-meta", {"groups": GROUPS})
    assert st == 200
    assert body == {"version": 1, "groups": [
        {"id": "apple", "name": "Apple", "color": "sky", "layers": [1, 9]},
        {"id": "windows", "name": "Windows", "color": "violet", "layers": [0]},
    ]}
    assert json.loads(path.read_text())["groups"][0]["id"] == "apple"

    st, again = _req(port, "GET", "/api/ui-meta")
    assert st == 200 and again == body and "suggested" not in again

    log = backup.read_backup_log()
    assert log[-1]["op"] == "ui_meta_set" and len(log[-1]["groups"]) == 2


def test_empty_groups_saves_and_silences_the_suggestion(srv):
    """Dismissing every group is a real state: the file must be written so the
    suggestion does not come back."""
    port, path = srv
    assert _req(port, "POST", "/api/ui-meta", {"groups": []})[1] == {"version": 1, "groups": []}
    assert path.exists()
    assert "suggested" not in _req(port, "GET", "/api/ui-meta")[1]


def test_ids_are_slugged_and_deduplicated(srv):
    port, _ = srv
    _, body = _req(port, "POST", "/api/ui-meta", {"groups": [
        {"name": "My Mac!", "color": "sky", "layers": [1]},
        {"name": "my mac", "color": "rose", "layers": [2]},
        {"name": "日本語", "color": "amber", "layers": [0]},
    ]})
    assert [g["id"] for g in body["groups"]] == ["my-mac", "my-mac-2", "group"]


@pytest.mark.parametrize("groups", [
    "nope",
    [{"name": "", "color": "sky", "layers": []}],
    [{"name": "x" * 33, "color": "sky", "layers": []}],
    [{"name": "A", "color": "pink", "layers": []}],
    [{"name": "A", "layers": []}],
    [{"name": "A", "color": "sky", "layers": ["1"]}],
    [{"name": "A", "color": "sky", "layers": [True]}],
    [{"name": "A", "color": "sky"}],
    ["not an object"],
    [{"name": "A", "color": "sky", "layers": [1]},
     {"name": "B", "color": "rose", "layers": [1]}],
])
def test_validation_rejects(srv, groups):
    port, path = srv
    st, body = _req(port, "POST", "/api/ui-meta", {"groups": groups})
    assert st == 400 and body["error"]
    assert not path.exists()  # a rejected body writes nothing


def test_duplicate_layer_names_the_other_group(srv):
    port, _ = srv
    _, body = _req(port, "POST", "/api/ui-meta", {"groups": [
        {"name": "Apple", "color": "sky", "layers": [1]},
        {"name": "Windows", "color": "violet", "layers": [1]},
    ]})
    assert "layer 1" in body["error"] and "Apple" in body["error"]


def test_corrupt_file_reads_as_empty(srv):
    port, path = srv
    path.write_text("{ not json")
    assert _req(port, "GET", "/api/ui-meta")[1]["groups"] == []
