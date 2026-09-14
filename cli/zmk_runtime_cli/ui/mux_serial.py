"""MuxSerial: one serial port, two readers.

Every existing client reads the port directly (`rpc.send_recv`,
`RipClient._list_processors`), and `send_recv` simply discards notification
frames while it waits for its response. The 練習モード needs those frames. So
the session hands everyone a MuxSerial instead of the raw pyserial handle:

- With **no subscribers** the wrapper is a plain pass-through — `read`, `write`
  and `flush` go straight to the port, byte for byte, exactly as today. No
  thread exists, so there is nothing to be transparent *about*. (This is a
  deliberate narrowing of the design's "one always-on daemon thread": the
  keyboard streams nothing unless the monitor was enabled, and a thread per
  idle session costs real CPU in the test suite.)
- On the **first `subscribe()`** a daemon reader thread takes over the port. It
  splits frames with `rpc._extract_frame` and parses each one. A
  `custom_notification` whose `subsystem_index` is the monitor's is decoded and
  pushed to every subscriber queue; **everything else is handed back to
  `read()` as the original frame bytes**, so `send_recv` and
  `_list_processors` still see the stream they expect.
- On the **last `unsubscribe()`** the thread stops, any half-read frame is put
  back in front of the buffer, and the wrapper is a pass-through again.
"""
from __future__ import annotations

import queue
import threading
import time

import zmk_runtime_cli.proto  # noqa: F401  sets sys.path
import studio_pb2

from .. import rpc
from ..framing import decode_frame
from ..monitor_client import decode_notification

CHUNK = 256
# How long the reader naps when the port had nothing. A real pyserial read
# already blocks for its own timeout; this only keeps a non-blocking handle
# (the tests' FakeSerial) from spinning a core.
IDLE_NAP = 0.002


class MuxSerial:
    def __init__(self, real, on_error=None):
        self._real = real
        self._on_error = on_error
        self._io = threading.Lock()      # serializes reads of the real port
        self._cond = threading.Condition()  # guards _buf / _subs / _running
        self._buf = bytearray()          # frame bytes waiting for read()
        self._pending = bytearray()      # reader-owned partial frame
        self._subs: list[queue.Queue] = []
        self._monitor_index: int | None = None
        self._thread: threading.Thread | None = None
        self._running = False
        self.error = False

    # -- pyserial surface -------------------------------------------------
    @property
    def timeout(self):
        return getattr(self._real, "timeout", None)

    def write(self, b):
        return self._real.write(b)

    def flush(self):
        return self._real.flush()

    def read(self, n=1):
        with self._cond:
            if self._buf:
                return self._take_locked(n)
            running = self._running
        if not running:
            with self._io:
                return self._real.read(n)
        deadline = time.monotonic() + (self.timeout or 0.1)
        with self._cond:
            while not self._buf and self._running:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                self._cond.wait(remaining)
            if self._buf:
                return self._take_locked(n)
        return b""

    def close(self):
        self.stop()
        return self._real.close()

    def _take_locked(self, n: int) -> bytes:
        out = bytes(self._buf[:n])
        del self._buf[:n]
        return out

    # -- monitor plumbing -------------------------------------------------
    def set_monitor_index(self, index: int | None) -> None:
        """Which custom subsystem index to intercept. Until this is set (or if
        the firmware has no monitor) nothing is intercepted and every frame
        reaches read()."""
        with self._cond:
            self._monitor_index = index

    @property
    def monitor_index(self) -> int | None:
        with self._cond:
            return self._monitor_index

    def subscribe(self) -> "queue.Queue":
        q: queue.Queue = queue.Queue()
        with self._cond:
            self._subs.append(q)
            start = not self._running
            if start:
                self._running = True
                self.error = False
                self._thread = threading.Thread(
                    target=self._run, name="mux-serial-reader", daemon=True)
        if start:
            self._thread.start()
        return q

    def unsubscribe(self, q: "queue.Queue") -> None:
        with self._cond:
            if q in self._subs:
                self._subs.remove(q)
            last = not self._subs
        if last:
            self.stop()

    @property
    def subscribers(self) -> int:
        with self._cond:
            return len(self._subs)

    def stop(self) -> None:
        """Stop the reader and go back to pass-through. Waits for the thread so
        no one else touches the port while it is still in a read()."""
        with self._cond:
            if not self._running:
                return
            self._running = False
            self._cond.notify_all()
            t = self._thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=(self.timeout or 0.1) + 1.0)
        with self._cond:
            self._thread = None
            # A frame we had only half-read still belongs to read().
            if self._pending:
                self._buf[:0] = self._pending
                self._pending = bytearray()
            self._cond.notify_all()

    # -- the reader -------------------------------------------------------
    def _run(self) -> None:
        while True:
            with self._cond:
                if not self._running:
                    return
            try:
                with self._io:
                    chunk = self._real.read(CHUNK)
            except Exception:  # noqa: BLE001  port vanished (unplug, reboot)
                self._fail()
                return
            if not chunk:
                time.sleep(IDLE_NAP)
                continue
            self._pending += chunk
            while True:
                frame, self._pending = rpc._extract_frame(self._pending)
                if frame is None:
                    break
                if not self._dispatch(frame):
                    with self._cond:
                        self._buf += frame
                        self._cond.notify_all()

    def _fail(self) -> None:
        with self._cond:
            self._running = False
            self.error = True
            self._thread = None
            self._cond.notify_all()
        if self._on_error is not None:
            try:
                self._on_error()
            except Exception:  # noqa: BLE001
                pass

    def _dispatch(self, frame: bytes) -> bool:
        """True if the frame was a monitor notification (and was delivered)."""
        with self._cond:
            index = self._monitor_index
            if index is None or not self._subs:
                return False
        try:
            resp = studio_pb2.Response()
            resp.ParseFromString(decode_frame(frame))
        except Exception:  # noqa: BLE001  not our business; hand it to read()
            return False
        if resp.WhichOneof("type") != "notification":
            return False
        if resp.notification.WhichOneof("subsystem") != "custom":
            return False
        note = resp.notification.custom
        if note.WhichOneof("notification_type") != "custom_notification":
            return False
        if note.custom_notification.subsystem_index != index:
            return False
        event = decode_notification(note.custom_notification.payload)
        if event is None:
            return True  # ours, but empty — swallow it rather than confuse read()
        with self._cond:
            subs = list(self._subs)
        for q in subs:
            q.put(event)
        return True
