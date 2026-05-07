"""Outfit recommender."""

from __future__ import annotations

import time
from dataclasses import dataclass

from .config_manager import Child, Thresholds, c_to_f
from .weather import CurrentWeather


@dataclass
class OutfitRecommendation:
    child_name: str
    top: str
    bottom: str
    top_icon: str
    bottom_icon: str
    tier_name: str  # "hot" | "warm" | "cool" | "cold"
    rain_alert: str | None
    reason: str
    unavailable: bool = False


# (top, bottom, top_icon, bottom_icon)
_OUTFITS: dict[tuple[str, str], tuple[str, str, str, str]] = {
    ("hot", "boy"): ("T-shirt", "Shorts", "t-shirt", "shorts"),
    ("hot", "girl"): ("T-shirt", "Dress", "t-shirt", "dress"),
    ("warm", "boy"): ("Long sleeves", "Shorts", "long-sleeve-shirt", "shorts"),
    ("warm", "girl"): ("T-shirt", "Leggings", "t-shirt", "leggings"),
    ("cool", "boy"): ("Long sleeves", "Pants", "long-sleeve-shirt", "pants"),
    ("cool", "girl"): ("Long sleeves", "Leggings", "long-sleeve-shirt", "leggings"),
    ("cold", "boy"): ("Long sleeves", "Warm pants", "long-sleeve-shirt", "pants"),
    ("cold", "girl"): ("Long sleeves", "Warm pants", "long-sleeve-shirt", "pants"),
}


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


def recommend_outfit(
    weather: CurrentWeather | None,
    child: Child,
    thresholds: Thresholds,
    display_unit: str = "fahrenheit",
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

    feels_like_f = _to_fahrenheit(weather.apparent_temperature, weather.units_temperature)
    effective_f = feels_like_f + child.comfort_offset_f
    tier = _tier(effective_f, thresholds)
    top, bottom, top_icon, bottom_icon = _OUTFITS[(tier, child.gender)]

    rain_alert = None
    if weather.is_raining:
        rain_alert = "It's rainy — grab a raincoat and rain boots!"
    elif weather.is_snowing:
        rain_alert = "It's snowy — bundle up and wear snow boots!"

    feels_str = _format_temp(feels_like_f, display_unit)
    name = child.name
    tier_phrase = {
        "hot": f"shorts and a t-shirt day, {name}!" if child.gender == "boy" else f"a sundress day, {name}!",
        "warm": f"long sleeves and shorts for you, {name}!" if child.gender == "boy" else f"leggings and a t-shirt for you, {name}!",
        "cool": f"long sleeves and pants today, {name}!" if child.gender == "boy" else f"long sleeves and leggings today, {name}!",
        "cold": f"warm pants and long sleeves, {name} — it's chilly!",
    }[tier]

    reason = f"It feels like {feels_str} — {tier_phrase}"
    if weather.stale:
        reason += _stale_suffix(weather)

    return OutfitRecommendation(
        child_name=child.name,
        top=top,
        bottom=bottom,
        top_icon=top_icon,
        bottom_icon=bottom_icon,
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
) -> list[OutfitRecommendation]:
    return [recommend_outfit(weather, c, thresholds, display_unit) for c in children]
