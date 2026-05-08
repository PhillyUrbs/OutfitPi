"""Outfit recommender."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime

from .config_manager import Child, Thresholds, c_to_f
from .weather import CurrentWeather


@dataclass
class OutfitRecommendation:
    child_name: str
    top: str
    bottom: str
    top_icon: str
    bottom_icon: str
    layer: str | None = None  # e.g. "Jacket"
    layer_icon: str | None = None
    tier_name: str = "cool"  # "hot" | "warm" | "cool" | "cold" | "pajamas"
    rain_alert: str | None = None
    reason: str = ""
    unavailable: bool = False
    is_evening: bool = False


# (top, bottom, top_icon, bottom_icon)
_OUTFITS: dict[tuple[str, str], tuple[str, str, str, str]] = {
    ("hot", "boy"): ("T-shirt", "Shorts", "t-shirt", "shorts"),
    ("hot", "girl"): ("T-shirt", "Dress", "t-shirt", "dress"),
    ("warm", "boy"): ("T-shirt", "Shorts", "t-shirt", "shorts"),
    ("warm", "girl"): ("T-shirt", "Leggings", "t-shirt", "leggings"),
    ("cool", "boy"): ("Long sleeves", "Pants", "long-sleeve-shirt", "pants"),
    ("cool", "girl"): ("Long sleeves", "Leggings", "long-sleeve-shirt", "leggings"),
    ("cold", "boy"): ("Long sleeves", "Warm pants", "long-sleeve-shirt", "pants"),
    ("cold", "girl"): ("Long sleeves", "Warm pants", "long-sleeve-shirt", "pants"),
}


# Evening hours: bedtime guidance instead of outfit.
EVENING_HOUR = 19  # 7 PM
MORNING_HOUR = 6   # before 6 AM also counts as "still bedtime"


def _tier(effective_f: float, thresholds: Thresholds) -> str:
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

    # Use the day's apparent peak temperature for outfit choice (so kids dress
    # for the warmest part of the day, not the chilly morning).
    if weather.apparent_max is not None:
        forecast_f = _to_fahrenheit(weather.apparent_max, weather.units_temperature)
        forecast_label = "today's high feels like"
    else:
        forecast_f = _to_fahrenheit(weather.apparent_temperature, weather.units_temperature)
        forecast_label = "it feels like"

    effective_f = forecast_f + child.comfort_offset_f
    tier = _tier(effective_f, thresholds)
    top, bottom, top_icon, bottom_icon = _OUTFITS[(tier, child.gender)]

    # Add a jacket layer when cold or when morning low is much cooler than day high.
    layer: str | None = None
    layer_icon: str | None = None
    if tier == "cold":
        layer, layer_icon = "Jacket", "jacket"
    elif weather.apparent_min is not None:
        morning_f = _to_fahrenheit(weather.apparent_min, weather.units_temperature) + child.comfort_offset_f
        if morning_f < thresholds.cool:
            layer, layer_icon = "Light jacket", "jacket"

    rain_alert = None
    if weather.is_raining:
        rain_alert = "Rain expected — grab a raincoat and rain boots!"
    elif weather.is_snowing:
        rain_alert = "Snow expected — bundle up and wear snow boots!"
    elif weather.precip_probability_max and weather.precip_probability_max >= 50:
        rain_alert = f"Chance of rain ({int(weather.precip_probability_max)}%) — pack a raincoat just in case."

    feels_str = _format_temp(forecast_f, display_unit)
    name = child.name
    tier_phrase = {
        "hot": f"shorts and a t-shirt day, {name}!" if child.gender == "boy" else f"a sundress day, {name}!",
        "warm": f"t-shirt and shorts for you, {name}!" if child.gender == "boy" else f"leggings and a t-shirt for you, {name}!",
        "cool": f"long sleeves and pants today, {name}!" if child.gender == "boy" else f"long sleeves and leggings today, {name}!",
        "cold": f"warm pants and a jacket, {name} — it's chilly!",
    }[tier]

    reason = f"{forecast_label.capitalize()} {feels_str} — {tier_phrase}"
    if weather.stale:
        reason += _stale_suffix(weather)

    return OutfitRecommendation(
        child_name=child.name,
        top=top,
        bottom=bottom,
        top_icon=top_icon,
        bottom_icon=bottom_icon,
        layer=layer,
        layer_icon=layer_icon,
        tier_name=tier,
        rain_alert=rain_alert,
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
