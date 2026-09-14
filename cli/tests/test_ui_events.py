"""GET /api/events: the practice-mode SSE stream."""
import http.client
import json
import queue
import threading
import time

import pytest

from zmk_runtime_cli.ui import server as SV


class StubSession:
    """A session whose stream is a queue the test feeds by hand."""

    def __init__(self, available=True, layers=None):
        self.available = available
        self.layers = layers or {"type": "layers", "mask": 1, "highest": 0, "ids": [0]}
        self.q: queue.Queue = queue.Queue()
        self.lock_ = threading.RLock()
        self.enabled = 0
        self.disabled = 0
        self.clients = 0
        self.closed = threading.Event()

    lock = property(lambda self: self.lock_)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def ensure_monitor_index(self):
        return self.available

    def monitor_open(self):
        self.clients += 1
        if self.clients == 1:
            self.enabled += 1
        return self.q, self.layers

    def monitor_close(self, q):
        assert q is self.q
        self.clients -= 1
        if self.clients == 0:
            self.disabled += 1
        self.closed.set()


@pytest.fixture
def srv(tmp_path):
    static = tmp_path / "static"
    static.mkdir()

    def start(session):
        httpd = SV.make_server(session, "127.0.0.1", 0, static)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        started.append(httpd)
        return httpd.server_address[1]

    started: list = []
    yield start
    for httpd in started:
        httpd.shutdown()


def _open_stream(port):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request("GET", "/api/events")
    return c, c.getresponse()


def _read_event(resp, timeout=5.0):
    """One `event:`/`data:` pair, skipping keep-alive comments."""
    name = None
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        line = resp.readline().decode()
        if not line:
            raise AssertionError("stream ended")
        line = line.strip()
        if line.startswith("event: "):
            name = line[len("event: "):]
        elif line.startswith("data: ") and name is not None:
            return name, json.loads(line[len("data: "):])
    raise AssertionError("timed out waiting for an event")


def test_headers_and_first_event_is_the_layer_state(srv):
    sess = StubSession()
    port = srv(sess)
    c, resp = _open_stream(port)
    try:
        assert resp.status == 200
        assert resp.getheader("Content-Type") == "text/event-stream; charset=utf-8"
        assert resp.getheader("Cache-Control") == "no-cache"
        assert _read_event(resp) == ("layers", sess.layers)
        assert sess.enabled == 1
    finally:
        c.close()


def test_events_are_forwarded_in_order_under_their_own_names(srv):
    sess = StubSession()
    port = srv(sess)
    c, resp = _open_stream(port)
    try:
        _read_event(resp)  # the initial layers
        sess.q.put({"type": "key", "position": 12, "pressed": True, "source": 255})
        sess.q.put({"type": "keycode", "usage_page": 7, "keycode": 4,
                    "pressed": True, "modifiers": 0})
        name, data = _read_event(resp)
        assert (name, data["position"]) == ("key", 12)
        name, data = _read_event(resp)
        assert (name, data["keycode"]) == ("keycode", 4)
    finally:
        c.close()


def test_a_quiet_stream_sends_keep_alive_comments(srv, monkeypatch):
    monkeypatch.setattr(SV, "KEEPALIVE_SECONDS", 0.05)
    sess = StubSession()
    port = srv(sess)
    c, resp = _open_stream(port)
    try:
        _read_event(resp)
        end = time.monotonic() + 5
        while time.monotonic() < end:
            if resp.readline().decode().startswith(": keep-alive"):
                break
        else:
            raise AssertionError("no keep-alive arrived")
    finally:
        c.close()


def test_firmware_without_the_subsystem_gets_one_unavailable_event(srv):
    sess = StubSession(available=False)
    port = srv(sess)
    c, resp = _open_stream(port)
    try:
        name, data = _read_event(resp)
        assert name == "unavailable"
        assert "zmk__monitor" in data["error"]
        assert resp.read().strip() == b""  # and the stream ends, not left hanging
        assert sess.enabled == 0
    finally:
        c.close()


def test_the_stream_is_disabled_again_when_the_browser_goes_away(srv):
    sess = StubSession()
    port = srv(sess)
    c, resp = _open_stream(port)
    _read_event(resp)
    assert sess.enabled == 1
    resp.close()   # the socket only really closes when the response file does
    c.close()
    # the write only fails on the next event, so keep the firmware "talking"
    end = time.monotonic() + 5
    while time.monotonic() < end and not sess.closed.is_set():
        sess.q.put({"type": "key", "position": 1, "pressed": True, "source": 255})
        time.sleep(0.02)
    assert sess.closed.is_set()
    assert sess.disabled == 1


def test_a_second_client_does_not_enable_twice(srv):
    sess = StubSession()
    port = srv(sess)
    c1, r1 = _open_stream(port)
    c2, r2 = _open_stream(port)
    try:
        _read_event(r1)
        _read_event(r2)
        assert sess.enabled == 1
        assert sess.clients == 2
    finally:
        c1.close()
        c2.close()
