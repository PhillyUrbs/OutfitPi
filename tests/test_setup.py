"""Tests for first-run setup wizard."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

import app as app_module


@pytest.fixture(autouse=True)
def _mock_schedule_restart():
    with patch("app.schedule_restart") as m:
        yield m


@pytest.fixture
def fresh_app(tmp_path: Path):
    cfg_path = tmp_path / "config.yaml"
    flask_app = app_module.create_app(cfg_path)
    flask_app.config["TESTING"] = True
    flask_app.config["WTF_CSRF_ENABLED"] = False
    return flask_app, cfg_path


@pytest.fixture
def fresh_client(fresh_app):
    flask_app, _ = fresh_app
    return flask_app.test_client()


def test_root_redirects_to_setup_when_no_config(fresh_client):
    resp = fresh_client.get("/", follow_redirects=False)
    assert resp.status_code == 302
    assert "/setup" in resp.headers["Location"]


def test_settings_redirects_to_setup_when_no_config(fresh_client):
    resp = fresh_client.get("/settings", follow_redirects=False)
    assert resp.status_code == 302
    assert "/setup" in resp.headers["Location"]


def test_setup_page_returns_200_when_no_config(fresh_client):
    resp = fresh_client.get("/setup")
    assert resp.status_code == 200


def test_static_files_still_served_during_setup(fresh_client):
    # Static endpoint should not redirect even without config
    resp = fresh_client.get("/static/css/style.css")
    # Either 200 (file exists) or 404 (file missing) — never 302
    assert resp.status_code != 302


def test_api_setup_creates_config(fresh_app, fresh_client):
    flask_app, cfg_path = fresh_app
    payload = {
        "language": "en",
        "units": {"temperature": "fahrenheit"},
        "location": {
            "latitude": 39.95,
            "longitude": -75.16,
            "auto": False,
            "consent_given": True,
        },
        "children": [{"name": "Tommy", "gender": "boy", "comfort_offset_f": 0}],
        "thresholds": {"hot": 75, "warm": 65, "cool": 50},
        "updates": {"auto_check": True, "auto_install": False, "channel": "stable"},
        "telemetry": {"level": "none"},
        "web_remote": {"enabled": False},
    }
    resp = fresh_client.post("/api/setup", json=payload)
    assert resp.status_code == 200
    assert cfg_path.exists()


def test_api_setup_rejects_no_children(fresh_client):
    payload = {"children": []}
    resp = fresh_client.post("/api/setup", json=payload)
    assert resp.status_code == 400


def test_api_setup_consent_declined_persists(fresh_app, fresh_client):
    _, cfg_path = fresh_app
    payload = {
        "location": {
            "latitude": 39.95,
            "longitude": -75.16,
            "auto": False,
            "consent_given": False,
        },
        "children": [{"name": "X", "gender": "boy"}],
    }
    resp = fresh_client.post("/api/setup", json=payload)
    assert resp.status_code == 200
    from outfitpi.config_manager import load_config
    cfg = load_config(cfg_path)
    assert cfg.location.auto is False
    assert cfg.location.consent_given is False


def test_api_setup_consent_accepted_persists(fresh_app, fresh_client):
    _, cfg_path = fresh_app
    payload = {
        "location": {"auto": True, "consent_given": True},
        "children": [{"name": "X", "gender": "boy"}],
    }
    resp = fresh_client.post("/api/setup", json=payload)
    assert resp.status_code == 200
    from outfitpi.config_manager import load_config
    cfg = load_config(cfg_path)
    assert cfg.location.auto is True
    assert cfg.location.consent_given is True


def test_after_setup_no_redirect(fresh_app):
    flask_app, cfg_path = fresh_app
    client = flask_app.test_client()
    payload = {
        "location": {"latitude": 39.95, "longitude": -75.16},
        "children": [{"name": "Tommy", "gender": "boy"}],
    }
    client.post("/api/setup", json=payload)
    # Now / should NOT redirect (config exists)
    from unittest.mock import MagicMock
    with (
        patch("app.fetch_current_weather", return_value=None),
        patch("app.get_location", return_value=MagicMock(latitude=39.95, longitude=-75.16)),
    ):
        resp = client.get("/", follow_redirects=False)
    assert resp.status_code == 200
