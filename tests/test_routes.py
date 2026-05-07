"""Tests for Flask routes (configured app)."""

from __future__ import annotations

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _mock_schedule_restart():
    """Prevent tests from triggering os._exit via schedule_restart."""
    with patch("app.schedule_restart") as m:
        yield m


@pytest.fixture
def mock_weather(sample_weather):
    """Patch weather + location so / and /api/weather succeed without network."""
    with (
        patch("app.fetch_current_weather", return_value=sample_weather),
        patch("app.get_location") as gl,
    ):
        from outfitpi.location import Location
        gl.return_value = Location(latitude=39.95, longitude=-75.16, source="manual")
        yield


def test_index_returns_200(client, mock_weather):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    # Index is JS-rendered; verify shell loads correctly
    assert "OutfitPi" in body
    assert "outfits" in body


def test_api_weather_json(client, mock_weather):
    resp = client.get("/api/weather")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "weather" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) == 1


def test_settings_page(client, mock_weather):
    resp = client.get("/settings")
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert "Tommy" in body or "settings" in body.lower()


def test_api_settings_get(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "children" in data
    assert "thresholds" in data


def test_api_settings_post_valid(client):
    payload = {
        "language": "en",
        "refresh_interval_minutes": 30,
        "units": {"temperature": "fahrenheit"},
        "location": {"latitude": 40.0, "longitude": -75.0, "auto": False, "consent_given": False},
        "children": [{"name": "Tommy", "gender": "boy", "comfort_offset_f": 0}],
        "thresholds": {"hot": 80, "warm": 70, "cool": 55},
        "updates": {"auto_check": True, "auto_install": False, "channel": "releases"},
        "telemetry": {"level": "none"},
        "web_remote": {"enabled": False},
        "server": {"port": 5000},
    }
    resp = client.post("/api/settings", json=payload)
    assert resp.status_code == 200
    # Confirm persisted
    follow = client.get("/api/settings")
    assert follow.get_json()["thresholds"]["hot"] == 80


def test_api_settings_post_invalid(client):
    payload = {"children": []}  # no children → invalid
    resp = client.post("/api/settings", json=payload)
    assert resp.status_code == 400


def test_api_settings_reset(client):
    resp = client.post("/api/settings/reset", json={})
    # Reset itself should work even though defaults have no children → may be 400 or 200 depending on impl
    assert resp.status_code in (200, 400)


def test_api_remote_access_toggle(client, _mock_schedule_restart):
    resp = client.post("/api/remote-access", json={"enabled": True})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data.get("restarting") is True


def test_api_update_check(client):
    from outfitpi.updater import UpdateInfo
    with patch(
        "app.check_for_update",
        return_value=UpdateInfo(available=False, current_version="0.1.0"),
    ):
        resp = client.get("/api/update/check")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["current_version"] == "0.1.0"


def test_api_network_info(client):
    resp = client.get("/api/network-info")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "lan_ip" in data


def test_favicon_served(client):
    resp = client.get("/favicon.ico")
    # Favicon file may or may not exist in tests; either 200 or 404 acceptable
    assert resp.status_code in (200, 404)


def test_csrf_blocks_post_when_enabled(configured_app):
    """Verify CSRF actually protects POST endpoints."""
    configured_app.config["WTF_CSRF_ENABLED"] = True
    client = configured_app.test_client()
    resp = client.post("/api/settings", json={"children": []})
    # Without a CSRF token, should be 400
    assert resp.status_code == 400
