#!/usr/bin/env bash
# Manual / debug launcher. Use this to run OutfitPi in a terminal,
# bypassing systemd. The systemd unit is preferred for normal operation.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [[ -d venv ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

exec python app.py
