## OutfitPi — Copilot Instructions

### Project
Kid-friendly weather-based outfit recommender displayed on a Raspberry Pi with the official touchscreen display.

### Target platforms
- Primary: Raspberry Pi 4 running Raspberry Pi OS (Bookworm+)
- Goal: support Pi 3/4/5 and non-Pi SBCs (Orange Pi, etc.) where possible
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

### No paid services
- Do not suggest paid APIs, extensions, or cloud services
