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
GITHUB_API_RELEASES = "https://api.github.com/repos/{owner}/{repo}/releases"
GITHUB_API_BRANCH = "https://api.github.com/repos/{owner}/{repo}/branches/{branch}"

VALID_CHANNELS = {"stable", "beta", "dev"}

_CACHE_TTL_SECONDS = 24 * 60 * 60
_cache: dict[str, tuple[float, UpdateInfo]] = {}


@dataclass
class UpdateInfo:
    available: bool
    current_version: str
    latest_version: str | None = None
    release_url: str | None = None
    release_notes: str | None = None
    message: str | None = None
    channel: str = "stable"
    target_ref: str | None = None  # tag or branch the updater would check out


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
    channel: str = "stable",
    repo_path: Path | None = None,
) -> UpdateInfo:
    """Check for a newer version on the given channel. Caches per-channel for 24h.

    Channels:
      - stable: latest non-prerelease GitHub release
      - beta:   latest GitHub release (including prereleases)
      - dev:    HEAD of the `dev` branch (commit SHA used as version)
    """
    global _cache
    if channel not in VALID_CHANNELS:
        channel = "stable"
    now = time.time()
    cache_key = f"{channel}:{':'.join(repo or DEFAULT_REPO)}"
    if use_cache and cache_key in _cache:
        ts, info = _cache[cache_key]
        if now - ts < _CACHE_TTL_SECONDS:
            return info

    owner, name = repo or detect_repo()

    if channel == "dev":
        info = _check_branch(owner, name, "dev", current_version, repo_path=repo_path)
    elif channel == "beta":
        info = _check_releases(owner, name, current_version, include_prereleases=True)
    else:
        info = _check_releases(owner, name, current_version, include_prereleases=False)

    info.channel = channel
    _cache[cache_key] = (now, info)
    return info


def _check_releases(
    owner: str, name: str, current_version: str, *, include_prereleases: bool
) -> UpdateInfo:
    if include_prereleases:
        url = GITHUB_API_RELEASES.format(owner=owner, repo=name)
    else:
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

    if include_prereleases:
        # Pick the newest release (drafts excluded) by version sort.
        releases = [r for r in (data or []) if not r.get("draft")]
        if not releases:
            return UpdateInfo(
                available=False,
                current_version=current_version,
                message="No releases found",
            )
        releases.sort(
            key=lambda r: _parse_version(str(r.get("tag_name", ""))) or Version("0"),
            reverse=True,
        )
        data = releases[0]

    tag = str(data.get("tag_name", ""))
    latest = _parse_version(tag)
    current = _parse_version(current_version)
    if latest is None or current is None:
        return UpdateInfo(
            available=False,
            current_version=current_version,
            message="Could not parse versions",
        )

    return UpdateInfo(
        available=latest > current,
        current_version=current_version,
        latest_version=str(latest),
        release_url=data.get("html_url"),
        release_notes=data.get("body"),
        target_ref=tag,
    )


def _local_head_short(repo_path: Path | None) -> str | None:
    if not repo_path:
        return None
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short=7", "HEAD"],
            cwd=str(repo_path),
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() or None
    except (FileNotFoundError, subprocess.SubprocessError):
        return None


def _check_branch(
    owner: str,
    name: str,
    branch: str,
    current_version: str,
    *,
    repo_path: Path | None = None,
) -> UpdateInfo:
    """For dev channel: track branch HEAD by commit SHA (short form)."""
    url = GITHUB_API_BRANCH.format(owner=owner, repo=name, branch=branch)
    try:
        resp = httpx.get(url, timeout=10.0, headers={"Accept": "application/vnd.github+json"})
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Dev channel check failed: %s", exc)
        return UpdateInfo(
            available=False,
            current_version=current_version,
            message=f"Dev channel check failed: {exc}",
        )
    sha = str((data.get("commit") or {}).get("sha") or "")
    if not sha:
        return UpdateInfo(
            available=False,
            current_version=current_version,
            message="No commits on dev branch",
        )
    short = sha[:7]
    # Prefer comparing against the local git HEAD; fall back to checking
    # whether the short SHA appears in the version string.
    local_short = _local_head_short(repo_path)
    available = local_short != short if local_short else short not in current_version
    return UpdateInfo(
        available=available,
        current_version=current_version,
        latest_version=f"dev@{short}",
        release_url=f"https://github.com/{owner}/{name}/commit/{sha}",
        release_notes=str(((data.get("commit") or {}).get("commit") or {}).get("message", "")),
        target_ref=branch,
    )


def perform_update(
    repo_path: Path,
    venv_pip: Path | None = None,
    *,
    channel: str = "stable",
) -> tuple[bool, str]:
    """Fetch + reset to the channel target, install requirements.

    Channels:
      - stable: latest non-prerelease tag (latest GitHub release)
      - beta:   latest tag (incl. prereleases) by version sort
      - dev:    HEAD of the `dev` branch
    Returns (success, message).
    """
    repo_path = Path(repo_path)
    if channel not in VALID_CHANNELS:
        channel = "stable"
    try:
        subprocess.run(
            ["git", "fetch", "origin", "--tags", "--prune"],
            cwd=repo_path,
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )

        if channel == "dev":
            target = "origin/dev"
        else:
            # Get tags by version sort.
            result = subprocess.run(
                ["git", "tag", "--sort=-v:refname"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )
            tags = [t for t in result.stdout.splitlines() if t.strip()]
            if channel == "stable":
                # Skip pre-releases (anything containing -alpha/-beta/-rc).
                tags = [t for t in tags if not _is_prerelease_tag(t)]
            if not tags:
                return False, f"No tags available on '{channel}' channel"
            target = tags[0]

        subprocess.run(
            ["git", "reset", "--hard", target],
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
        return True, f"Updated to {target}"
    except subprocess.CalledProcessError as exc:
        msg = exc.stderr.strip() if exc.stderr else str(exc)
        logger.error("Update failed: %s", msg)
        return False, f"Update failed: {msg}"
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        logger.error("Update failed: %s", exc)
        return False, f"Update failed: {exc}"


_PRERELEASE_RE = re.compile(r"-(alpha|beta|rc|dev)\b", re.IGNORECASE)


def _is_prerelease_tag(tag: str) -> bool:
    return bool(_PRERELEASE_RE.search(tag))


def clear_cache() -> None:
    global _cache
    _cache = {}
