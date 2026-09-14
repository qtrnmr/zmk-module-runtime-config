"""Change-audit log + snapshot naming shared by the CLI and the UI server."""
from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path

BACKUP_LOG = Path(__file__).resolve().parent.parent / ".zmkrt-backup.jsonl"


def append_backup(entry: dict) -> None:
    entry["ts"] = _dt.datetime.now().isoformat(timespec="seconds")
    with BACKUP_LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_backup_log(limit: int = 50) -> list[dict]:
    """Last `limit` well-formed entries, oldest first."""
    if not BACKUP_LOG.exists():
        return []
    out: list[dict] = []
    for line in BACKUP_LOG.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out[-limit:] if limit > 0 else out


def snapshot_path(now: _dt.datetime | None = None) -> Path:
    now = now or _dt.datetime.now()
    return BACKUP_LOG.parent / f"keymap-snapshot-{now:%Y%m%d-%H%M%S}.bin"


#: UI-only metadata (layer groups) kept beside the audit log. The firmware has
#: no notion of a group, so this file is the whole of it: nothing here ever
#: reaches the device.
UI_META = BACKUP_LOG.parent / ".zmkrt-ui.json"

EMPTY_UI_META = {"version": 1, "groups": []}


def read_ui_meta() -> dict:
    """The stored groups, or the empty document when the file is absent or
    unreadable. A corrupt file must not take the UI down with it."""
    if not UI_META.exists():
        return dict(EMPTY_UI_META)
    try:
        data = json.loads(UI_META.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return dict(EMPTY_UI_META)
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        return dict(EMPTY_UI_META)
    return {"version": int(data.get("version", 1)), "groups": data["groups"]}


def write_ui_meta(meta: dict) -> dict:
    UI_META.parent.mkdir(parents=True, exist_ok=True)
    UI_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
    return meta
