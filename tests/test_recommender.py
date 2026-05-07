"""Tests for outfitpi.recommender."""

from __future__ import annotations

import time
from dataclasses import replace

import pytest

from outfitpi.config_manager import Child, Thresholds
from outfitpi.recommender import recommend_all, recommend_outfit
from outfitpi.weather import CurrentWeather


def _w(temp_f: float, *, raining=False, snowing=False, stale=False, fetched_at=None) -> CurrentWeather:
    return CurrentWeather(
        temperature=temp_f,
        apparent_temperature=temp_f,
        weather_code=0,
        description="Clear",
        icon="sun",
        precipitation=0.0,
        rain=0.0,
        wind_speed=0.0,
        is_day=True,
        humidity=50.0,
        uv_index_max=5.0,
        units_temperature="fahrenheit",
        is_raining=raining,
        is_snowing=snowing,
        fetched_at=fetched_at if fetched_at is not None else time.time(),
        stale=stale,
    )


@pytest.fixture
def th():
    return Thresholds(hot=75, warm=65, cool=50)


@pytest.mark.parametrize(
    "temp,gender,tier,bottom",
    [
        (90, "boy", "hot", "Shorts"),
        (90, "girl", "hot", "Dress"),
        (70, "boy", "warm", "Shorts"),
        (70, "girl", "warm", "Leggings"),
        (60, "boy", "cool", "Pants"),
        (60, "girl", "cool", "Leggings"),
        (40, "boy", "cold", "Warm pants"),
        (40, "girl", "cold", "Warm pants"),
    ],
)
def test_all_tiers(temp, gender, tier, bottom, th):
    child = Child(name="K", gender=gender)
    rec = recommend_outfit(_w(temp), child, th)
    assert rec.tier_name == tier
    assert rec.bottom == bottom
    assert not rec.unavailable


def test_comfort_offset_shifts_tier(th):
    weather = _w(67)  # base = warm
    runs_cold = Child(name="A", gender="boy", comfort_offset_f=-5)  # 62 → cool
    rec = recommend_outfit(weather, runs_cold, th)
    assert rec.tier_name == "cool"


def test_rain_overlay(th):
    rec = recommend_outfit(_w(72, raining=True), Child(name="B", gender="boy"), th)
    assert rec.rain_alert is not None
    assert "rain" in rec.rain_alert.lower()


def test_snow_alert(th):
    rec = recommend_outfit(_w(20, snowing=True), Child(name="B", gender="girl"), th)
    assert rec.rain_alert is not None
    assert "snow" in rec.rain_alert.lower()


def test_threshold_boundary_inclusive(th):
    # Exactly hot threshold = hot tier.
    rec = recommend_outfit(_w(75), Child(name="K", gender="boy"), th)
    assert rec.tier_name == "hot"


def test_unavailable_when_no_weather(th):
    rec = recommend_outfit(None, Child(name="K", gender="boy"), th)
    assert rec.unavailable
    assert rec.reason


def test_stale_note_in_reason(th):
    weather = _w(72, stale=True, fetched_at=time.time() - 600)
    rec = recommend_outfit(weather, Child(name="K", gender="boy"), th)
    assert "min ago" in rec.reason


def test_recommend_all_handles_multiple(th):
    kids = [Child(name="A", gender="boy"), Child(name="B", gender="girl")]
    recs = recommend_all(_w(72), kids, th)
    assert len(recs) == 2
    assert {r.child_name for r in recs} == {"A", "B"}


def test_celsius_weather_converted(th):
    # 25°C ≈ 77°F → hot
    w = replace(_w(25), units_temperature="celsius")
    rec = recommend_outfit(w, Child(name="K", gender="boy"), th)
    assert rec.tier_name == "hot"
