from __future__ import annotations

import zmk_studio_api as zmk

from . import rpc


def open(port: str | None = None) -> "zmk.StudioClient":
    """Return a StudioClient connected to the keyboard over USB serial."""
    target = port or rpc.find_port()
    return zmk.StudioClient.open_serial(target)
