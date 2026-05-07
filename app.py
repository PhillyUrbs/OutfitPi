"""OutfitPi Flask application."""

from __future__ import annotations

import logging
import os
import secrets
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
    Server,
    Thresholds,
    Units,
    Updates,
    WebRemote,
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
from outfitpi.telemetry import init_sentry
from outfitpi.updater import check_for_update, detect_repo, perform_update
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


def create_app(config_path: Path | None = None) -> Flask:
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "templates"),
        static_folder=str(BASE_DIR / "static"),
    )
    app.config["SECRET_KEY"] = os.environ.get("OUTFITPI_SECRET_KEY", secrets.token_hex(32))
    app.config["CONFIG_PATH"] = cfg_path
    app.config["BABEL_DEFAULT_LOCALE"] = "en"
    app.config["BABEL_TRANSLATION_DIRECTORIES"] = str(BASE_DIR / "translations")

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
            init_sentry(cfg.telemetry.level, __version__, lambda: [c.name for c in load_config(cfg_path).children])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sentry init skipped: %s", exc)

    # ── Helpers ───────────────────────────────────────────────────────────
    def _csrf_meta() -> str:
        return generate_csrf()

    @app.context_processor
    def _inject_globals() -> dict[str, Any]:
        return {"csrf_token": _csrf_meta, "app_version": __version__}

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
            return jsonify({"error": str(exc)}), 400

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
            return jsonify({"error": "location_error", "detail": str(exc)}), 502

        weather = fetch_current_weather(loc.latitude, loc.longitude, cfg.units.temperature)
        recs = recommend_all(weather, cfg.children, cfg.thresholds, cfg.units.temperature)

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
            return jsonify({"error": str(exc)}), 400
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
            return jsonify({"error": str(exc)}), 400
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
            return jsonify({"error": str(exc)}), 400

        warning = None
        if was_enabled and not enabled and request.remote_addr not in {"127.0.0.1", "::1"}:
            warning = "Disabling remote access will disconnect this session. Reconnect from the Pi."

        if was_enabled != enabled:
            schedule_restart()
            return jsonify({"ok": True, "restarting": True, "delay": 2, "warning": warning})
        return jsonify({"ok": True, "warning": warning})

    # ── Routes: updates ──────────────────────────────────────────────────
    @app.get("/api/update/check")
    def api_update_check():
        info = check_for_update(__version__, detect_repo(BASE_DIR))
        return jsonify(asdict(info))

    @app.post("/api/update/install")
    def api_update_install():
        venv_pip = BASE_DIR / "venv" / "bin" / "pip"
        venv_pip = venv_pip if venv_pip.exists() else None
        ok, msg = perform_update(BASE_DIR, venv_pip=venv_pip)
        if ok:
            schedule_restart()
            return jsonify({"ok": True, "message": msg, "restarting": True, "delay": 2})
        return jsonify({"ok": False, "message": msg}), 500

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
            return jsonify({"error": str(exc)}), 400
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
        channel=str(upd.get("channel", "releases")),
    )

    tel = data.get("telemetry") or {}
    cfg.telemetry = TelemetryCfg(level=str(tel.get("level", "errors")))

    wr = data.get("web_remote") or {}
    cfg.web_remote = WebRemote(enabled=bool(wr.get("enabled", False)))

    srv = data.get("server") or {}
    cfg.server = Server(port=int(srv.get("port", 5000)))

    return cfg


# ── Entrypoint ────────────────────────────────────────────────────────────
def _startup_update_thread(cfg: Config) -> None:
    if not cfg.updates.auto_check:
        return

    def _worker():
        try:
            info = check_for_update(__version__, detect_repo(BASE_DIR))
            if info.available and cfg.updates.auto_install:
                logger.info("Auto-installing update %s", info.latest_version)
                venv_pip = BASE_DIR / "venv" / "bin" / "pip"
                venv_pip = venv_pip if venv_pip.exists() else None
                ok, msg = perform_update(BASE_DIR, venv_pip=venv_pip)
                if ok:
                    schedule_restart()
                else:
                    logger.warning("Auto-update failed: %s", msg)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Update worker error: %s", exc)

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

    logger.info("Starting OutfitPi v%s on %s:%s", __version__, bind_host, port)
    app.run(host=bind_host, port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
