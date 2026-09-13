import json
from zmk_runtime_cli import backup


def test_append_and_read_roundtrip(tmp_path, monkeypatch):
    log = tmp_path / "b.jsonl"
    monkeypatch.setattr(backup, "BACKUP_LOG", log)
    backup.append_backup({"op": "x", "n": 1})
    backup.append_backup({"op": "y", "n": 2})
    entries = backup.read_backup_log(limit=50)
    assert [e["op"] for e in entries] == ["x", "y"]
    assert all("ts" in e for e in entries)


def test_read_limit_and_skips_malformed(tmp_path, monkeypatch):
    log = tmp_path / "b.jsonl"
    log.write_text('{"op":"a"}\nnot json\n{"op":"b"}\n{"op":"c"}\n')
    monkeypatch.setattr(backup, "BACKUP_LOG", log)
    assert [e["op"] for e in backup.read_backup_log(limit=2)] == ["b", "c"]


def test_read_missing_file_is_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_LOG", tmp_path / "nope.jsonl")
    assert backup.read_backup_log() == []


def test_snapshot_path_uses_timestamp(tmp_path, monkeypatch):
    import datetime as dt
    monkeypatch.setattr(backup, "BACKUP_LOG", tmp_path / "b.jsonl")
    p = backup.snapshot_path(dt.datetime(2026, 9, 13, 1, 2, 3))
    assert p == tmp_path / "keymap-snapshot-20260913-010203.bin"


def test_keymap_and_macro_clients_accept_injected_serial():
    from zmk_runtime_cli.keymap_client import KeymapClient
    from zmk_runtime_cli.macro_client import MacroClient
    fake = object()
    assert KeymapClient(_ser=fake)._ser is fake
    assert MacroClient(_ser=fake)._ser is fake
