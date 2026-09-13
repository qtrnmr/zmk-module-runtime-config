"""zmkrt ui HTTP server: static SPA + JSON API over one DeviceSession (stdlib only)."""
from __future__ import annotations

import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

from ..backup import append_backup, read_backup_log, snapshot_path
from .native_client import RpcError
from .session import DeviceSession
from .state import build_state, label_binding

STATIC_DIR = Path(__file__).resolve().parent / "static"


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _int(body: dict, key: str) -> int:
    v = body.get(key)
    if not isinstance(v, int) or isinstance(v, bool):
        raise HttpError(400, f"'{key}' must be an integer")
    return v


def _layer_name(body: dict) -> str:
    """A layer name may legitimately be empty: that is the device default when the
    devicetree sets no `display-name`, so clearing a name must stay possible."""
    v = body.get("name")
    if not isinstance(v, str):
        raise HttpError(400, "'name' must be a string")
    return v


def require_unlocked(session) -> None:
    if session.native().get_lock_state() == "LOCKED":
        raise HttpError(423, "device is LOCKED; press &studio_unlock on the keyboard")


def _layers_by_index(session) -> dict[int, str]:
    return {layer["index"]: layer["name"] for layer in session.keymap_client().get_layers()}


# ---- routes: (session, body_or_query) -> (status, dict) --------------------
def api_state(session, _):
    return 200, build_state(session)


def api_key_set(session, body):
    layer_id, position = _int(body, "layer_id"), _int(body, "position")
    behavior_id, p1, p2 = _int(body, "behavior_id"), _int(body, "param1"), _int(body, "param2")
    with session:
        require_unlocked(session)
        append_backup({"op": "ui_key_set", "layer_id": layer_id, "position": position,
                       "new": {"behavior_id": behavior_id, "param1": p1, "param2": p2}})
        n = session.native()
        res = n.set_layer_binding(layer_id, position, behavior_id, p1, p2)
        if res["ok"]:
            res = n.save_changes()
        if not res["ok"]:
            return 200, {"ok": False, "error": res["error"]}
        binding = {"pos": position, "behavior_id": behavior_id, "param1": p1, "param2": p2}
        label_binding(session, _layers_by_index(session), binding)
    return 200, {"ok": True, "binding": binding}


def _layer_op(op: str, fn):
    def route(session, body):
        with session:
            require_unlocked(session)
            k = session.keymap_client()
            try:
                before = k.get_layers()
            except Exception:  # noqa: BLE001
                before = None
            append_backup({"op": f"ui_layer_{op}", "args": body, "before_layers": before})
            res = fn(k, body)
            if res["ok"]:
                res.update(k.save())
        return 200, res
    return route


api_layer_rename = _layer_op("rename", lambda k, b: k.rename(_int(b, "layer_id"), _layer_name(b)))
api_layer_add = _layer_op("add", lambda k, b: k.add())
api_layer_remove = _layer_op("remove", lambda k, b: k.remove(_int(b, "index")))
api_layer_move = _layer_op("move", lambda k, b: k.move(_int(b, "start"), _int(b, "dest")))
api_layer_restore = _layer_op("restore", lambda k, b: k.restore(_int(b, "layer_id"), _int(b, "at_index")))


def _snapshot(session) -> dict:
    data = session.native().get_keymap_bytes()
    out = snapshot_path()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    return {"path": str(out), "bytes": len(data)}


def api_snapshot(session, _):
    with session:
        info = _snapshot(session)
    append_backup({"op": "ui_snapshot", **info})
    return 200, info


def api_reset(session, _):
    with session:
        require_unlocked(session)
        info = _snapshot(session)
        append_backup({"op": "ui_reset", "snapshot": info["path"]})
        ok = session.native().reset_settings()
        getattr(session, "invalidate_behaviors", lambda: None)()
    return 200, {"ok": bool(ok), "snapshot": info}


def api_backup_log(_, query):
    try:
        limit = int(query.get("limit", ["50"])[0])
    except ValueError:
        raise HttpError(400, "limit must be an integer")
    return 200, {"entries": read_backup_log(limit)}


ROUTES = {
    ("GET", "/api/state"): api_state,
    ("POST", "/api/key"): api_key_set,
    ("POST", "/api/layer/rename"): api_layer_rename,
    ("POST", "/api/layer/add"): api_layer_add,
    ("POST", "/api/layer/remove"): api_layer_remove,
    ("POST", "/api/layer/move"): api_layer_move,
    ("POST", "/api/layer/restore"): api_layer_restore,
    ("POST", "/api/snapshot"): api_snapshot,
    ("POST", "/api/reset"): api_reset,
    ("GET", "/api/backup-log"): api_backup_log,
}


class Handler(BaseHTTPRequestHandler):
    server_version = "zmkrt-ui/0.1"

    def log_message(self, fmt, *args):  # quieter default log
        print(f"[ui] {self.command} {self.path} {args[1] if len(args) > 1 else ''}")

    def _json(self, status: int, obj) -> None:
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _static(self, path: str) -> None:
        root = self.server.static_dir.resolve()
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        f = (root / rel).resolve()
        if not f.is_file() or (f != root and root not in f.parents):
            self.send_error(404)
            return
        data = f.read_bytes()
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _dispatch(self, method: str) -> None:
        url = urlsplit(self.path)
        route = ROUTES.get((method, url.path))
        if route is None:
            if method == "GET" and not url.path.startswith("/api/"):
                self._static(url.path)
                return
            self._json(404, {"error": f"no route {method} {url.path}"})
            return
        try:
            if method == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(n) if n else b"{}"
                try:
                    body = json.loads(raw or b"{}")
                except json.JSONDecodeError:
                    raise HttpError(400, "body must be JSON")
                if not isinstance(body, dict):
                    raise HttpError(400, "body must be a JSON object")
                arg = body
            else:
                arg = parse_qs(url.query)
            status, obj = route(self.server.session, arg)
            self._json(status, obj)
        except HttpError as e:
            self._json(e.status, {"error": e.message})
        except RpcError as e:
            self._json(502, {"error": f"device error: {e}"})
        except Exception as e:  # noqa: BLE001  (serial timeouts etc.)
            sess = self.server.session
            if hasattr(sess, "on_serial_error"):
                sess.on_serial_error()
            self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")


def make_server(session, host: str, http_port: int, static_dir: Path) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((host, http_port), Handler)
    httpd.session = session
    httpd.static_dir = Path(static_dir)
    return httpd


def serve(port: str | None = None, http_port: int = 8760, open_browser: bool = True) -> None:
    session = DeviceSession(port)
    with session:
        info = _snapshot(session)               # spec 7: auto snapshot at start
    append_backup({"op": "ui_start", **info})
    print(f"[ui] serial={session.port_name} snapshot={info['path']}")
    httpd = make_server(session, "127.0.0.1", http_port, STATIC_DIR)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    print(f"[ui] listening on {url}  (Ctrl-C to stop; "
          "other zmkrt commands cannot use the port meanwhile)", flush=True)
    if open_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        session.close()
