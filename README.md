# PanzerQuest 8x Command

8 simultaneous Chromium instances in one Codespace, with broadcast input control.

## Setup

1. Push this repo to GitHub
2. Open in Codespaces → **New codespace** → choose **4-core / 8GB** machine
3. Codespaces auto-runs `setup.sh` (installs deps) then `start.sh` (launches everything)
4. Two ports will be forwarded:
   - **:8080** → Broadcast control panel (opens automatically)
   - **:6080** → Full display via noVNC (open manually from port panel)

## Usage

### View all 8 windows
Open port **6080** in the Codespaces ports panel → opens noVNC showing the full 1920×1080 display with all 8 tiles.

### Broadcast control
Port **8080** is the command panel:
1. Click **[ BROADCAST OFF ]** to enable broadcast mode
2. **Keyboard** — click the keyboard zone, then type normally → all 8 windows receive the keystroke
3. **Click pad** — click anywhere on the pad → the relative position is clicked in all 8 windows
4. **Quick keys** — ESC, Enter, Space, Tab, arrow keys

## Chromium optimisations
Each instance runs with:
- 128MB JS heap cap
- GPU disabled (not available in Xvfb anyway)
- Background throttling disabled (so all 8 stay active)
- Separate user-data-dir (separate sessions/logins)
- No extensions, sync, or background networking

## Changing the game URL
Edit `start.sh`, line 4:
```bash
GAME_URL="https://panzerquest.com"
```

## Codespaces hours (GitHub Education)
- 4-core machine = 4 core-hours per clock hour
- GitHub Pro/Education: 90 core-hours/month free
- = ~22 hrs/month, ~45 min/day
- Extra hours billed at ~$0.072/hr — very cheap for occasional extra use
