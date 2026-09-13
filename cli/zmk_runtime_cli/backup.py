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
