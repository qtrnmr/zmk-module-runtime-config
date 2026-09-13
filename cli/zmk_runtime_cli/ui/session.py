"""DeviceSession: the ONE serial handle the UI server uses, plus an RLock that serializes
every RPC (the browser fires requests concurrently; the keyboard answers one at a time)."""
from __future__ import annotations

import threading

import serial

from .. import rpc
from ..keymap_client import KeymapClient
from .native_client import NativeClient


class DeviceSession:
    def __init__(self, port: str | None = None, baud: int = rpc.DEFAULT_BAUD, _ser=None):
        self._port = port
        self._baud = baud
        self._ser = _ser
        self._injected = _ser is not None
        self.port_name = "(injected)" if _ser is not None else ""
        self.lock = threading.RLock()
        self._rid = 0
        self._behaviors: list[dict] | None = None

    # -- serial lifecycle -------------------------------------------------
    @property
    def serial(self):
        if self._ser is None:
            self.port_name = self._port or rpc.find_port()
            self._ser = serial.Serial(self.port_name, self._baud, timeout=0.1)
        return self._ser

    def on_serial_error(self) -> None:
        """Drop the handle so the next access reopens (USB re-plug, device reboot)."""
        if not self._injected and self._ser is not None:
            try:
                self._ser.close()
            except Exception:  # noqa: BLE001
                pass
            self._ser = None

    def close(self) -> None:
        if not self._injected and self._ser is not None:
            self._ser.close()
            self._ser = None

    def __enter__(self) -> "DeviceSession":
        self.lock.acquire()
        return self

    def __exit__(self, *_) -> None:
        self.lock.release()

    # -- clients ----------------------------------------------------------
    def next_rid(self) -> int:
        self._rid += 1
        return self._rid

    def native(self) -> NativeClient:
        return NativeClient(self.serial, self.next_rid)

    def keymap_client(self) -> KeymapClient:
        return KeymapClient(_ser=self.serial)

    def behaviors(self) -> list[dict]:
        if self._behaviors is None:
            n = self.native()
            self._behaviors = [n.get_behavior_details(i) for i in n.list_behaviors()]
        return self._behaviors

    def invalidate_behaviors(self) -> None:
        self._behaviors = None
