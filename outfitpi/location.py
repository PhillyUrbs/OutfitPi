"""Location resolution: explicit coords or IP geolocation (opt-in)."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from .config_manager import Config

IP_API_URL = "http://ip-api.com/json/"

_cache: Location | None = None


class LocationError(Exception):
    """Base location error."""


class LocationNotConfiguredError(LocationError):
    """Raised when no location source is available."""


class LocationServiceError(LocationError):
    """Raised when the IP geolocation service fails."""


@dataclass
class Location:
    latitude: float
    longitude: float
    city: str | None = None
    region: str | None = None
    country: str | None = None
    source: str = "manual"  # "manual" | "ip"


def _fetch_ip_location() -> Location:
    try:
        resp = httpx.get(IP_API_URL, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise LocationServiceError(f"IP geolocation failed: {exc}") from exc

    if data.get("status") != "success":
        raise LocationServiceError(f"IP geolocation rejected: {data.get('message')}")

    return Location(
        latitude=float(data["lat"]),
        longitude=float(data["lon"]),
        city=data.get("city"),
        region=data.get("regionName"),
        country=data.get("country"),
        source="ip",
    )


def get_location(config: Config, *, force_refresh: bool = False) -> Location:
    """Resolve location from config or IP geolocation. Caches for process lifetime."""
    global _cache

    loc_cfg = config.location
    if loc_cfg.latitude is not None and loc_cfg.longitude is not None:
        return Location(
            latitude=float(loc_cfg.latitude),
            longitude=float(loc_cfg.longitude),
            source="manual",
        )

    if not force_refresh and _cache is not None:
        return _cache

    if loc_cfg.auto and loc_cfg.consent_given:
        loc = _fetch_ip_location()
        _cache = loc
        return loc

    raise LocationNotConfiguredError(
        "No location set. Provide latitude/longitude or enable auto-detect with consent."
    )


def clear_cache() -> None:
    """Clear cached location (used for tests and re-detection)."""
    global _cache
    _cache = None
