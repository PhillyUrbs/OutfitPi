"""In-app updater via GitHub releases + git reset."""

from __future__ import annotations

import logging
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from packaging.version import InvalidVersion, Version

logger = logging.getLogger(__name__)

DEFAULT_REPO = ("PhillyUrbs", "OutfitPi")
GITHUB_API_LATEST = "https://api.github.com/repos/{owner}/{repo}/releases/latest"

_CACHE_TTL_SECONDS = 24 * 60 * 60
_cache: tuple[float, UpdateInfo] | None = None


@dataclass
class UpdateInfo:
    available: bool
    current_version: str
    latest_version: str | None = None
    release_url: str | None = None
    release_notes: str | None = None
    message: str | None = None


def detect_repo(repo_path: Path | None = None) -> tuple[str, str]:
    """Parse `git remote get-url origin` to extract (owner, repo). Falls back to default."""
    cwd = str(repo_path) if repo_path else None
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=cwd,
            check=False,
        )
        if result.returncode != 0:
            return DEFAULT_REPO
        url = result.stdout.strip()
    except (FileNotFoundError, subprocess.SubprocessError):
        return DEFAULT_REPO

    # https://github.com/owner/repo(.git)
    m = re.match(r"https?://github\.com/([^/]+)/([^/.]+?)(?:\.git)?/?$", url)
    if m:
        return (m.group(1), m.group(2))
    # git@github.com:owner/repo(.git)
    m = re.match(r"git@github\.com:([^/]+)/([^/.]+?)(?:\.git)?$", url)
    if m:
        return (m.group(1), m.group(2))
    return DEFAULT_REPO


def _parse_version(s: str) -> Version | None:
    s = s.strip().lstrip("v")
    try:
        return Version(s)
    except InvalidVersion:
        return None


def check_for_update(
    current_version: str,
    repo: tuple[str, str] | None = None,
    *,
    use_cache: bool = True,
) -> UpdateInfo:
    """Check GitHub releases for a newer version. Caches for 24h."""
    global _cache
    now = time.time()
    if use_cache and _cache is not None:
        ts, info = _cache
        if now - ts < _CACHE_TTL_SECONDS:
            return info

    owner, name = repo or detect_repo()
    url = GITHUB_API_LATEST.format(owner=owner, repo=name)
    try:
        resp = httpx.get(url, timeout=10.0, headers={"Accept": "application/vnd.github+json"})
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Update check failed: %s", exc)
        return UpdateInfo(
            available=False,
            current_version=current_version,
            message=f"Update check failed: {exc}",
        )

    tag = str(data.get("tag_name", ""))
    latest = _parse_version(tag)
    current = _parse_version(current_version)
    if latest is None or current is None:
        return UpdateInfo(
            available=False,
            current_version=current_version,
            message="Could not parse versions",
        )

    info = UpdateInfo(
        available=latest > current,
        current_version=current_version,
        latest_version=str(latest),
        release_url=data.get("html_url"),
        release_notes=data.get("body"),
    )
    _cache = (now, info)
    return info


def perform_update(
    repo_path: Path,
    venv_pip: Path | None = None,
) -> tuple[bool, str]:
    """Fetch + reset to latest tag, install requirements. Returns (success, message)."""
    repo_path = Path(repo_path)
    try:
        subprocess.run(
            ["git", "fetch", "origin", "--tags"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        # Get latest tag by version sort.
        result = subprocess.run(
            ["git", "tag", "--sort=-v:refname"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        tags = [t for t in result.stdout.splitlines() if t.strip()]
        if not tags:
            return False, "No release tags found"
        latest_tag = tags[0]
        subprocess.run(
            ["git", "reset", "--hard", latest_tag],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        pip_cmd = [str(venv_pip)] if venv_pip else ["pip"]
        subprocess.run(
            [*pip_cmd, "install", "-r", "requirements.txt"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
            timeout=300,
        )
        return True, f"Updated to {latest_tag}"
    except subprocess.CalledProcessError as exc:
        msg = exc.stderr.strip() if exc.stderr else str(exc)
        logger.error("Update failed: %s", msg)
        return False, f"Update failed: {msg}"
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        logger.error("Update failed: %s", exc)
        return False, f"Update failed: {exc}"


def clear_cache() -> None:
    global _cache
    _cache = None
