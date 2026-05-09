"""Sentry telemetry init with PII scrubbing."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

SENTRY_DSN = "https://decc72ee385e5c1c3dafc6a7786a32e9@o4511346280169472.ingest.us.sentry.io/4511346286723072"

# Active level after init; gates the helper functions below.
# "none" | "errors" | "full"
_active_level: str = "none"

_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_LATLON_RE = re.compile(r"-?\d{1,3}\.\d{2,}")


def _detect_environment() -> str:
    return "production" if os.environ.get("INVOCATION_ID") else "development"


def _release_string(version: str, channel: str | None, repo_path: str | None) -> str:
    """Build the Sentry release identifier.

    - stable: outfitpi@X.Y.Z (matches the published tag)
    - dev/beta: outfitpi@X.Y.Z+sha.<short>  so each commit is its own
      release in Sentry. This makes regression hunting precise on
      channels where __version__ doesn't change per commit.
    """
    base = f"outfitpi@{version}"
    if channel not in {"dev", "beta"} or not repo_path:
        return base
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "--short=7", "HEAD"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
        sha = result.stdout.strip()
        if sha:
            return f"{base}+sha.{sha}"
    except Exception:  # noqa: BLE001
        pass
    return base


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


def init_sentry(
    level: str,
    version: str,
    child_names_provider,
    *,
    channel: str | None = None,
    repo_path: str | None = None,
) -> None:
    """Initialize Sentry if level is 'errors' or 'full'.

    `child_names_provider` is a callable returning the current list of child names
    (so updates take effect without restart). `channel` and `repo_path` let us
    augment the release id with a git SHA for dev/beta builds.
    """
    global _active_level
    _active_level = "none"
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
    release = _release_string(version, channel, repo_path)
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FlaskIntegration()],
        environment=_detect_environment(),
        release=release,
        traces_sample_rate=traces_rate,
        send_default_pii=False,
        # Release-health: count user sessions per release for crash-free %.
        auto_session_tracking=True,
        before_send=_make_before_send(child_names_provider),
    )
    _active_level = level
    logger.info("Sentry initialized (level=%s, env=%s, release=%s)",
                level, _detect_environment(), release)


def set_tags(tags: dict[str, Any]) -> None:
    """Attach long-lived tags (channel, theme, kiosk, etc.) to all events."""
    if _active_level == "none":
        return
    try:
        import sentry_sdk
        for k, v in tags.items():
            if v is None:
                continue
            sentry_sdk.set_tag(k, str(v))
    except Exception:  # noqa: BLE001
        pass


def breadcrumb(category: str, message: str, level: str = "info", **data: Any) -> None:
    """Attach a breadcrumb. No-op unless telemetry == full.

    Breadcrumbs add ~zero data when no event fires; on an event they give
    you the timeline of state changes that led up to it.
    """
    if _active_level != "full":
        return
    try:
        import sentry_sdk
        sentry_sdk.add_breadcrumb(
            category=category,
            message=message,
            level=level,
            data={k: v for k, v in data.items() if v is not None} or None,
        )
    except Exception:  # noqa: BLE001
        pass


def capture_exception(exc: BaseException, **tags: Any) -> None:
    """Send an exception that we caught (so it isn't dropped on the floor).

    Active for both 'errors' and 'full' levels.
    """
    if _active_level == "none":
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for k, v in tags.items():
                if v is not None:
                    scope.set_tag(k, str(v))
            sentry_sdk.capture_exception(exc)
    except Exception:  # noqa: BLE001
        pass


def capture_message(message: str, level: str = "info", **tags: Any) -> None:
    """Send an explicit message event. Active when telemetry == full."""
    if _active_level != "full":
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for k, v in tags.items():
                if v is not None:
                    scope.set_tag(k, str(v))
            sentry_sdk.capture_message(message, level=level)
    except Exception:  # noqa: BLE001
        pass
