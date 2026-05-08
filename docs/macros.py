"""mkdocs-macros hook: provides {{ img(...) }} that falls back to a
placeholder PNG when the real screenshot hasn't been captured yet
(e.g. on dev branch builds).
"""

from __future__ import annotations

from pathlib import Path


def define_env(env):
    docs_dir = Path(env.conf["docs_dir"])
    img_dir = docs_dir / "img"

    @env.macro
    def img(name: str, alt: str = "", lazy: bool = True) -> str:
        target = img_dir / name
        rel = f"img/{name}" if target.exists() else "img/_placeholder.png"
        attrs = "{ loading=lazy }" if lazy else ""
        return f"![{alt}]({rel}){attrs}"
