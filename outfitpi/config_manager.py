"""Configuration loading, saving, and validation."""

from __future__ import annotations

import contextlib
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import yaml

VALID_GENDERS = {"boy", "girl"}
VALID_UNITS = {"fahrenheit", "celsius"}
VALID_TELEMETRY = {"none", "errors", "full"}
VALID_THEMES = {"auto", "light", "dark"}
# UI framework picker (controls component library used by every page).
VALID_FRAMEWORKS = {"native", "material", "fluent", "primer"}
VALID_VARIANTS = {"auto", "light", "dark"}
VALID_CHANNELS = {"stable", "beta", "dev"}
# Map legacy channel names to current ones for backward compatibility.
_CHANNEL_ALIASES = {"releases": "stable", "main": "dev"}


def _normalize_channel(value: str) -> str:
    v = str(value or "stable").strip().lower()
    return _CHANNEL_ALIASES.get(v, v)


class ConfigError(ValueError):
    """Raised on invalid config."""


@dataclass
class Child:
    name: str
    gender: str  # "boy" | "girl"
    comfort_offset_f: float = 0.0


@dataclass
class Location:
    latitude: float | None = None
    longitude: float | None = None
    auto: bool = False
    consent_given: bool = False


@dataclass
class Units:
    temperature: str = "fahrenheit"


@dataclass
class Thresholds:
    hot: float = 75.0
    warm: float = 65.0
    cool: float = 50.0


@dataclass
class Updates:
    auto_check: bool = True
    auto_install: bool = True
    channel: str = "stable"


@dataclass
class Telemetry:
    level: str = "errors"


@dataclass
class WebRemote:
    enabled: bool = False


@dataclass
class Display:
    theme: str = "auto"  # "auto" | "light" | "dark" — legacy; mirrors variant.
    framework: str = "material"  # "native" | "material" | "fluent" | "primer"
    variant: str = "auto"        # "auto" | "light" | "dark"


@dataclass
class Server:
    port: int = 5000


@dataclass
class Config:
    location: Location = field(default_factory=Location)
    units: Units = field(default_factory=Units)
    language: str = "en"
    children: list[Child] = field(default_factory=list)
    thresholds: Thresholds = field(default_factory=Thresholds)
    refresh_interval_minutes: int = 30
    updates: Updates = field(default_factory=Updates)
    telemetry: Telemetry = field(default_factory=Telemetry)
    web_remote: WebRemote = field(default_factory=WebRemote)
    display: Display = field(default_factory=Display)
    server: Server = field(default_factory=Server)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def f_to_c(f: float) -> float:
    return (f - 32.0) * 5.0 / 9.0


def c_to_f(c: float) -> float:
    return c * 9.0 / 5.0 + 32.0


def config_exists(path: Path) -> bool:
    return Path(path).exists()


def _merge_child(d: dict[str, Any]) -> Child:
    return Child(
        name=str(d.get("name", "")).strip(),
        gender=str(d.get("gender", "boy")),
        comfort_offset_f=float(d.get("comfort_offset_f", 0.0)),
    )


def _from_dict(data: dict[str, Any]) -> Config:
    cfg = Config()
    if not isinstance(data, dict):
        return cfg

    loc = data.get("location") or {}
    cfg.location = Location(
        latitude=loc.get("latitude"),
        longitude=loc.get("longitude"),
        auto=bool(loc.get("auto", False)),
        consent_given=bool(loc.get("consent_given", False)),
    )

    units = data.get("units") or {}
    cfg.units = Units(temperature=str(units.get("temperature", "fahrenheit")))

    cfg.language = str(data.get("language", "en"))

    children = data.get("children") or []
    cfg.children = [_merge_child(c) for c in children if isinstance(c, dict)]

    th = data.get("thresholds") or {}
    cfg.thresholds = Thresholds(
        hot=float(th.get("hot", 75)),
        warm=float(th.get("warm", 65)),
        cool=float(th.get("cool", 50)),
    )

    cfg.refresh_interval_minutes = int(data.get("refresh_interval_minutes", 30))

    upd = data.get("updates") or {}
    cfg.updates = Updates(
        auto_check=bool(upd.get("auto_check", True)),
        auto_install=bool(upd.get("auto_install", False)),
        channel=_normalize_channel(upd.get("channel", "stable")),
    )

    tel = data.get("telemetry") or {}
    cfg.telemetry = Telemetry(level=str(tel.get("level", "errors")))

    wr = data.get("web_remote") or {}
    cfg.web_remote = WebRemote(enabled=bool(wr.get("enabled", False)))

    disp = data.get("display") or {}
    theme = str(disp.get("theme", "auto")).strip().lower()
    if theme not in VALID_THEMES:
        theme = "auto"
    framework = str(disp.get("framework", "material")).strip().lower()
    if framework not in VALID_FRAMEWORKS:
        framework = "material"
    # Variant defaults to the legacy theme value so existing installs keep
    # the same look until the user explicitly picks one.
    variant = str(disp.get("variant", theme)).strip().lower()
    if variant not in VALID_VARIANTS:
        variant = theme
    cfg.display = Display(theme=theme, framework=framework, variant=variant)

    srv = data.get("server") or {}
    cfg.server = Server(port=int(srv.get("port", 5000)))

    return cfg


def load_config(path: Path) -> Config:
    """Load YAML config; returns defaults if missing."""
    p = Path(path)
    if not p.exists():
        cfg = Config()
    else:
        with p.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        cfg = _from_dict(data)
    _apply_channel_policy(cfg)
    return cfg


def _apply_channel_policy(cfg: Config) -> None:
    """Enforce per-channel policy for updates and telemetry.

    Rules:
      - All channels: auto-check and auto-install are on.
      - dev / beta: telemetry forced to "full".
    """
    cfg.updates.auto_check = True
    cfg.updates.auto_install = True
    if cfg.updates.channel in {"dev", "beta"}:
        cfg.telemetry.level = "full"
    # Keep legacy `display.theme` in sync with the new `variant` so older
    # clients reading the old key get the same value.
    cfg.display.theme = cfg.display.variant


def validate_config(cfg: Config) -> None:
    """Raise ConfigError if invalid."""
    if not 1 <= len(cfg.children) <= 2:
        raise ConfigError("Must have 1 or 2 children")
    for child in cfg.children:
        if not child.name or not child.name.strip():
            raise ConfigError("Child name cannot be empty")
        if child.gender not in VALID_GENDERS:
            raise ConfigError(f"Invalid gender: {child.gender}")
        if not -15 <= child.comfort_offset_f <= 15:
            raise ConfigError("comfort_offset_f must be between -15 and +15")

    th = cfg.thresholds
    if not (th.hot > th.warm > th.cool):
        raise ConfigError("Thresholds must satisfy hot > warm > cool")
    for name, val in (("hot", th.hot), ("warm", th.warm), ("cool", th.cool)):
        if not 20 <= val <= 120:
            raise ConfigError(f"Threshold {name} must be 20–120°F")

    if cfg.units.temperature not in VALID_UNITS:
        raise ConfigError(f"Invalid temperature unit: {cfg.units.temperature}")
    if cfg.telemetry.level not in VALID_TELEMETRY:
        raise ConfigError(f"Invalid telemetry level: {cfg.telemetry.level}")
    if cfg.updates.channel not in VALID_CHANNELS:
        raise ConfigError(f"Invalid update channel: {cfg.updates.channel}")
    if cfg.display.theme not in VALID_THEMES:
        raise ConfigError(f"Invalid theme: {cfg.display.theme}")
    if cfg.display.framework not in VALID_FRAMEWORKS:
        raise ConfigError(f"Invalid framework: {cfg.display.framework}")
    if cfg.display.variant not in VALID_VARIANTS:
        raise ConfigError(f"Invalid variant: {cfg.display.variant}")
    if cfg.refresh_interval_minutes < 1:
        raise ConfigError("refresh_interval_minutes must be >= 1")


def save_config(path: Path, cfg: Config) -> None:
    """Atomic write with .bak; mode 0600 on POSIX."""
    _apply_channel_policy(cfg)
    validate_config(cfg)
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    if p.exists():
        bak = p.with_suffix(p.suffix + ".bak")
        with contextlib.suppress(OSError):
            shutil.copy2(p, bak)

    data = cfg.to_dict()
    fd, tmp_name = tempfile.mkstemp(prefix=p.name, dir=str(p.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)
            f.flush()
            with contextlib.suppress(OSError):
                os.fsync(f.fileno())
        if os.name == "posix":
            with contextlib.suppress(OSError):
                os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, p)
    except Exception:
        with contextlib.suppress(OSError):
            os.unlink(tmp_name)
        raise
