"""OutfitPi Flask application."""

from __future__ import annotations

import logging
import os
import secrets
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from flask_babel import Babel
from flask_wtf.csrf import CSRFError, CSRFProtect, generate_csrf

from outfitpi import __version__
from outfitpi.config_manager import (
    Child,
    Config,
    ConfigError,
    Display,
    Server,
    Thresholds,
    Units,
    Updates,
    WebRemote,
    _normalize_channel,
    config_exists,
    load_config,
    save_config,
    validate_config,
)
from outfitpi.config_manager import (
    Location as LocationCfg,
)
from outfitpi.config_manager import (
    Telemetry as TelemetryCfg,
)
from outfitpi.location import (
    LocationError,
    LocationNotConfiguredError,
    geocode_zip,
    get_location,
)
from outfitpi.location import (
    clear_cache as clear_location_cache,
)
from outfitpi.network_utils import get_lan_ip
from outfitpi.recommender import recommend_all
from outfitpi.telemetry import (
    breadcrumb as _breadcrumb,
)
from outfitpi.telemetry import (
    capture_exception as _capture_exc,
)
from outfitpi.telemetry import (
    capture_message as _capture_msg,
)
from outfitpi.telemetry import (
    init_sentry,
)
from outfitpi.telemetry import (
    set_tags as _set_tags,
)
from outfitpi.updater import check_for_update, detect_repo, is_valid_ref, list_refs, perform_update
from outfitpi.weather import fetch_current_weather

# ── Paths ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("OUTFITPI_CONFIG", BASE_DIR / "config.yaml"))

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.environ.get("OUTFITPI_LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("outfitpi")

# Process-start timestamp; surfaced via /api/health so dashboards can
# reload themselves after a service restart (also drops any stale CSRF
# token they were holding from before the restart).
_STARTED_AT = int(time.time())


def _load_or_create_secret_key(cfg_path: Path) -> str:
    """Return a stable Flask secret key.

    Order of precedence:
      1. ``OUTFITPI_SECRET_KEY`` env var (operator override).
      2. ``.secret_key`` file alongside the config; created on first run.
    Without this, a new random key is generated at every process start
    and every CSRF token already in the user's open kiosk page is
    invalidated, producing "CSRF token missing or invalid" on the next
    save.
    """
    env = os.environ.get("OUTFITPI_SECRET_KEY")
    if env:
        return env
    key_path = cfg_path.parent / ".secret_key"
    try:
        if key_path.exists():
            existing = key_path.read_text(encoding="utf-8").strip()
            if existing:
                return existing
        key_path.parent.mkdir(parents=True, exist_ok=True)
        new_key = secrets.token_hex(32)
        key_path.write_text(new_key, encoding="utf-8")
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
        return new_key
    except OSError as exc:
        logger.warning("Could not persist secret key (%s); using ephemeral", exc)
        return secrets.token_hex(32)


def create_app(config_path: Path | None = None) -> Flask:
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "templates"),
        static_folder=str(BASE_DIR / "static"),
    )
    app.config["SECRET_KEY"] = _load_or_create_secret_key(cfg_path)
    app.config["CONFIG_PATH"] = cfg_path
    app.config["BABEL_DEFAULT_LOCALE"] = "en"
    app.config["BABEL_TRANSLATION_DIRECTORIES"] = str(BASE_DIR / "translations")
    # Disable CSRF token expiry: this is a long-running kiosk page that
    # may sit open all day; with the default 1h limit, the first slider
    # change after lunch fails with "CSRF token missing or invalid".
    app.config["WTF_CSRF_TIME_LIMIT"] = None

    CSRFProtect(app)

    def _select_locale() -> str:
        try:
            cfg = load_config(cfg_path)
            return cfg.language or "en"
        except Exception:  # noqa: BLE001
            return "en"

    Babel(app, locale_selector=_select_locale)

    # ── Telemetry init ────────────────────────────────────────────────────
    if config_exists(cfg_path):
        try:
            cfg = load_config(cfg_path)
            init_sentry(
                cfg.telemetry.level,
                __version__,
                lambda: [c.name for c in load_config(cfg_path).children],
                channel=cfg.updates.channel,
                repo_path=str(BASE_DIR),
            )
            _set_tags({
                "channel": cfg.updates.channel,
                "theme": cfg.display.theme,
                "units": cfg.units.temperature,
                "remote_access": cfg.web_remote.enabled,
                "child_count": len(cfg.children),
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sentry init skipped: %s", exc)

    # ── Helpers ───────────────────────────────────────────────────────────
    def _csrf_meta() -> str:
        return generate_csrf()

    @app.context_processor
    def _inject_globals() -> dict[str, Any]:
        # asset_v changes on every process start so static asset URLs
        # bust the browser cache after a service restart (otherwise
        # kiosk Chromium can sit on stale CSS/JS for hours).
        return {
            "csrf_token": _csrf_meta,
            "app_version": __version__,
            "asset_v": str(_STARTED_AT),
        }

    @app.before_request
    def _setup_redirect():
        if request.endpoint in {"setup_page", "api_setup", "static", "favicon"}:
            return None
        if request.path.startswith("/static/"):
            return None
        if not config_exists(cfg_path):
            from flask import redirect
            return redirect("/setup")
        return None

    @app.errorhandler(CSRFError)
    def _csrf_error(e: CSRFError):
        return jsonify({"error": "CSRF token missing or invalid", "detail": e.description}), 400

    # ── Routes: setup ─────────────────────────────────────────────────────
    @app.route("/setup", endpoint="setup_page")
    def setup_page():
        lan_ip = get_lan_ip()
        return render_template("setup.html", lan_ip=lan_ip, server_port=5000)

    @app.post("/api/setup", endpoint="api_setup")
    def api_setup():
        data = request.get_json(silent=True) or {}
        try:
            cfg = _build_config_from_payload(data)
            validate_config(cfg)
            save_config(cfg_path, cfg)
        except (ConfigError, ValueError, KeyError, TypeError) as exc:
            return jsonify({"error": _safe_error(exc)}), 400

        logger.info("Setup completed; restarting to apply bind changes")
        # Always restart after setup so binding (0.0.0.0 vs 127.0.0.1) and Sentry init reload.
        schedule_restart()
        return jsonify({"ok": True, "restarting": True, "delay": 2})

    # ── Routes: main ──────────────────────────────────────────────────────
    @app.get("/")
    def index():
        cfg = load_config(cfg_path)
        return render_template("index.html", config=cfg)

    @app.get("/api/weather")
    def api_weather():
        cfg = load_config(cfg_path)
        try:
            loc = get_location(cfg)
        except LocationNotConfiguredError:
            return jsonify({"error": "location_not_configured"}), 400
        except LocationError as exc:
            _capture_exc(exc, route="/api/weather", phase="get_location")
            return jsonify({"error": "location_error", "detail": _safe_error(exc)}), 502

        weather = fetch_current_weather(loc.latitude, loc.longitude, cfg.units.temperature)
        if weather is None:
            _breadcrumb("weather", "fetch returned no data and no cache", level="warning")
        elif weather.stale:
            _breadcrumb("weather", "served stale cached weather", level="warning")

        # Dev-only override: ?mode=day|night|auto forces the recommender into a
        # given mode regardless of clock/sunset. Only honored on the dev channel.
        force_evening: bool | None = None
        mode = (request.args.get("mode") or "auto").lower()
        if cfg.updates.channel == "dev" and mode in {"day", "night"}:
            force_evening = mode == "night"

        recs = recommend_all(
            weather, cfg.children, cfg.thresholds, cfg.units.temperature,
            force_evening=force_evening,
        )
        # Track evening-mode transitions so we can correlate UI bugs.
        evening = recs[0].tier_name == "evening" if recs else False
        prev = getattr(api_weather, "_last_evening", None)
        if prev is not None and prev != evening:
            _breadcrumb("recommender", "evening mode flipped",
                        from_=str(prev), to=str(evening))
        api_weather._last_evening = evening

        return jsonify(
            {
                "weather": _weather_to_dict(weather, cfg.units.temperature),
                "recommendations": [asdict(r) for r in recs],
                "location": {
                    "city": getattr(loc, "city", None),
                    "region": getattr(loc, "region", None),
                    "country": getattr(loc, "country", None),
                },
                "refresh_interval_minutes": cfg.refresh_interval_minutes,
            }
        )

    # ── Routes: settings ──────────────────────────────────────────────────
    @app.get("/settings")
    def settings_page():
        cfg = load_config(cfg_path)
        return render_template("settings.html", config=cfg)

    @app.get("/api/health")
    def api_health():
        # Tiny endpoint used by the front-end to detect when the server is
        # back online after an update or remote-toggle restart. Includes
        # the local git HEAD short SHA so the UI can detect dev-channel
        # rebuilds that don't bump __version__, plus a server start
        # timestamp so dashboards reload after any restart (which also
        # invalidates whatever in-page CSRF token they were holding).
        sha = ""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--short=7", "HEAD"],
                cwd=str(BASE_DIR),
                check=True,
                capture_output=True,
                text=True,
                timeout=2,
            )
            sha = result.stdout.strip()
        except (FileNotFoundError, subprocess.SubprocessError):
            # No git or repo unavailable; ship without the SHA.
            pass
        return jsonify({
            "ok": True,
            "version": __version__,
            "sha": sha,
            "started_at": _STARTED_AT,
        })

    @app.get("/api/_test/raise")
    def api_test_raise():
        """Dev/beta-only: raise a tagged exception (or send a message) so
        Sentry capture can be verified end-to-end. 404 on stable channel.
        Usage:
            curl http://localhost:5000/api/_test/raise           # exception
            curl http://localhost:5000/api/_test/raise?kind=message
        """
        cfg = load_config(cfg_path) if config_exists(cfg_path) else Config()
        if cfg.updates.channel not in {"dev", "beta"}:
            abort(404)
        kind = (request.args.get("kind") or "exception").lower()
        if kind == "message":
            try:
                import sentry_sdk
                sentry_sdk.capture_message(
                    "OutfitPi telemetry test message", level="info"
                )
                return jsonify({"ok": True, "kind": "message"})
            except ImportError:
                return jsonify({"ok": False, "error": "sentry-sdk not installed"}), 500
        # Default: raise a real exception so Flask + Sentry both see it.
        raise RuntimeError("OutfitPi telemetry test exception (intentional)")

    @app.post("/api/_client/error")
    def api_client_error():
        """Receive a client-side error report from the browser.

        Posted by static/js/settings.js (and others) when a user-initiated
        action fails (failed save, ZIP lookup error, update install error,
        unexpected JS exception). Captures the error to Sentry along with
        the in-flight settings snapshot so we can correlate UI failures.
        """
        body = request.get_json(silent=True) or {}
        message = str(body.get("message") or "client error")[:400]
        page = str(body.get("page") or "")
        action = str(body.get("action") or "")
        # Capture under a synthetic exception type so it groups in Sentry.
        try:
            raise RuntimeError(f"client: {message}")
        except RuntimeError as exc:
            _capture_exc(
                exc,
                source="client",
                page=page,
                action=action,
                ua=request.headers.get("User-Agent", "")[:120],
            )
        # Also drop a breadcrumb so subsequent server-side events have
        # context if the user keeps poking.
        _breadcrumb("client", message, level="warning",
                    page=page, action=action)
        return jsonify({"ok": True})

    @app.post("/api/_client/trace")
    def api_client_trace():
        """Server-side sink for browser trace events.

        Posted by static/js/trace.js when ?trace=1 is set. Logs each
        event to the app log so it can be tailed via journalctl or
        systemctl --user status outfitpi on the Pi. Useful for
        diagnosing touchscreen-only bugs that don't reproduce in
        Playwright.
        """
        body = request.get_json(silent=True) or {}
        tag = str(body.get("tag") or "trace")[:40]
        data = body.get("data")
        logger.info("CLIENT-TRACE [%s] %s", tag, data)
        return jsonify({"ok": True})

    @app.get("/api/settings")
    def api_settings_get():
        cfg = load_config(cfg_path)
        return jsonify(cfg.to_dict())

    @app.post("/api/settings")
    def api_settings_post():
        data = request.get_json(silent=True) or {}
        try:
            cfg = _build_config_from_payload(data)
            validate_config(cfg)
            save_config(cfg_path, cfg)
        except (ConfigError, ValueError, KeyError, TypeError) as exc:
            _capture_exc(
                exc,
                route="/api/settings",
                channel=(data.get("updates") or {}).get("channel"),
                theme=(data.get("display") or {}).get("theme"),
                units=(data.get("units") or {}).get("temperature"),
                child_count=len(data.get("children") or []),
                remote_access=(data.get("web_remote") or {}).get("enabled"),
                refresh_minutes=data.get("refresh_interval_minutes"),
            )
            return jsonify({"error": _safe_error(exc)}), 400
        # Re-apply tags now that config changed.
        _set_tags({
            "channel": cfg.updates.channel,
            "theme": cfg.display.theme,
            "units": cfg.units.temperature,
            "remote_access": cfg.web_remote.enabled,
            "child_count": len(cfg.children),
        })
        _breadcrumb("settings", "settings saved",
                    channel=cfg.updates.channel, theme=cfg.display.theme,
                    units=cfg.units.temperature)
        clear_location_cache()
        return jsonify({"ok": True})

    @app.post("/api/settings/reset")
    def api_settings_reset():
        defaults = Config()
        # Preserve children/location since reset would invalidate config.
        try:
            current = load_config(cfg_path)
            defaults.children = current.children
            defaults.location = current.location
        except Exception:  # noqa: BLE001
            pass
        try:
            validate_config(defaults)
            save_config(cfg_path, defaults)
        except ConfigError as exc:
            return jsonify({"error": _safe_error(exc)}), 400
        return jsonify({"ok": True})

    @app.post("/api/remote-access")
    def api_remote_access():
        data = request.get_json(silent=True) or {}
        enabled = bool(data.get("enabled"))
        cfg = load_config(cfg_path)
        was_enabled = cfg.web_remote.enabled
        cfg.web_remote.enabled = enabled
        try:
            validate_config(cfg)
            save_config(cfg_path, cfg)
        except ConfigError as exc:
            return jsonify({"error": _safe_error(exc)}), 400

        warning = None
        if was_enabled and not enabled and request.remote_addr not in {"127.0.0.1", "::1"}:
            warning = "Disabling remote access will disconnect this session. Reconnect from the Pi."

        if was_enabled != enabled:
            _breadcrumb("settings", "remote access toggled", enabled=enabled)
            schedule_restart()
            return jsonify({"ok": True, "restarting": True, "delay": 2, "warning": warning})
        return jsonify({"ok": True, "warning": warning})

    # ── Routes: updates ──────────────────────────────────────────────────
    @app.get("/api/update/check")
    def api_update_check():
        cfg = load_config(cfg_path) if config_exists(cfg_path) else Config()
        info = check_for_update(__version__, detect_repo(BASE_DIR), channel=cfg.updates.channel, repo_path=BASE_DIR)
        return jsonify(asdict(info))

    @app.post("/api/update/install")
    def api_update_install():
        cfg = load_config(cfg_path) if config_exists(cfg_path) else Config()
        venv_pip = BASE_DIR / "venv" / "bin" / "pip"
        venv_pip = venv_pip if venv_pip.exists() else None
        # Optional explicit ref (dev channel only). Accepts a tag, branch
        # or commit SHA. Validated against a strict allowlist before being
        # passed to git.
        target_ref = None
        body = request.get_json(silent=True) or {}
        ref = (body.get("ref") or "").strip() if isinstance(body, dict) else ""
        if ref:
            if cfg.updates.channel != "dev":
                return jsonify({"ok": False, "message": "ref override is only allowed on the dev channel"}), 400
            if not is_valid_ref(ref):
                return jsonify({"ok": False, "message": f"invalid ref: {ref!r}"}), 400
            target_ref = ref
        ok, msg = perform_update(
            BASE_DIR, venv_pip=venv_pip, channel=cfg.updates.channel, target_ref=target_ref,
        )
        if ok:
            _capture_msg("update installed", level="info",
                         channel=cfg.updates.channel,
                         target_ref=target_ref or "channel-head")
            schedule_restart()
            return jsonify({"ok": True, "message": msg, "restarting": True, "delay": 2})
        _capture_msg(f"update failed: {msg}", level="error",
                     channel=cfg.updates.channel,
                     target_ref=target_ref or "channel-head")
        return jsonify({"ok": False, "message": msg}), 500

    @app.get("/api/update/refs")
    def api_update_refs():
        cfg = load_config(cfg_path) if config_exists(cfg_path) else Config()
        if cfg.updates.channel != "dev":
            return jsonify({"error": "dev channel only"}), 403
        return jsonify(list_refs(BASE_DIR))

    # ── Routes: utility ──────────────────────────────────────────────────
    @app.get("/api/geocode/zip")
    def api_geocode_zip():
        country = request.args.get("country", "us")
        zip_code = request.args.get("zip", "").strip()
        if not zip_code:
            return jsonify({"error": "zip parameter required"}), 400
        try:
            loc = geocode_zip(country, zip_code)
        except LocationError as exc:
            _capture_exc(exc, route="/api/geocode/zip", country=country)
            return jsonify({"error": _safe_error(exc)}), 400
        return jsonify(
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "city": loc.city,
                "region": loc.region,
                "country": loc.country,
            }
        )

    @app.get("/api/network-info")
    def api_network_info():
        cfg = load_config(cfg_path) if config_exists(cfg_path) else Config()
        return jsonify(
            {
                "lan_ip": get_lan_ip(),
                "remote_access_enabled": cfg.web_remote.enabled,
            }
        )

    @app.get("/favicon.ico", endpoint="favicon")
    def favicon():
        ico = BASE_DIR / "static" / "icons" / "favicon.ico"
        if ico.exists():
            return send_from_directory(ico.parent, ico.name)
        abort(404)
        return None  # unreachable; satisfies static analysis

    return app


# ── Restart mechanism ─────────────────────────────────────────────────────
def schedule_restart(delay_seconds: float = 2.0) -> None:
    def _exit():
        time.sleep(delay_seconds)
        logger.info("Exiting with code 3 to trigger systemd restart")
        os._exit(3)

    threading.Thread(target=_exit, daemon=True).start()


# ── Helpers ───────────────────────────────────────────────────────────────
def _weather_to_dict(weather, units: str) -> dict | None:
    if weather is None:
        return None
    d = asdict(weather)
    d["units_temperature"] = units
    return d


# Exception types whose `str(exc)` is human-authored and safe to expose
# in API responses (they're intentional validation messages).
_SAFE_ERROR_TYPES = (ConfigError, LocationError)


def _safe_error(exc: BaseException) -> str:
    """Return a response-safe error message.

    For exceptions in the allowlist (config/location validation), use the
    real message — those are written for end users. For everything else,
    return a generic string so we don't leak stack traces or internal
    details. The full exception is captured in telemetry separately.
    """
    if isinstance(exc, _SAFE_ERROR_TYPES):
        return str(exc)
    return "Request failed. See server logs for details."


def _build_config_from_payload(data: dict[str, Any]) -> Config:
    """Build a Config from a JSON payload, merging with defaults."""
    cfg = Config()
    if "language" in data:
        cfg.language = str(data["language"])
    if "refresh_interval_minutes" in data:
        cfg.refresh_interval_minutes = int(data["refresh_interval_minutes"])

    units = data.get("units") or {}
    cfg.units = Units(temperature=str(units.get("temperature", "fahrenheit")))

    loc = data.get("location") or {}
    cfg.location = LocationCfg(
        latitude=loc.get("latitude") if loc.get("latitude") not in ("", None) else None,
        longitude=loc.get("longitude") if loc.get("longitude") not in ("", None) else None,
        auto=bool(loc.get("auto", False)),
        consent_given=bool(loc.get("consent_given", False)),
    )
    if cfg.location.latitude is not None:
        cfg.location.latitude = float(cfg.location.latitude)
    if cfg.location.longitude is not None:
        cfg.location.longitude = float(cfg.location.longitude)

    children_data = data.get("children") or []
    cfg.children = [
        Child(
            name=str(c.get("name", "")).strip(),
            gender=str(c.get("gender", "boy")),
            comfort_offset_f=float(c.get("comfort_offset_f", 0)),
        )
        for c in children_data
        if isinstance(c, dict)
    ]

    th = data.get("thresholds") or {}
    cfg.thresholds = Thresholds(
        hot=float(th.get("hot", 75)),
        warm=float(th.get("warm", 65)),
        cool=float(th.get("cool", 50)),
    )

    upd = data.get("updates") or {}
    cfg.updates = Updates(
        auto_check=bool(upd.get("auto_check", True)),
        auto_install=bool(upd.get("auto_install", False)),
        channel=_normalize_channel(upd.get("channel", "stable")),
    )

    tel = data.get("telemetry") or {}
    cfg.telemetry = TelemetryCfg(level=str(tel.get("level", "errors")))

    wr = data.get("web_remote") or {}
    cfg.web_remote = WebRemote(enabled=bool(wr.get("enabled", False)))

    disp = data.get("display") or {}
    theme = str(disp.get("theme", "auto")).strip().lower()
    if theme not in {"auto", "light", "dark"}:
        theme = "auto"
    framework = str(disp.get("framework", "material")).strip().lower()
    if framework not in {"native", "material", "fluent", "primer"}:
        framework = "material"
    variant = str(disp.get("variant", theme)).strip().lower()
    if variant not in {"auto", "light", "dark"}:
        variant = theme
    colorway = str(disp.get("colorway", "default")).strip().lower()
    if colorway not in {"default", "orange", "blue", "green", "red", "purple", "teal", "yellow"}:
        colorway = "default"
    cfg.display = Display(theme=theme, framework=framework, variant=variant, colorway=colorway)

    srv = data.get("server") or {}
    cfg.server = Server(port=int(srv.get("port", 5000)))

    return cfg


# ── Entrypoint ────────────────────────────────────────────────────────────
def _startup_update_thread(cfg: Config) -> None:
    if not cfg.updates.auto_check:
        return

    def _worker():
        # Delay so a startup-update loop (e.g. caused by a buggy version
        # comparison) can't churn faster than every 60s.
        time.sleep(60)
        try:
            info = check_for_update(__version__, detect_repo(BASE_DIR), channel=cfg.updates.channel, repo_path=BASE_DIR)
            _breadcrumb("updater", "auto-check completed",
                        channel=cfg.updates.channel,
                        available=info.available,
                        latest=info.latest_version)
            if info.available and cfg.updates.auto_install:
                logger.info("Auto-installing update %s", info.latest_version)
                _capture_msg("auto-update starting", level="info",
                             channel=cfg.updates.channel,
                             latest=info.latest_version)
                venv_pip = BASE_DIR / "venv" / "bin" / "pip"
                venv_pip = venv_pip if venv_pip.exists() else None
                ok, msg = perform_update(BASE_DIR, venv_pip=venv_pip, channel=cfg.updates.channel)
                if ok:
                    schedule_restart()
                else:
                    logger.warning("Auto-update failed: %s", msg)
                    _capture_msg(f"auto-update failed: {msg}", level="error",
                                 channel=cfg.updates.channel,
                                 latest=info.latest_version)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Update worker error: %s", exc)
            _capture_exc(exc, route="auto-update-worker", channel=cfg.updates.channel)

    threading.Thread(target=_worker, daemon=True).start()


def main() -> None:
    app = create_app(CONFIG_PATH)
    has_config = config_exists(CONFIG_PATH)

    port = 5000
    bind_host = "0.0.0.0"  # noqa: S104 — first run wizard needs LAN access
    if has_config:
        cfg = load_config(CONFIG_PATH)
        port = cfg.server.port
        bind_host = "0.0.0.0" if cfg.web_remote.enabled else "127.0.0.1"  # noqa: S104
        _startup_update_thread(cfg)
    if env_port := os.environ.get("OUTFITPI_PORT"):
        port = int(env_port)

    logger.info("Starting OutfitPi v%s on %s:%s", __version__, bind_host, port)
    app.run(host=bind_host, port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
