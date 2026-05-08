"""Capture documentation screenshots from a live OutfitPi instance.

Boots the Flask app against a synthetic config + mocked weather, then drives
Playwright over each documented page at the official Pi 7" landscape
resolution (800x480) and writes PNGs to docs/img/.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = REPO_ROOT / "docs" / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 800, "height": 480}


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for(url: str, timeout: float = 30.0) -> None:
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                if r.status == 200:
                    return
        except OSError:
            time.sleep(0.5)
    raise RuntimeError(f"server did not come up at {url}")


def _write_config(path: Path) -> None:
    cfg = {
        "location": {"latitude": 40.0468, "longitude": -75.531, "auto": False, "consent_given": False},
        "units": {"temperature": "fahrenheit"},
        "language": "en",
        "children": [
            {"name": "Sam", "gender": "boy", "comfort_offset_f": 0},
            {"name": "Lily", "gender": "girl", "comfort_offset_f": -2},
        ],
        "thresholds": {"hot": 75, "warm": 65, "cool": 50},
        "refresh_interval_minutes": 30,
        "updates": {"auto_check": True, "auto_install": True, "channel": "dev"},
        "telemetry": {"level": "none"},
        "web_remote": {"enabled": False},
        "display": {"theme": "light"},
        "server": {"port": 5000},
    }
    path.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        # First pass: real config -> dashboard, settings, updates.
        cfg_path = Path(tmp) / "config.yaml"
        _write_config(cfg_path)
        _capture_with_config(cfg_path, [
            ("dashboard.png", "/"),
            ("settings.png", "/settings"),
            ("updates.png", "/settings"),  # same page; updates fieldset visible
        ])
        # Second pass: empty config dir -> setup wizard.
        empty_cfg = Path(tmp) / "missing.yaml"
        _capture_with_config(empty_cfg, [("setup.png", "/setup")])
    return 0


def _capture_with_config(cfg_path: Path, shots: list[tuple[str, str]]) -> None:
    port = _free_port()
    env = {
        **os.environ,
        "OUTFITPI_CONFIG": str(cfg_path),
        "OUTFITPI_PORT": str(port),
        "OUTFITPI_DISABLE_SENTRY": "1",
        "OUTFITPI_DOCS_MODE": "1",
    }
    proc = subprocess.Popen(
        [sys.executable, str(REPO_ROOT / "app.py")],
        cwd=str(REPO_ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        base = f"http://127.0.0.1:{port}"
        _wait_for(f"{base}/api/health", timeout=30)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
            page = ctx.new_page()
            for name, path in shots:
                page.goto(base + path, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(1500)
                if name == "updates.png":
                    page.evaluate(
                        "Array.from(document.querySelectorAll('legend')).find(l => l.textContent.includes('Updates'))?.scrollIntoView()"
                    )
                    page.wait_for_timeout(500)
                out = IMG_DIR / name
                page.screenshot(path=str(out), full_page=False)
                print(f"wrote {out}")
            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
