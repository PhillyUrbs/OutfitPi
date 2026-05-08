"""Local smoke test — starts the Flask app, walks through setup, and verifies key endpoints.

Usage:
    python scripts/smoke_test.py

Exit code 0 = all checks passed, 1 = any failure.

Uses a temporary config file so it doesn't disturb any real config.yaml.
Mocks weather/location to avoid network dependencies.
"""

from __future__ import annotations

import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from contextlib import suppress
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Use a temp config so we don't touch the real one
_tmp_dir = tempfile.mkdtemp(prefix="outfitpi-smoke-")
_tmp_config = Path(_tmp_dir) / "config.yaml"
os.environ["OUTFITPI_CONFIG"] = str(_tmp_config)
os.environ["OUTFITPI_SECRET_KEY"] = "smoke-test-secret"

PORT = int(os.environ.get("SMOKE_PORT", "5555"))
BASE_URL = f"http://127.0.0.1:{PORT}"

PASSED: list[str] = []
FAILED: list[tuple[str, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASSED.append(name)
        print(f"  [PASS] {name}")
    else:
        FAILED.append((name, detail))
        print(f"  [FAIL] {name}  {detail}")


def http_get(path: str, timeout: float = 5.0) -> tuple[int, str]:
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace") if e.fp else ""


def http_post_json(path: str, payload: dict, timeout: float = 5.0) -> tuple[int, str]:
    import json
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace") if e.fp else ""


def wait_for_server(timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{BASE_URL}/setup", timeout=1.0)
            return True
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            time.sleep(0.2)
    return False


def main() -> int:
    print(f"OutfitPi smoke test -> {BASE_URL}")
    print(f"Temp config: {_tmp_config}\n")

    # Build a fake CurrentWeather instance for mocking
    import time as _time

    from outfitpi.location import Location
    from outfitpi.weather import CurrentWeather

    fake_weather = CurrentWeather(
        temperature=72.0,
        apparent_temperature=72.0,
        weather_code=0,
        description="Clear sky",
        icon="sun",
        precipitation=0.0,
        rain=0.0,
        wind_speed=5.0,
        is_day=True,
        humidity=45.0,
        uv_index_max=6.0,
        units_temperature="fahrenheit",
        is_raining=False,
        is_snowing=False,
        fetched_at=_time.time(),
    )
    fake_location = Location(latitude=39.95, longitude=-75.16, source="manual")

    # Patch network-dependent functions in the app module
    import app as app_module

    weather_patcher = patch("app.fetch_current_weather", return_value=fake_weather)
    location_patcher = patch("app.get_location", return_value=fake_location)
    weather_patcher.start()
    location_patcher.start()

    # Disable schedule_restart so endpoints that "restart" don't kill our process
    restart_patcher = patch("app.schedule_restart", return_value=None)
    restart_patcher.start()

    flask_app = app_module.create_app(_tmp_config)
    # Disable CSRF for smoke test (real app keeps it on; tests cover CSRF separately)
    flask_app.config["WTF_CSRF_ENABLED"] = False

    server_thread = threading.Thread(
        target=lambda: flask_app.run(host="127.0.0.1", port=PORT, use_reloader=False, debug=False),
        daemon=True,
    )
    server_thread.start()

    if not wait_for_server():
        print("[FAIL] Server did not start within timeout")
        return 1

    print("Phase 1 — pre-setup state")
    status, body = http_get("/")
    check("GET / redirects to /setup (or setup page renders)", status == 200 or "/setup" in body or "setup" in body.lower())

    status, body = http_get("/setup")
    check("GET /setup returns 200", status == 200)
    check("Setup page contains 'OutfitPi'", "OutfitPi" in body)

    print("\nPhase 2 — complete setup wizard")
    setup_payload = {
        "language": "en",
        "units": {"temperature": "fahrenheit"},
        "location": {
            "latitude": 39.95,
            "longitude": -75.16,
            "auto": False,
            "consent_given": True,
        },
        "children": [
            {"name": "Tommy", "gender": "boy", "comfort_offset_f": 0},
            {"name": "Lily", "gender": "girl", "comfort_offset_f": -3},
        ],
        "thresholds": {"hot": 75, "warm": 65, "cool": 50},
        "updates": {"auto_check": True, "auto_install": False, "channel": "stable"},
        "telemetry": {"level": "none"},
        "web_remote": {"enabled": True},
        "server": {"port": 5000},
    }
    status, body = http_post_json("/api/setup", setup_payload)
    check("POST /api/setup returns 200", status == 200, f"got {status}: {body[:200]}")
    check("config.yaml created", _tmp_config.exists())

    print("\nPhase 3 — main routes after setup")
    status, body = http_get("/")
    check("GET / returns 200 after setup", status == 200)
    check("Index page renders OutfitPi shell", "OutfitPi" in body)

    status, body = http_get("/api/weather")
    check("GET /api/weather returns 200", status == 200)
    import json
    try:
        data = json.loads(body)
        check("Weather JSON has 'weather' key", "weather" in data)
        check("Weather JSON has 'recommendations' key", "recommendations" in data)
        check("Recommendations count matches children (2)", len(data.get("recommendations", [])) == 2)
        # Verify both kids show up
        names = {r.get("child_name") for r in data.get("recommendations", [])}
        check("Tommy in recommendations", "Tommy" in names)
        check("Lily in recommendations", "Lily" in names)
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        check("Weather JSON parses", False, str(e))

    print("\nPhase 4 — settings routes")
    status, body = http_get("/settings")
    check("GET /settings returns 200", status == 200)

    status, body = http_get("/api/settings")
    check("GET /api/settings returns 200", status == 200)
    try:
        data = json.loads(body)
        check("Settings JSON has children", len(data.get("children", [])) == 2)
        check("Settings has thresholds.hot=75", data.get("thresholds", {}).get("hot") == 75)
    except json.JSONDecodeError as e:
        check("Settings JSON parses", False, str(e))

    print("\nPhase 5 — settings save round-trip")
    setup_payload["thresholds"]["hot"] = 80
    status, body = http_post_json("/api/settings", setup_payload)
    check("POST /api/settings returns 200", status == 200, f"got {status}: {body[:200]}")
    status, body = http_get("/api/settings")
    try:
        data = json.loads(body)
        check("Threshold change persisted (hot=80)", data.get("thresholds", {}).get("hot") == 80)
    except json.JSONDecodeError as e:
        check("Settings re-fetch parses", False, str(e))

    print("\nPhase 6 — settings validation")
    bad_payload = dict(setup_payload, children=[])
    status, _ = http_post_json("/api/settings", bad_payload)
    check("POST /api/settings with no children returns 400", status == 400)

    print("\nPhase 7 — utility endpoints")
    status, body = http_get("/api/network-info")
    check("GET /api/network-info returns 200", status == 200)
    try:
        data = json.loads(body)
        check("network-info has lan_ip", "lan_ip" in data)
    except json.JSONDecodeError:
        check("network-info JSON parses", False)

    print("\nPhase 8 — update check (mocked)")
    from outfitpi.updater import UpdateInfo
    with patch("app.check_for_update", return_value=UpdateInfo(available=False, current_version=app_module.__version__)):
        status, body = http_get("/api/update/check")
        check("GET /api/update/check returns 200", status == 200)

    print("\nPhase 9 — rain alert overlay")
    rainy_weather = CurrentWeather(
        temperature=58.0, apparent_temperature=55.0, weather_code=61,
        description="Light rain", icon="cloud-rain", precipitation=2.5, rain=2.5,
        wind_speed=10.0, is_day=True, humidity=85.0, uv_index_max=2.0,
        units_temperature="fahrenheit", is_raining=True, is_snowing=False,
        fetched_at=_time.time(),
    )
    weather_patcher.stop()
    rainy_patcher = patch("app.fetch_current_weather", return_value=rainy_weather)
    rainy_patcher.start()
    status, body = http_get("/api/weather")
    try:
        data = json.loads(body)
        rec = data.get("recommendations", [{}])[0]
        check("Rain alert populated when raining", bool(rec.get("rain_alert")))
    except (json.JSONDecodeError, IndexError):
        check("Rainy weather JSON parses", False)
    rainy_patcher.stop()

    print("\nPhase 10 — offline state")
    offline_patcher = patch("app.fetch_current_weather", return_value=None)
    offline_patcher.start()
    status, body = http_get("/api/weather")
    check("GET /api/weather returns 200 when weather unavailable", status == 200)
    try:
        data = json.loads(body)
        rec = data.get("recommendations", [{}])[0]
        check("Recommendation marked unavailable when no weather", rec.get("unavailable") is True)
    except (json.JSONDecodeError, IndexError):
        check("Offline weather JSON parses", False)
    offline_patcher.stop()

    # Cleanup patches
    location_patcher.stop()
    restart_patcher.stop()

    # Summary
    print(f"\n{'=' * 50}")
    print(f"PASSED: {len(PASSED)}")
    print(f"FAILED: {len(FAILED)}")
    if FAILED:
        print("\nFailures:")
        for name, detail in FAILED:
            print(f"  - {name}  {detail}")
        return 1
    print("\nAll smoke checks passed!")
    return 0


if __name__ == "__main__":
    try:
        rc = main()
    finally:
        # Best-effort cleanup of temp dir
        with suppress(Exception):
            import shutil
            shutil.rmtree(_tmp_dir, ignore_errors=True)
    sys.exit(rc)
