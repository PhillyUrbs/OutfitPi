# Contributing

Thanks for your interest in OutfitPi!

## Dev setup

```bash
git clone https://github.com/PhillyUrbs/OutfitPi.git
cd OutfitPi
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -e .[dev]
```

## Run

```bash
python app.py
# Open http://localhost:5000
```

The app needs a `config.yaml`. The first request redirects to the setup
wizard, or copy `config.example.yaml` to `config.yaml` to skip it.

## Tests & lint

```bash
ruff check .
pytest tests/ -v
```

Both must pass on **Python 3.11 and 3.12** before a PR is merged. CI
runs the same matrix on Ubuntu.

## Code style

- PEP 8, formatted via Ruff
- Type hints on public functions
- `pathlib.Path` for paths
- `httpx` for HTTP
- Keep Pi-specific code (display, GPIO) behind platform checks so the app
  runs unmodified on macOS/Windows for development
- No `from __future__ import annotations` is required, but it is used in
  most modules — keep it consistent

## Branches & PRs

- Work in feature branches: `feat/<short-name>`, `fix/<short-name>`
- One topic per PR; keep diffs reviewable
- Update tests when behaviour changes
- Reference any related issue in the PR body

## Release process

1. Bump `__version__` in `outfitpi/__init__.py`
2. Update `CHANGELOG` (if/when added) and commit
3. Tag: `git tag -a v0.2.0 -m "v0.2.0"` and push tag
4. Wait for CI to go green on `main`
5. Create the GitHub release: `gh release create v0.2.0 --generate-notes`

The in-app updater watches `releases/latest` and will offer the new
version on the Pi within 24h (or immediately on manual check).
