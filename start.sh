#!/bin/bash

GAME_URL="https://panzer.quest"
DISPLAY_NUM=":0"
SCREEN_W=1920
SCREEN_H=1080
COLS=4
ROWS=2
TILE_W=$((SCREEN_W / COLS))
TILE_H=$((SCREEN_H / ROWS))

export DISPLAY=$DISPLAY_NUM

echo "→ Stopping existing processes..."
pkill -f Xvfb        2>/dev/null || true
pkill -f chromium    2>/dev/null || true
pkill -f x11vnc      2>/dev/null || true
pkill -f websockify  2>/dev/null || true
pkill -f "node broadcast" 2>/dev/null || true
sleep 1

echo "→ Starting virtual display ${SCREEN_W}x${SCREEN_H}..."
Xvfb $DISPLAY_NUM -screen 0 ${SCREEN_W}x${SCREEN_H}x24 -ac +extension GLX +render -noreset &
sleep 2

echo "→ Starting window manager..."
openbox &
sleep 1

CHROME_FLAGS=(
  --no-sandbox
  --disable-gpu
  --disable-dev-shm-usage
  --disable-background-networking
  --disable-sync
  --disable-extensions
  --disable-default-apps
  --disable-infobars
  --disable-notifications
  --disable-translate
  --disable-logging
  --disable-breakpad
  --disable-component-update
  --mute-audio
  --no-first-run
  --no-default-browser-check
  --process-per-site
  --js-flags="--max-old-space-size=128"
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  --force-color-profile=srgb
  --password-store=basic
  --use-mock-keychain
)

echo "→ Launching 8 Chromium instances..."
for i in $(seq 0 7); do
  COL=$((i % COLS))
  ROW=$((i / COLS))
  X=$((COL * TILE_W))
  Y=$((ROW * TILE_H))

  chromium-browser "${CHROME_FLAGS[@]}" \
    --window-position=$X,$Y \
    --window-size=$TILE_W,$TILE_H \
    --user-data-dir="/tmp/chrome-profile-$i" \
    --app="$GAME_URL" &

  sleep 0.5
done

echo "→ Waiting for windows to settle..."
sleep 6

for win in $(xdotool search --class chromium 2>/dev/null); do
  wmctrl -i -r $win -e "0,$(xdotool getwindowgeometry --shell $win | grep -oP '(?<=X=)\d+'),$(xdotool getwindowgeometry --shell $win | grep -oP '(?<=Y=)\d+'),$TILE_W,$TILE_H" 2>/dev/null || true
done

echo "→ Starting x11vnc..."
x11vnc -display $DISPLAY_NUM -forever -nopw -shared \
  -rfbport 5900 -noscr -nobell -noxdamage \
  -nocursorshape -nocursor -quiet &
sleep 1

echo "→ Starting noVNC..."
websockify --web=/usr/share/novnc 6080 localhost:5900 &
sleep 1

echo "→ Starting broadcast server..."
node broadcast-server.js &

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ PanzerQuest 8x READY"
echo "  📺 Full display  → port 6080 (noVNC)"
echo "  🎮 Broadcast     → port 8080 (panel)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
wait
