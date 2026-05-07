"""Network helpers."""

from __future__ import annotations

import socket


def get_lan_ip() -> str:
    """Return the LAN IP address by opening a UDP socket to a public address.

    Falls back to "localhost" if no network is reachable.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.settimeout(0.5)
        # Doesn't actually send packets — just resolves the route.
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        return ip if ip else "localhost"
    except OSError:
        return "localhost"
    finally:
        sock.close()
