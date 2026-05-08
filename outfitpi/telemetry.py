"""Sentry telemetry init with PII scrubbing."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

SENTRY_DSN = "https://decc72ee385e5c1c3dafc6a7786a32e9@o4511346280169472.ingest.us.sentry.io/4511346286723072"

_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_LATLON_RE = re.compile(r"-?\d{1,3}\.\d{2,}")


def _detect_environment() -> str:
    return "production" if os.environ.get("INVOCATION_ID") else "development"


def _scrub_string(s: str, child_names: list[str]) -> str:
    s = _IP_RE.sub("[ip]", s)
    s = _LATLON_RE.sub("[coord]", s)
    for name in child_names:
        if name:
            s = re.sub(rf"\b{re.escape(name)}\b", "[child]", s, flags=re.IGNORECASE)
    return s


def _scrub_value(value: Any, child_names: list[str]) -> Any:
    if isinstance(value, str):
        return _scrub_string(value, child_names)
    if isinstance(value, dict):
        return {k: _scrub_value(v, child_names) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub_value(v, child_names) for v in value]
    return value


def _make_before_send(child_names_provider):
    def before_send(event: dict, hint: dict) -> dict | None:
        try:
            names = child_names_provider() or []
            # Drop user identification.
            event.pop("user", None)
            # Scrub request data.
            request = event.get("request") or {}
            request.pop("env", None)
            for key in ("data", "query_string", "cookies", "headers"):
                if key in request:
                    request[key] = _scrub_value(request[key], names)
            # Scrub message + exception values.
            if "message" in event:
                event["message"] = _scrub_value(event["message"], names)
            for ex in (event.get("exception", {}) or {}).get("values", []) or []:
                if "value" in ex:
                    ex["value"] = _scrub_string(str(ex["value"]), names)
            # Scrub extra/contexts.
            for key in ("extra", "contexts", "tags"):
                if key in event:
                    event[key] = _scrub_value(event[key], names)
        except Exception:  # noqa: BLE001
            # Never let scrubbing break event delivery.
            pass
        return event

    return before_send


def init_sentry(level: str, version: str, child_names_provider) -> None:
    """Initialize Sentry if level is 'errors' or 'full'.

    `child_names_provider` is a callable returning the current list of child names
    (so updates take effect without restart).
    """
    if level not in {"errors", "full"}:
        return
    # Never run telemetry under pytest; the SDK installs an atexit hook that
    # flushes events and forces a non-zero exit code on Python 3.13.
    if "PYTEST_CURRENT_TEST" in os.environ or os.environ.get("OUTFITPI_DISABLE_SENTRY"):
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.flask import FlaskIntegration
    except ImportError:
        logger.warning("sentry-sdk not installed; telemetry disabled")
        return

    traces_rate = 0.0 if level == "errors" else 0.1
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FlaskIntegration()],
        environment=_detect_environment(),
        release=f"outfitpi@{version}",
        traces_sample_rate=traces_rate,
        send_default_pii=False,
        before_send=_make_before_send(child_names_provider),
    )
    logger.info("Sentry initialized (level=%s, env=%s)", level, _detect_environment())
