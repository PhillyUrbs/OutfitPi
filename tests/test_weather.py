"""Tests for outfitpi.weather."""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import httpx
import pytest

from outfitpi import weather as weather_mod
from outfitpi.weather import (
    RAIN_CODES,
    SNOW_CODES,
    WMO_CODES,
    clear_cache,
    fetch_current_weather,
)

SAMPLE = {
    "current": {
        "temperature_2m": 72.5,
        "apparent_temperature": 70.0,
        "weather_code": 3,
        "precipitation": 0,
        "rain": 0,
        "wind_speed_10m": 5,
        "is_day": 1,
        "relative_humidity_2m": 50,
    },
    "daily": {"uv_index_max": [6.0]},
}


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def _mock_response(payload, status=200):
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = payload
    resp.status_code = status
    resp.raise_for_status = MagicMock()
    return resp


def test_parse_basic():
    with patch.object(weather_mod.httpx, "get", return_value=_mock_response(SAMPLE)):
        w = fetch_current_weather(40.0, -75.0, "fahrenheit")
    assert w is not None
    assert w.temperature == pytest.approx(72.5)
    assert w.apparent_temperature == pytest.approx(70.0)
    assert w.weather_code == 3
    assert w.description == "Overcast"
    assert w.icon == "cloud"
    assert w.units_temperature == "fahrenheit"
    assert not w.is_raining
    assert not w.is_snowing
    assert not w.stale


def test_wmo_mapping_complete():
    for code in (0, 1, 3, 45, 61, 71, 95):
        assert code in WMO_CODES


def test_is_raining_via_code():
    payload = {**SAMPLE, "current": {**SAMPLE["current"], "weather_code": 61}}
    with patch.object(weather_mod.httpx, "get", return_value=_mock_response(payload)):
        w = fetch_current_weather(0, 0)
    assert w.is_raining
    assert 61 in RAIN_CODES


def test_is_snowing_via_code():
    payload = {**SAMPLE, "current": {**SAMPLE["current"], "weather_code": 73}}
    with patch.object(weather_mod.httpx, "get", return_value=_mock_response(payload)):
        w = fetch_current_weather(0, 0)
    assert w.is_snowing
    assert 73 in SNOW_CODES


def test_is_raining_via_precipitation():
    payload = {**SAMPLE, "current": {**SAMPLE["current"], "precipitation": 0.5}}
    with patch.object(weather_mod.httpx, "get", return_value=_mock_response(payload)):
        w = fetch_current_weather(0, 0)
    assert w.is_raining


def test_failure_returns_cached_stale():
    # Prime the cache.
    with patch.object(weather_mod.httpx, "get", return_value=_mock_response(SAMPLE)):
        first = fetch_current_weather(0, 0)
    # Backdate the cache so the stale flag and timing logic exercise.
    weather_mod._last_weather.fetched_at = time.time() - 600
    # Now simulate a failure.
    with patch.object(weather_mod.httpx, "get", side_effect=httpx.HTTPError("boom")):
        second = fetch_current_weather(0, 0)
    assert second is not None
    assert second.stale
    assert second.temperature == first.temperature


def test_failure_with_no_cache_returns_none():
    clear_cache()
    with patch.object(weather_mod.httpx, "get", side_effect=httpx.HTTPError("boom")):
        result = fetch_current_weather(0, 0)
    assert result is None
