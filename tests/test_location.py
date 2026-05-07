"""Tests for outfitpi.location."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from outfitpi.config_manager import Config
from outfitpi.config_manager import Location as LocCfg
from outfitpi.location import (
    LocationNotConfiguredError,
    LocationServiceError,
    clear_cache,
    get_location,
)


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def _config(**loc_kwargs) -> Config:
    return Config(location=LocCfg(**loc_kwargs))


def test_explicit_coords_returns_directly():
    cfg = _config(latitude=39.95, longitude=-75.16)
    loc = get_location(cfg)
    assert loc.latitude == 39.95
    assert loc.longitude == -75.16
    assert loc.source == "manual"


def test_no_consent_raises():
    cfg = _config(auto=True, consent_given=False)
    with pytest.raises(LocationNotConfiguredError):
        get_location(cfg)


def test_no_auto_raises():
    cfg = _config(auto=False, consent_given=True)
    with pytest.raises(LocationNotConfiguredError):
        get_location(cfg)


def test_ip_geolocation_success():
    cfg = _config(auto=True, consent_given=True)
    fake_resp = MagicMock()
    fake_resp.json.return_value = {
        "status": "success",
        "lat": 39.95,
        "lon": -75.16,
        "city": "Philadelphia",
        "regionName": "Pennsylvania",
        "country": "United States",
    }
    fake_resp.raise_for_status = MagicMock()
    with patch("outfitpi.location.httpx.get", return_value=fake_resp):
        loc = get_location(cfg)
    assert loc.city == "Philadelphia"
    assert loc.region == "Pennsylvania"
    assert loc.source == "ip"


def test_ip_geolocation_http_failure():
    cfg = _config(auto=True, consent_given=True)
    with patch("outfitpi.location.httpx.get", side_effect=httpx.ConnectError("boom")), pytest.raises(LocationServiceError):
        get_location(cfg)


def test_ip_geolocation_api_failure_status():
    cfg = _config(auto=True, consent_given=True)
    fake_resp = MagicMock()
    fake_resp.json.return_value = {"status": "fail", "message": "private range"}
    fake_resp.raise_for_status = MagicMock()
    with patch("outfitpi.location.httpx.get", return_value=fake_resp), pytest.raises(LocationServiceError):
        get_location(cfg)


def test_caches_ip_result():
    cfg = _config(auto=True, consent_given=True)
    fake_resp = MagicMock()
    fake_resp.json.return_value = {
        "status": "success",
        "lat": 1.0,
        "lon": 2.0,
        "city": "Nowhere",
        "regionName": "X",
        "country": "Y",
    }
    fake_resp.raise_for_status = MagicMock()
    with patch("outfitpi.location.httpx.get", return_value=fake_resp) as mock_get:
        get_location(cfg)
        get_location(cfg)
    assert mock_get.call_count == 1
