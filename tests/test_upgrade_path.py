"""Cross-version upgrade-path tests.

For each historical release tag, fetch its `config.example.yaml`, patch in
a valid child + location so it passes validation, then load it through
the current `load_config` / `validate_config` pipeline and round-trip via
`save_config`. This catches breaking config-schema changes before a tag
gets cut.

Also boots the current Flask app against each migrated config and hits
`/api/health` and `/api/settings` to confirm the upgraded server actually
starts and serves the migrated config without error.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

from outfitpi.config_manager import load_config, save_config, validate_config

REPO_ROOT = Path(__file__).resolve().parent.parent

# Tags we promise to be able to upgrade FROM. Add new releases here as
# they ship; drop entries when they're past the supported upgrade window.
SUPPORTED_FROM_TAGS = ["v0.1.3", "v0.2.0", "v0.3.0", "v0.4.0-beta.1", "v0.4.0"]


def _git_show(tag: str, path: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "show", f"{tag}:{path}"],
            cwd=str(REPO_ROOT),
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return None


def _make_runnable_config(raw_yaml: str) -> dict:
    """Patch an example config so it passes validation."""
    data = yaml.safe_load(raw_yaml) or {}
    data.setdefault("location", {})
    data["location"]["latitude"] = 40.0468
    data["location"]["longitude"] = -75.531
    data["children"] = [
        {"name": "Test", "gender": "boy", "comfort_offset_f": 0},
    ]
    return data


@pytest.mark.parametrize("from_tag", SUPPORTED_FROM_TAGS)
def test_old_config_loads_and_revalidates(tmp_path: Path, from_tag: str) -> None:
    """An old release's example config must load + validate + round-trip."""
    raw = _git_show(from_tag, "config.example.yaml")
    if raw is None:
        pytest.skip(f"tag {from_tag} not present locally (shallow clone?)")

    data = _make_runnable_config(raw)
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")

    # Load through current code — this exercises field defaults, channel
    # alias normalization, and _apply_channel_policy.
    cfg = load_config(cfg_path)
    validate_config(cfg)

    # Round-trip: save + reload should produce an identical Config.
    save_config(cfg_path, cfg)
    cfg2 = load_config(cfg_path)
    assert cfg.to_dict() == cfg2.to_dict()


@pytest.mark.parametrize("from_tag", SUPPORTED_FROM_TAGS)
def test_app_boots_with_old_config(tmp_path: Path, from_tag: str) -> None:
    """Current app must serve /api/health and /api/settings against an
    upgraded config from each supported old version."""
    raw = _git_show(from_tag, "config.example.yaml")
    if raw is None:
        pytest.skip(f"tag {from_tag} not present locally")

    data = _make_runnable_config(raw)
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")

    # Import here so the app picks up our overridden CONFIG_PATH if needed.
    os.environ["OUTFITPI_CONFIG"] = str(cfg_path)
    import importlib

    import app as app_module

    importlib.reload(app_module)

    flask_app = app_module.create_app(cfg_path)
    flask_app.config["WTF_CSRF_ENABLED"] = False

    with patch("app.schedule_restart"):
        client = flask_app.test_client()
        h = client.get("/api/health")
        assert h.status_code == 200
        body = h.get_json()
        assert body["ok"] is True
        assert "version" in body

        s = client.get("/api/settings")
        assert s.status_code == 200
        sbody = s.get_json()
        # Migrated config should expose all current top-level sections.
        for key in ("location", "units", "children", "thresholds", "updates", "telemetry", "display"):
            assert key in sbody, f"missing {key!r} after upgrade from {from_tag}"
