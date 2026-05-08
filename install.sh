#!/usr/bin/env bash
# OutfitPi one-line installer.
# Usage: curl -sSL https://raw.githubusercontent.com/PhillyUrbs/OutfitPi/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/PhillyUrbs/OutfitPi.git"
INSTALL_DIR="${OUTFITPI_DIR:-$HOME/outfitpi}"
SERVICE_NAME="outfitpi"
USER_NAME="$(id -un)"

echo "── OutfitPi installer ──"
echo "User:    $USER_NAME"
echo "Install: $INSTALL_DIR"

# 1. Python 3.11+
if ! command -v python3 >/dev/null 2>&1; then
  echo "Installing python3..."
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv python3-pip
fi

PY_VER="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
PY_MAJOR="${PY_VER%%.*}"
PY_MINOR="${PY_VER##*.}"
if (( PY_MAJOR < 3 || (PY_MAJOR == 3 && PY_MINOR < 11) )); then
  echo "Python ${PY_VER} is too old. OutfitPi requires Python 3.11+."
  echo "Upgrade your OS (Raspberry Pi OS Bookworm ships 3.11)."
  exit 1
fi

# 2. git
if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  sudo apt-get install -y git
fi

# 3. Clone or pull
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "Updating existing checkout..."
  git -C "$INSTALL_DIR" fetch --all --tags
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  echo "Cloning $REPO_URL → $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# 4. venv + deps
if [[ ! -d "$INSTALL_DIR/venv" ]]; then
  python3 -m venv "$INSTALL_DIR/venv"
fi
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

# 5. systemd unit
UNIT_SRC="$INSTALL_DIR/scripts/outfitpi.service"
UNIT_DST="$HOME/.config/systemd/user/${SERVICE_NAME}.service"
mkdir -p "$(dirname "$UNIT_DST")"
cp "$UNIT_SRC" "$UNIT_DST"

# Use user systemd so no sudo is needed.
systemctl --user daemon-reload
systemctl --user enable "${SERVICE_NAME}.service"
systemctl --user restart "${SERVICE_NAME}.service" || \
  systemctl --user start "${SERVICE_NAME}.service"

# Lingering so the service runs even when the user is not logged in.
loginctl enable-linger "$USER_NAME" 2>/dev/null || true

# 6. Optional kiosk prompt
# Set OUTFITPI_KIOSK=1 to install non-interactively, or =0 to skip.
SETUP_KIOSK="${OUTFITPI_KIOSK:-}"
if [[ -z "$SETUP_KIOSK" && -t 0 ]]; then
  read -r -p "Set up Chromium kiosk for the touchscreen? [Y/n] " yn
  [[ "$yn" =~ ^[Nn]$ ]] && SETUP_KIOSK=0 || SETUP_KIOSK=1
fi
if [[ "$SETUP_KIOSK" == "1" ]]; then
  if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
    sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
  fi
  chmod +x "$INSTALL_DIR/scripts/kiosk.sh"
  AUTOSTART_DIR="$HOME/.config/autostart"
  mkdir -p "$AUTOSTART_DIR"
  cat > "$AUTOSTART_DIR/outfitpi-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=OutfitPi Kiosk
Exec=$INSTALL_DIR/scripts/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
  echo "Kiosk autostart installed: $AUTOSTART_DIR/outfitpi-kiosk.desktop"
fi

# 7. Print LAN IP for setup wizard
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LAN_IP="${LAN_IP:-localhost}"
cat <<EOF

╭────────────────────────────────────────────────╮
│  OutfitPi installed.                            │
│  Complete setup at: http://${LAN_IP}:5000
│                                                 │
│  Service status: systemctl --user status outfitpi
│  Logs:          journalctl --user -u outfitpi -f
╰────────────────────────────────────────────────╯
EOF
