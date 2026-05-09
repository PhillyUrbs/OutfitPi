"""Location resolution: explicit coords or IP geolocation (opt-in)."""

from __future__ import annotations

import re
import urllib.parse
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


ZIPPOPOTAM_URL = "https://api.zippopotam.us/{country}/{zip}"

# Strict allowlists so user-supplied path segments can't reach beyond
# the intended host. Country: ISO 3166-1 alpha-2. Zip: digits, letters,
# space, dash — covers US/CA/UK/etc. without allowing slashes or dots.
_COUNTRY_RE = re.compile(r"^[a-z]{2}$")
_ZIP_RE = re.compile(r"^[A-Za-z0-9 \-]{3,12}$")


def geocode_zip(country: str, zip_code: str) -> Location:
    """Resolve a postal code to lat/lon via Zippopotam.us (free, no key).

    `country` is a 2-letter ISO code (e.g. "us", "ca", "de").
    """
    country = (country or "us").strip().lower()
    zip_code = (zip_code or "").strip()
    if not zip_code:
        raise LocationServiceError("Postal code is required.")
    if not _COUNTRY_RE.match(country):
        raise LocationServiceError(f"Invalid country code: {country!r}.")
    if not _ZIP_RE.match(zip_code):
        raise LocationServiceError(f"Invalid postal code format: {zip_code!r}.")
    # Percent-encode just in case (after format check above).
    url = ZIPPOPOTAM_URL.format(
        country=urllib.parse.quote(country, safe=""),
        zip=urllib.parse.quote(zip_code, safe=""),
    )
    try:
        resp = httpx.get(url, timeout=10.0)
        if resp.status_code == 404:
            raise LocationServiceError(f"Postal code {zip_code!r} not found in {country.upper()}.")
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise LocationServiceError(f"Postal code lookup failed: {exc}") from exc

    places = data.get("places") or []
    if not places:
        raise LocationServiceError(f"No places found for postal code {zip_code!r}.")
    p = places[0]
    return Location(
        latitude=float(p["latitude"]),
        longitude=float(p["longitude"]),
        city=p.get("place name"),
        region=p.get("state") or p.get("state abbreviation"),
        country=data.get("country"),
        source="zip",
    )
