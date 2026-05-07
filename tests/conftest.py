"""Pytest fixtures."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path

import pytest

from outfitpi.config_manager import (
    Child,
    Config,
    Location,
    Telemetry,
    Thresholds,
    Units,
    WebRemote,
    save_config,
)
from outfitpi.weather import CurrentWeather


@pytest.fixture
def tmp_config_path(tmp_path: Path) -> Path:
    return tmp_path / "config.yaml"


@pytest.fixture
def tommy() -> Child:
    return Child(name="Tommy", gender="boy", comfort_offset_f=0)


@pytest.fixture
def lily() -> Child:
    return Child(name="Lily", gender="girl", comfort_offset_f=-3)


@pytest.fixture
def thresholds() -> Thresholds:
    return Thresholds(hot=75, warm=65, cool=50)


@pytest.fixture
def sample_weather() -> CurrentWeather:
    return CurrentWeather(
        temperature=72.0,
        apparent_temperature=72.0,
        weather_code=0,
        description="Clear sky",
        icon="sun",
        precipitation=0.0,
        rain=0.0,
        wind_speed=5.0,
        is_day=True,
        humidity=45.0,
        uv_index_max=6.0,
        units_temperature="fahrenheit",
        is_raining=False,
        is_snowing=False,
        fetched_at=time.time(),
    )


@pytest.fixture
def base_config(tommy: Child) -> Config:
    return Config(
        location=Location(latitude=39.95, longitude=-75.16),
        units=Units(temperature="fahrenheit"),
        children=[tommy],
        thresholds=Thresholds(hot=75, warm=65, cool=50),
        telemetry=Telemetry(level="none"),
        web_remote=WebRemote(enabled=False),
    )


@pytest.fixture
def configured_app(tmp_config_path: Path, base_config: Config, monkeypatch) -> Iterator:
    save_config(tmp_config_path, base_config)
    # Disable CSRF for easier API testing; the dedicated test_routes test
    # re-enables it to verify the protection.
    monkeypatch.setenv("OUTFITPI_CONFIG", str(tmp_config_path))

    import importlib

    import app as app_module
    importlib.reload(app_module)
    flask_app = app_module.create_app(tmp_config_path)
    flask_app.config["TESTING"] = True
    flask_app.config["WTF_CSRF_ENABLED"] = False
    yield flask_app


@pytest.fixture
def client(configured_app):
    return configured_app.test_client()
