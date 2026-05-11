"""Outfit recommender."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime

from .config_manager import Child, Thresholds, c_to_f
from .weather import RAIN_CODES, SNOW_CODES, CurrentWeather


@dataclass
class OutfitRecommendation:
    child_name: str
    top: str
    bottom: str
    top_icon: str
    bottom_icon: str
    layer: str | None = None  # deprecated; reserved for backward compat
    layer_icon: str | None = None
    tier_name: str = "cool"  # combined tier used by dashboard for theming
    top_tier: str = "cool"   # "hot" | "warm" | "cool" | "cold"
    bottom_tier: str = "cool"
    rain_alert: str | None = None
    reason: str = ""
    unavailable: bool = False
    is_evening: bool = False


# Evening hours: bedtime guidance instead of outfit.
EVENING_HOUR = 19  # 7 PM
MORNING_HOUR = 6   # before 6 AM also counts as "still bedtime"

# Independent ladders so a kid can end up in T-shirt + Pants on borderline
# days. Legs run cooler than torsos, so the bottom ladder shifts ~5°F warmer.
TOP_OFFSET_F = -5.0     # tops switch to long-sleeve sooner than legs to pants
BOTTOM_OFFSET_F = 5.0   # bottoms warm up earlier than tops cool down


def _top_tier(effective_f: float, thresholds: Thresholds) -> str:
    """Sleeve-length tier. Long-sleeves kick in around `cool + TOP_OFFSET_F`
    so the borderline T-shirt + Pants combo is reachable."""
    if effective_f >= thresholds.hot:
        return "hot"
    if effective_f >= thresholds.warm:
        return "warm"
    if effective_f >= thresholds.cool + TOP_OFFSET_F:
        return "cool"   # still T-shirt
    return "cold"       # long-sleeve


def _bottom_tier(effective_f: float, thresholds: Thresholds) -> str:
    """Leg-coverage tier. Bottoms switch to long pants ~5°F earlier than
    tops switch to long sleeves."""
    if effective_f >= thresholds.hot:
        return "hot"
    if effective_f >= thresholds.warm + BOTTOM_OFFSET_F:
        return "warm"
    if effective_f >= thresholds.cool + BOTTOM_OFFSET_F:
        return "cool"
    return "cold"


_TOPS: dict[str, tuple[str, str]] = {
    "hot":  ("T-shirt", "t-shirt"),
    "warm": ("T-shirt", "t-shirt"),
    "cool": ("T-shirt", "t-shirt"),
    "cold": ("Long sleeves", "long-sleeve-shirt"),
}

_BOTTOMS: dict[tuple[str, str], tuple[str, str]] = {
    ("hot", "boy"):   ("Shorts", "shorts"),
    ("hot", "girl"):  ("Dress", "dress"),
    ("warm", "boy"):  ("Shorts", "shorts"),
    ("warm", "girl"): ("Leggings", "leggings"),
    ("cool", "boy"):  ("Pants", "pants"),
    ("cool", "girl"): ("Leggings", "leggings"),
    ("cold", "boy"):  ("Warm pants", "pants"),
    ("cold", "girl"): ("Warm pants", "pants"),
}


# Order from coolest to warmest for tier-name combination.
_TIER_RANK = {"hot": 3, "warm": 2, "cool": 1, "cold": 0}


def _combined_tier(top_t: str, bottom_t: str) -> str:
    """Pick the cooler of the two tiers for dashboard color theming."""
    return top_t if _TIER_RANK[top_t] <= _TIER_RANK[bottom_t] else bottom_t


def _tier(effective_f: float, thresholds: Thresholds) -> str:
    """Legacy single-ladder tier; kept so existing tests + telemetry tags
    that reference 'tier' still resolve."""
    if effective_f >= thresholds.hot:
        return "hot"
    if effective_f >= thresholds.warm:
        return "warm"
    if effective_f >= thresholds.cool:
        return "cool"
    return "cold"


def _to_fahrenheit(temp: float, unit: str) -> float:
    return temp if unit == "fahrenheit" else c_to_f(temp)


def _format_temp(temp_f: float, display_unit: str) -> str:
    if display_unit == "celsius":
        return f"{(temp_f - 32) * 5 / 9:.0f}°C"
    return f"{temp_f:.0f}°F"


def _stale_suffix(weather: CurrentWeather) -> str:
    age_min = max(1, int((time.time() - weather.fetched_at) / 60))
    return f" (updated {age_min} min ago)"


def _is_evening(weather: CurrentWeather, now: datetime | None = None) -> bool:
    """Return True if it's evening/night (PJ time)."""
    now = now or datetime.now()
    hour = now.hour
    if hour >= EVENING_HOUR or hour < MORNING_HOUR:
        return True
    # Also consider it evening if it's after sunset.
    if weather.sunset:
        try:
            sunset_dt = datetime.fromisoformat(weather.sunset)
            if now >= sunset_dt:
                return True
        except (ValueError, TypeError):
            # Bad sunset string from upstream; fall through to clock check.
            pass
    return False


def recommend_outfit(
    weather: CurrentWeather | None,
    child: Child,
    thresholds: Thresholds,
    display_unit: str = "fahrenheit",
    now: datetime | None = None,
    *,
    force_evening: bool | None = None,
) -> OutfitRecommendation:
    if weather is None:
        return OutfitRecommendation(
            child_name=child.name,
            top="",
            bottom="",
            top_icon="cloud",
            bottom_icon="cloud",
            tier_name="cold",
            rain_alert=None,
            reason="Weather is unavailable right now. We'll try again soon.",
            unavailable=True,
        )

    is_evening = force_evening if force_evening is not None else _is_evening(weather, now)
    if is_evening:
        return OutfitRecommendation(
            child_name=child.name,
            top="Pajamas",
            bottom="Pajamas",
            top_icon="pajamas",
            bottom_icon="pajamas",
            tier_name="pajamas",
            rain_alert=None,
            reason=f"Time for PJs and bed, {child.name}. Sweet dreams!",
            unavailable=False,
            is_evening=True,
        )

    # Drive base-layer recommendations from the afternoon outdoor window
    # (12:00–17:00). Coats and jackets are decided at the door, so we only
    # output top + bottom here.
    forecast_label = "this afternoon feels like"
    if weather.apparent_afternoon is not None:
        forecast_f = _to_fahrenheit(weather.apparent_afternoon, weather.units_temperature)
    elif weather.apparent_max is not None:
        forecast_f = _to_fahrenheit(weather.apparent_max, weather.units_temperature)
        forecast_label = "today's high feels like"
    else:
        forecast_f = _to_fahrenheit(weather.apparent_temperature, weather.units_temperature)
        forecast_label = "it feels like"

    effective_f = forecast_f + child.comfort_offset_f
    top_t = _top_tier(effective_f, thresholds)
    bottom_t = _bottom_tier(effective_f, thresholds)
    tier = _combined_tier(top_t, bottom_t)
    top, top_icon = _TOPS[top_t]
    bottom, bottom_icon = _BOTTOMS[(bottom_t, child.gender)]

    # Precipitation hint shown alongside the forecast (no accessories
    # recommendation; that's a door-decision).
    precip_alert: str | None = None
    aft_code = weather.afternoon_weather_code
    if aft_code in SNOW_CODES or weather.is_snowing:
        precip_alert = "Snow expected this afternoon."
    elif aft_code in RAIN_CODES or weather.is_raining:
        precip_alert = "Rain expected this afternoon."
    elif weather.precip_probability_max and weather.precip_probability_max >= 50:
        precip_alert = f"Chance of precipitation ({int(weather.precip_probability_max)}%)."

    feels_str = _format_temp(forecast_f, display_unit)
    name = child.name
    # Phrase reads off the actual top + bottom chosen, so split-tier days
    # (e.g. T-shirt + Pants) get a sensible sentence.
    tier_phrase = f"{top.lower()} and {bottom.lower()} for you, {name}!"
    if tier == "cold":
        tier_phrase = f"long sleeves and warm pants, {name} — it's chilly!"
    elif tier == "hot" and child.gender == "girl" and bottom_t == "hot":
        tier_phrase = f"a sundress day, {name}!"

    reason = f"{forecast_label.capitalize()} {feels_str} — {tier_phrase}"
    if weather.stale:
        reason += _stale_suffix(weather)

    return OutfitRecommendation(
        child_name=child.name,
        top=top,
        bottom=bottom,
        top_icon=top_icon,
        bottom_icon=bottom_icon,
        tier_name=tier,
        top_tier=top_t,
        bottom_tier=bottom_t,
        rain_alert=precip_alert,
        reason=reason,
        unavailable=False,
    )


def recommend_all(
    weather: CurrentWeather | None,
    children: list[Child],
    thresholds: Thresholds,
    display_unit: str = "fahrenheit",
    now: datetime | None = None,
    *,
    force_evening: bool | None = None,
) -> list[OutfitRecommendation]:
    return [
        recommend_outfit(weather, c, thresholds, display_unit, now, force_evening=force_evening)
        for c in children
    ]
