## OutfitPi — Copilot Instructions

### Project
Kid-friendly weather-based outfit recommender displayed on a Raspberry Pi with the official touchscreen display.

### Target platforms
- Primary: Raspberry Pi 4 running Raspberry Pi OS (Bookworm+)
- Goal: ensure core functionality (weather fetch, outfit recommendation, kiosk display, settings UI) works on Pi 3/4/5 and non-Pi SBCs (Orange Pi, etc.). Hardware-specific extras (GPIO, official touchscreen quirks) may be Pi-only.
- Dev machine: Windows (Remote-SSH workflow)

### Tech stack
- **Language:** Python 3.9+ (minimum version shipped with Raspberry Pi OS Bullseye)
- **Web UI:** Flask + HTML/CSS/JS, run in Chromium kiosk mode on the Pi display
- **Weather API:** Open-Meteo (free, no API key)
- **Config:** YAML (`config.yaml`)

### Coding conventions
- Use `pathlib.Path` for all file paths (cross-platform)
- Use `httpx` for HTTP requests (async-ready)
- Format with Ruff; follow PEP 8
- Type hints on all public functions
- Keep Pi-specific code (display, GPIO) behind platform checks so the app runs on any Linux/macOS/Windows for development
- Target Python 3.9 syntax (no `X | Y` union types, use `Optional`/`Union` from `typing`)

### Testing
- Use `pytest` with fixtures for weather data mocking
- Tests must pass on both Windows (dev) and Linux (Pi)

### Telemetry (add as you go, don't bolt on later)
Use the helpers in `outfitpi.telemetry`: `breadcrumb()`, `capture_exception()`, `capture_message()`, `set_tags()`. They no-op when telemetry is disabled, so call sites stay clean.

#### Error handling
- Every new `except` that swallows or logs an error: also call `capture_exception(exc, **context_tags)`. Skip only for expected errors (e.g. `LocationNotConfiguredError` on a fresh install).
- Frontend: route user-visible failures (failed save, failed lookup, failed install, JS errors) through `reportClientError(action, message)` (in `static/js/settings.js`) so they POST to `/api/_client/error`.

#### State transitions
- Every new user-driven state change (settings save, channel switch, force install, theme change, mode override, etc.): add `breadcrumb("category", "what happened", **safe_data)`. Breadcrumbs are full-telemetry-only and ride along with the next event for free.

#### Long-running or failable operations
- Every new long-running or failable operation (update install, weather fetch, geocode, restart): add `capture_message` on success and failure with the relevant tags so we can see frequency and outage patterns.

#### Tagging
- Tag with: `channel`, `route`, `target_ref`, `units`, `theme`, and action-specific keys.
- Avoid PII — `before_send` already scrubs IPs/coords/child names, but the tag itself shouldn't be sensitive.

### No paid services
- Do not suggest paid APIs, extensions, or cloud services
