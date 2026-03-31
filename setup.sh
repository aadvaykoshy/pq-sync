#!/bin/bash
set -e

echo "→ Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  xvfb \
  openbox \
  x11vnc \
  xdotool \
  wmctrl \
  websockify \
  novnc \
  chromium-browser \
  2>/dev/null

echo "→ Installing Node dependencies..."
cd /workspaces/$(ls /workspaces | head -1)
npm install ws 2>/dev/null

echo "✅ Setup complete."
