"""zmkrt ui HTTP server: static SPA + JSON API over one DeviceSession (stdlib only)."""
from __future__ import annotations

import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

from .. import holdtap_client, macro_dsl, rip_client
from ..backup import append_backup, read_backup_log, snapshot_path
from .features import build_features_doc
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


def _bool(body: dict, key: str) -> bool:
    v = body.get(key)
    if not isinstance(v, bool):
        raise HttpError(400, f"'{key}' must be a boolean")
    return v


def _list_int(body: dict, key: str) -> list[int]:
    v = body.get(key)
    if not isinstance(v, list) or not all(
            isinstance(x, int) and not isinstance(x, bool) for x in v):
        raise HttpError(400, f"'{key}' must be a list of integers")
    return v


def _choice(body: dict, key: str, choices) -> str:
    v = body.get(key)
    if v not in choices:
        raise HttpError(400, f"'{key}' must be one of {sorted(choices)}")
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


# ---- feature routes -------------------------------------------------------
# All of them: validate body -> session lock -> require_unlocked -> backup the
# `before` value read right before the RPC -> RPC.
def api_features(session, _):
    return 200, build_features_doc(session)


def api_macro_parse(_, body):
    """Pure DSL -> steps. No device I/O, so no lock check and no backup entry."""
    dsl = body.get("dsl")
    if not isinstance(dsl, str):
        raise HttpError(400, "'dsl' must be a string")
    allow = bool(body.get("allow_unbalanced", False))
    try:
        return 200, {"ok": True, "steps": macro_dsl.parse(dsl, allow_unbalanced=allow)}
    except ValueError as e:
        return 200, {"ok": False, "error": str(e)}


def _validate_steps(steps) -> list[dict]:
    if not isinstance(steps, list):
        raise HttpError(400, "'steps' must be a list")
    if len(steps) > macro_dsl.MAX_STEPS:
        raise HttpError(400, f"'steps' must hold at most {macro_dsl.MAX_STEPS} steps")
    out = []
    for s in steps:
        if not isinstance(s, dict):
            raise HttpError(400, "each step must be an object")
        t = s.get("type")
        values = (s.get("keycode"), s.get("wait_ms", 0), s.get("tap_ms", 0))
        if t not in (macro_dsl.STEP_TAP, macro_dsl.STEP_PRESS, macro_dsl.STEP_RELEASE) \
                or not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0
                           for v in values):
            raise HttpError(400, "step fields: type in {0,1,2}; "
                                 "keycode/wait_ms/tap_ms non-negative ints")
        out.append({"type": t, "keycode": values[0],
                    "wait_ms": values[1], "tap_ms": values[2]})
    return out


def _balance_warning(steps) -> str | None:
    """Unbalanced press/release leaves a key held down on the keyboard, which is
    worth warning about — but it is legitimate (a chord split across macros), so
    it is reported alongside a successful apply rather than rejected."""
    open_: dict[int, int] = {}
    for s in steps:
        if s["type"] == macro_dsl.STEP_PRESS:
            open_[s["keycode"]] = open_.get(s["keycode"], 0) + 1
        elif s["type"] == macro_dsl.STEP_RELEASE:
            if open_.get(s["keycode"], 0) == 0:
                return f"release of 0x{s['keycode']:X} without press"
            open_[s["keycode"]] -= 1
    left = [k for k, v in open_.items() if v > 0]
    return ("press without release: " + ", ".join(f"0x{k:X}" for k in left)) if left else None


def api_macro_set(session, body):
    slot = _int(body, "slot")
    steps = _validate_steps(body.get("steps"))
    with session:
        require_unlocked(session)
        c = session.macro_client()
        try:
            before = c.get_macro(slot)
        except Exception:  # noqa: BLE001  an unreadable slot must not block the write
            before = None
        append_backup({"op": "ui_macro_set", "slot": slot,
                       "before_steps": before, "new_steps": steps})
        res = c.set_macro(slot, steps)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or "",
                 "warning": _balance_warning(steps)}


def api_holdtap_set(session, body):
    slot = _int(body, "slot")
    field = _choice(body, "field", set(holdtap_client.SET_FIELDS))
    value = body.get("value")
    if not isinstance(value, (int, str)) or isinstance(value, bool):
        raise HttpError(400, "'value' must be an integer or a string")
    with session:
        require_unlocked(session)
        c = session.holdtap_client()
        before = c.get(slot)
        append_backup({"op": "ui_holdtap_set", "slot": slot, "field": field,
                       "value": value, "before": before})
        res = c.set(slot, field, str(value))
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_holdtap_reset(session, body):
    slot = _int(body, "slot")
    with session:
        require_unlocked(session)
        c = session.holdtap_client()
        before = c.get(slot)
        append_backup({"op": "ui_holdtap_reset", "slot": slot, "before": before})
        res = c.reset(slot)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_condlayer_set(session, body):
    index = _int(body, "index")
    if_layers = _list_int(body, "if_layers")
    then_layer = _int(body, "then_layer")
    with session:
        require_unlocked(session)
        c = session.condlayer_client()
        before = c.get(index)
        append_backup({"op": "ui_condlayer_set", "index": index, "if_layers": if_layers,
                       "then_layer": then_layer, "before": before})
        res = c.set(index, ",".join(str(n) for n in if_layers), then_layer)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_condlayer_reset(session, body):
    index = _int(body, "index")
    with session:
        require_unlocked(session)
        c = session.condlayer_client()
        before = c.get(index)
        append_backup({"op": "ui_condlayer_reset", "index": index, "before": before})
        res = c.reset(index)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


COMBO_FIELDS = {"binding", "timeout-ms", "require-prior-idle-ms", "layers", "slow-release"}


def api_combo_set(session, body):
    index = _int(body, "index")
    field = _choice(body, "field", COMBO_FIELDS)
    if field == "binding":
        b = body.get("binding")
        if not isinstance(b, dict):
            raise HttpError(400, "'binding' must be an object")
        ids = (_int(b, "behavior_id"), _int(b, "param1"), _int(b, "param2"))
    elif field == "layers":
        layers = _list_int(body, "value")
        # An empty selection means "every layer"; the CSV parser cannot express
        # it, so send the int mask 0 instead of an empty string.
        value = ",".join(str(n) for n in layers) if layers else 0
    elif field == "slow-release":
        value = _bool(body, "value")
    else:
        value = _int(body, "value")

    with session:
        require_unlocked(session)
        c = session.combos_client()
        before = c.get(index).get("info")
        append_backup({"op": "ui_combo_set", "index": index, "field": field,
                       "value": body.get("value"), "binding": body.get("binding"),
                       "before": before})
        res = c.set_binding(index, *ids) if field == "binding" else c.set(index, field, value)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_combo_reset(session, body):
    index = _int(body, "index")
    with session:
        require_unlocked(session)
        c = session.combos_client()
        before = c.get(index).get("info")
        append_backup({"op": "ui_combo_reset", "index": index, "before": before})
        res = c.reset(index)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_encoder_set(session, body):
    sensor, layer = _int(body, "sensor"), _int(body, "layer")
    direction = _choice(body, "direction", {"cw", "ccw"})
    behavior_id = _int(body, "behavior_id")
    p1, p2, tap_ms = _int(body, "param1"), _int(body, "param2"), _int(body, "tap_ms")
    with session:
        require_unlocked(session)
        c = session.encoder_client()
        before = c.get(sensor)
        append_backup({"op": "ui_encoder_set", "sensor": sensor, "layer": layer,
                       "direction": direction, "behavior_id": behavior_id,
                       "param1": p1, "param2": p2, "tap_ms": tap_ms, "before": before})
        res = c.set_raw(sensor, layer, direction, behavior_id, p1, p2, tap_ms)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_encoder_reset(session, body):
    sensor, layer = _int(body, "sensor"), _int(body, "layer")
    with session:
        require_unlocked(session)
        c = session.encoder_client()
        before = c.get(sensor)
        append_backup({"op": "ui_encoder_reset", "sensor": sensor, "layer": layer,
                       "before": before})
        res = c.reset(sensor, layer)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_trackball_set(session, body):
    pid = _int(body, "id")
    field = _choice(body, "field", set(rip_client.FIELD_SPECS))
    value = body.get("value")
    # FIELD_SPECS parses strings: booleans must read as 'true'/'false', enums go
    # as their option name, ints as decimal.
    if isinstance(value, bool):
        raw = "true" if value else "false"
    elif isinstance(value, (int, str)):
        raw = str(value)
    else:
        raise HttpError(400, "'value' must be a boolean, integer or string")
    with session:
        require_unlocked(session)
        c = session.rip_client()
        before = c.get(pid).get("processor")
        append_backup({"op": "ui_trackball_set", "id": pid, "field": field,
                       "value": value, "before": before})
        res = c.set(field, pid, raw)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


def api_trackball_reset(session, body):
    pid = _int(body, "id")
    with session:
        require_unlocked(session)
        c = session.rip_client()
        before = c.get(pid).get("processor")
        append_backup({"op": "ui_trackball_reset", "id": pid, "before": before})
        res = c.reset(pid)
    return 200, {"ok": bool(res.get("ok")), "error": res.get("error") or ""}


ROUTES = {
    ("GET", "/api/state"): api_state,
    ("GET", "/api/features"): api_features,
    ("POST", "/api/macro/parse"): api_macro_parse,
    ("POST", "/api/macro"): api_macro_set,
    ("POST", "/api/holdtap"): api_holdtap_set,
    ("POST", "/api/holdtap/reset"): api_holdtap_reset,
    ("POST", "/api/condlayer"): api_condlayer_set,
    ("POST", "/api/condlayer/reset"): api_condlayer_reset,
    ("POST", "/api/combo"): api_combo_set,
    ("POST", "/api/combo/reset"): api_combo_reset,
    ("POST", "/api/encoder"): api_encoder_set,
    ("POST", "/api/encoder/reset"): api_encoder_reset,
    ("POST", "/api/trackball"): api_trackball_set,
    ("POST", "/api/trackball/reset"): api_trackball_reset,
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
