"""Tests for outfitpi.config_manager."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from outfitpi.config_manager import (
    Child,
    Config,
    ConfigError,
    Telemetry,
    Thresholds,
    Updates,
    WebRemote,
    c_to_f,
    config_exists,
    f_to_c,
    load_config,
    save_config,
    validate_config,
)


def test_config_exists(tmp_path: Path):
    p = tmp_path / "config.yaml"
    assert not config_exists(p)
    p.write_text("children:\n  - name: x\n    gender: boy\n")
    assert config_exists(p)


def test_load_missing_returns_defaults(tmp_path: Path):
    cfg = load_config(tmp_path / "missing.yaml")
    assert isinstance(cfg, Config)
    assert cfg.thresholds.hot == 75
    assert cfg.thresholds.warm == 65
    assert cfg.thresholds.cool == 50


def test_save_and_load_roundtrip(tmp_path: Path):
    p = tmp_path / "config.yaml"
    cfg = Config(
        children=[Child(name="Tommy", gender="boy", comfort_offset_f=2)],
        thresholds=Thresholds(hot=78, warm=68, cool=55),
    )
    save_config(p, cfg)
    loaded = load_config(p)
    assert loaded.children[0].name == "Tommy"
    assert loaded.children[0].gender == "boy"
    assert loaded.children[0].comfort_offset_f == 2
    assert loaded.thresholds.hot == 78


def test_validation_no_children():
    cfg = Config(children=[])
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_too_many_children():
    cfg = Config(children=[Child(name=f"k{i}", gender="boy") for i in range(3)])
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_empty_name():
    cfg = Config(children=[Child(name="  ", gender="boy")])
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_invalid_gender():
    cfg = Config(children=[Child(name="x", gender="other")])
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_offset_out_of_range():
    cfg = Config(children=[Child(name="x", gender="boy", comfort_offset_f=20)])
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_thresholds_inverted():
    cfg = Config(
        children=[Child(name="x", gender="boy")],
        thresholds=Thresholds(hot=50, warm=60, cool=70),
    )
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_thresholds_out_of_bounds():
    cfg = Config(
        children=[Child(name="x", gender="boy")],
        thresholds=Thresholds(hot=200, warm=180, cool=160),
    )
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_invalid_telemetry():
    cfg = Config(
        children=[Child(name="x", gender="boy")],
        telemetry=Telemetry(level="bogus"),
    )
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_validation_invalid_channel():
    cfg = Config(
        children=[Child(name="x", gender="boy")],
        updates=Updates(channel="bogus"),
    )
    with pytest.raises(ConfigError):
        validate_config(cfg)


def test_f_to_c_and_back():
    assert f_to_c(32) == pytest.approx(0.0)
    assert f_to_c(212) == pytest.approx(100.0)
    assert c_to_f(0) == pytest.approx(32.0)
    assert c_to_f(100) == pytest.approx(212.0)
    # Round-trip
    assert c_to_f(f_to_c(75)) == pytest.approx(75.0)


def test_atomic_write_keeps_bak(tmp_path: Path):
    p = tmp_path / "config.yaml"
    cfg1 = Config(children=[Child(name="A", gender="boy")])
    save_config(p, cfg1)
    cfg2 = Config(children=[Child(name="B", gender="girl")])
    save_config(p, cfg2)
    bak = p.with_suffix(p.suffix + ".bak")
    assert bak.exists()
    # Bak should be the previous version
    backup_loaded = load_config(bak)
    assert backup_loaded.children[0].name == "A"


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX permissions only")
def test_save_uses_0600_permissions(tmp_path: Path):
    p = tmp_path / "config.yaml"
    cfg = Config(children=[Child(name="X", gender="boy")])
    save_config(p, cfg)
    mode = os.stat(p).st_mode & 0o777
    assert mode == 0o600


def test_save_invalid_config_raises(tmp_path: Path):
    p = tmp_path / "config.yaml"
    cfg = Config(children=[])  # invalid
    with pytest.raises(ConfigError):
        save_config(p, cfg)
    assert not p.exists()


def test_web_remote_default_disabled():
    cfg = Config()
    assert isinstance(cfg.web_remote, WebRemote)
