"""Open-Meteo weather client."""

from __future__ import annotations

import time
from dataclasses import dataclass

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather code mapping → (description, icon name)
WMO_CODES: dict[int, tuple[str, str]] = {
    0: ("Clear sky", "sun"),
    1: ("Mainly clear", "cloud-sun"),
    2: ("Partly cloudy", "cloud-sun"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "cloud-fog"),
    48: ("Rime fog", "cloud-fog"),
    51: ("Light drizzle", "cloud-rain"),
    53: ("Drizzle", "cloud-rain"),
    55: ("Heavy drizzle", "cloud-rain"),
    56: ("Freezing drizzle", "cloud-rain"),
    57: ("Heavy freezing drizzle", "cloud-rain"),
    61: ("Light rain", "cloud-rain"),
    63: ("Rain", "cloud-rain"),
    65: ("Heavy rain", "cloud-rain"),
    66: ("Freezing rain", "cloud-rain"),
    67: ("Heavy freezing rain", "cloud-rain"),
    71: ("Light snow", "cloud-snow"),
    73: ("Snow", "cloud-snow"),
    75: ("Heavy snow", "cloud-snow"),
    77: ("Snow grains", "cloud-snow"),
    80: ("Light showers", "cloud-rain"),
    81: ("Showers", "cloud-rain"),
    82: ("Heavy showers", "cloud-rain"),
    85: ("Snow showers", "cloud-snow"),
    86: ("Heavy snow showers", "cloud-snow"),
    95: ("Thunderstorm", "cloud-lightning"),
    96: ("Thunderstorm with hail", "cloud-lightning"),
    99: ("Severe thunderstorm", "cloud-lightning"),
}

RAIN_CODES = set(range(51, 68)) | {80, 81, 82, 95, 96, 99}
SNOW_CODES = {71, 73, 75, 77, 85, 86}


@dataclass
class CurrentWeather:
    temperature: float
    apparent_temperature: float
    weather_code: int
    description: str
    icon: str
    precipitation: float
    rain: float
    wind_speed: float
    is_day: bool
    humidity: float
    uv_index_max: float | None
    units_temperature: str  # "fahrenheit" | "celsius"
    is_raining: bool
    is_snowing: bool
    fetched_at: float  # unix timestamp
    stale: bool = False


# Module-level cache for offline fallback.
_last_weather: CurrentWeather | None = None


def _describe(code: int) -> tuple[str, str]:
    return WMO_CODES.get(code, ("Unknown", "cloud"))


def _parse(payload: dict, units: str) -> CurrentWeather:
    current = payload.get("current") or {}
    daily = payload.get("daily") or {}
    code = int(current.get("weather_code", 0))
    desc, icon = _describe(code)
    precip = float(current.get("precipitation", 0.0) or 0.0)
    rain_amt = float(current.get("rain", 0.0) or 0.0)
    is_rain = code in RAIN_CODES or precip > 0 or rain_amt > 0
    is_snow = code in SNOW_CODES
    uv_list = daily.get("uv_index_max") or []
    uv = float(uv_list[0]) if uv_list else None

    return CurrentWeather(
        temperature=float(current.get("temperature_2m", 0.0)),
        apparent_temperature=float(current.get("apparent_temperature", 0.0)),
        weather_code=code,
        description=desc,
        icon=icon,
        precipitation=precip,
        rain=rain_amt,
        wind_speed=float(current.get("wind_speed_10m", 0.0)),
        is_day=bool(current.get("is_day", 1)),
        humidity=float(current.get("relative_humidity_2m", 0.0)),
        uv_index_max=uv,
        units_temperature=units,
        is_raining=is_rain,
        is_snowing=is_snow,
        fetched_at=time.time(),
    )


def fetch_current_weather(
    latitude: float, longitude: float, units: str = "fahrenheit"
) -> CurrentWeather | None:
    """Fetch current weather. Returns cached stale data on error, or None if no cache."""
    global _last_weather

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,apparent_temperature,weather_code,precipitation,rain,wind_speed_10m,is_day,relative_humidity_2m",
        "daily": "uv_index_max",
        "temperature_unit": units,
        "wind_speed_unit": "mph",
        "timezone": "auto",
        "forecast_days": 1,
    }
    try:
        resp = httpx.get(OPEN_METEO_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        weather = _parse(resp.json(), units)
        _last_weather = weather
        return weather
    except (httpx.HTTPError, ValueError, KeyError):
        if _last_weather is not None:
            stale = CurrentWeather(**{**_last_weather.__dict__, "stale": True})
            return stale
        return None


def clear_cache() -> None:
    """Clear cached weather (test helper)."""
    global _last_weather
    _last_weather = None
