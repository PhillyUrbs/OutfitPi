"""Tests for outfitpi.updater."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from outfitpi.updater import (
    UpdateInfo,
    check_for_update,
    clear_cache,
    detect_repo,
)


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def _completed(stdout: str = "", returncode: int = 0):
    m = MagicMock()
    m.stdout = stdout
    m.returncode = returncode
    return m


def test_detect_repo_https():
    with patch(
        "outfitpi.updater.subprocess.run",
        return_value=_completed("https://github.com/PhillyUrbs/OutfitPi.git\n"),
    ):
        owner, repo = detect_repo()
    assert (owner, repo) == ("PhillyUrbs", "OutfitPi")


def test_detect_repo_https_no_dot_git():
    with patch(
        "outfitpi.updater.subprocess.run",
        return_value=_completed("https://github.com/Foo/Bar\n"),
    ):
        assert detect_repo() == ("Foo", "Bar")


def test_detect_repo_ssh():
    with patch(
        "outfitpi.updater.subprocess.run",
        return_value=_completed("git@github.com:PhillyUrbs/OutfitPi.git\n"),
    ):
        assert detect_repo() == ("PhillyUrbs", "OutfitPi")


def test_detect_repo_no_git_falls_back():
    with patch("outfitpi.updater.subprocess.run", side_effect=FileNotFoundError):
        owner, repo = detect_repo()
    assert (owner, repo) == ("PhillyUrbs", "OutfitPi")


def test_detect_repo_non_github_falls_back():
    with patch(
        "outfitpi.updater.subprocess.run",
        return_value=_completed("https://gitlab.com/x/y.git\n"),
    ):
        assert detect_repo() == ("PhillyUrbs", "OutfitPi")


def _release_response(tag: str = "v0.2.0"):
    resp = MagicMock()
    resp.json.return_value = {
        "tag_name": tag,
        "html_url": f"https://github.com/PhillyUrbs/OutfitPi/releases/tag/{tag}",
        "body": "Release notes",
    }
    resp.raise_for_status = MagicMock()
    return resp


def test_check_update_available():
    with patch("outfitpi.updater.httpx.get", return_value=_release_response("v0.2.0")):
        info = check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False)
    assert info.available is True
    assert info.latest_version == "0.2.0"


def test_check_update_not_available_when_equal():
    with patch("outfitpi.updater.httpx.get", return_value=_release_response("v0.1.0")):
        info = check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False)
    assert info.available is False


def test_check_update_not_available_when_older():
    with patch("outfitpi.updater.httpx.get", return_value=_release_response("v0.0.5")):
        info = check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False)
    assert info.available is False


def test_check_update_handles_http_error():
    with patch("outfitpi.updater.httpx.get", side_effect=httpx.ConnectError("boom")):
        info = check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False)
    assert isinstance(info, UpdateInfo)
    assert info.available is False
    assert info.message is not None


def test_check_update_uses_cache_within_window():
    with patch("outfitpi.updater.httpx.get", return_value=_release_response("v0.2.0")) as m:
        check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"))
        check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"))
    assert m.call_count == 1


def test_check_update_invalid_version_tag():
    with patch("outfitpi.updater.httpx.get", return_value=_release_response("not-a-version")):
        info = check_for_update("0.1.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False)
    assert info.available is False


def test_beta_channel_picks_latest_prerelease():
    releases = [
        {"tag_name": "v0.2.0", "html_url": "x", "body": "stable", "draft": False, "prerelease": False},
        {"tag_name": "v0.3.0-beta.1", "html_url": "y", "body": "beta", "draft": False, "prerelease": True},
    ]
    resp = MagicMock()
    resp.json.return_value = releases
    resp.raise_for_status = MagicMock()
    with patch("outfitpi.updater.httpx.get", return_value=resp):
        info = check_for_update(
            "0.2.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False, channel="beta"
        )
    assert info.available is True
    assert info.latest_version == "0.3.0b1"
    assert info.channel == "beta"


def test_dev_channel_uses_branch_head():
    resp = MagicMock()
    resp.json.return_value = {
        "commit": {"sha": "abcdef1234567890", "commit": {"message": "wip"}}
    }
    resp.raise_for_status = MagicMock()
    with patch("outfitpi.updater.httpx.get", return_value=resp):
        info = check_for_update(
            "0.2.0", repo=("PhillyUrbs", "OutfitPi"), use_cache=False, channel="dev"
        )
    assert info.channel == "dev"
    assert info.latest_version == "dev@abcdef1"
    assert info.available is True


def test_dev_channel_not_available_when_sha_matches():
    resp = MagicMock()
    resp.json.return_value = {
        "commit": {"sha": "abcdef1234567890", "commit": {"message": "wip"}}
    }
    resp.raise_for_status = MagicMock()
    with patch("outfitpi.updater.httpx.get", return_value=resp):
        info = check_for_update(
            "0.2.0+abcdef1", repo=("PhillyUrbs", "OutfitPi"), use_cache=False, channel="dev"
        )
    assert info.available is False
