const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer }       = require('ws');
const { execSync, spawn }       = require('child_process');

const DISPLAY = process.env.DISPLAY || ':0';
const PORT    = 8080;

// ── Window cache (refresh every 10s) ─────────────────────────────────────────
let cachedWins    = [];
let lastRefresh   = 0;
let geoCache      = {};

function getWindows(force = false) {
  const now = Date.now();
  if (force || now - lastRefresh > 10000) {
    try {
      cachedWins = execSync('xdotool search --class chromium', {
        env: { ...process.env, DISPLAY }, timeout: 2000
      }).toString().trim().split('\n').filter(Boolean);
    } catch { cachedWins = []; }
    geoCache   = {};   // invalidate geometry on refresh
    lastRefresh = now;
    console.log(`[wins] ${cachedWins.length} chromium windows`);
  }
  return cachedWins;
}

function getGeo(wid) {
  if (geoCache[wid]) return geoCache[wid];
  try {
    const out = execSync(`xdotool getwindowgeometry --shell ${wid}`, {
      env: { ...process.env, DISPLAY }, timeout: 1000
    }).toString();
    const x = parseInt(out.match(/X=(\d+)/)?.[1]);
    const y = parseInt(out.match(/Y=(\d+)/)?.[1]);
    const w = parseInt(out.match(/WIDTH=(\d+)/)?.[1]);
    const h = parseInt(out.match(/HEIGHT=(\d+)/)?.[1]);
    if ([x,y,w,h].some(isNaN)) return null;
    geoCache[wid] = { x, y, w, h };
    return geoCache[wid];
  } catch { return null; }
}

// ── Parallel xdotool helper ───────────────────────────────────────────────────
// Spawns one xdotool process per window simultaneously — true parallel broadcast
function xdoParallel(wins, argsFn) {
  return Promise.all(wins.map(wid => new Promise(resolve => {
    const args = argsFn(wid);
    if (!args) return resolve();
    const p = spawn('xdotool', args, {
      env: { ...process.env, DISPLAY }, stdio: 'ignore'
    });
    p.on('close', resolve);
    p.on('error', resolve);
  })));
}

// ── Key mapping ───────────────────────────────────────────────────────────────
const KEY_MAP = {
  ' ': 'space', Enter: 'Return', Escape: 'Escape', Tab: 'Tab',
  Backspace: 'BackSpace', Delete: 'Delete',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'Prior', PageDown: 'Next',
  F1:'F1',F2:'F2',F3:'F3',F4:'F4',F5:'F5',F6:'F6',
  F7:'F7',F8:'F8',F9:'F9',F10:'F10',F11:'F11',F12:'F12',
  Control:'ctrl', Shift:'shift', Alt:'alt', Meta:'super',
  CapsLock:'Caps_Lock', NumLock:'Num_Lock',
};
const MOD_XMAP = { ctrlKey:'ctrl', shiftKey:'shift', altKey:'alt', metaKey:'super' };

function resolveKey(jsKey) {
  return KEY_MAP[jsKey] ?? (jsKey.length === 1 ? jsKey : null);
}

function comboStr(xkey, mods) {
  const pre = Object.entries(mods)
    .filter(([k, v]) => v && MOD_XMAP[k] && MOD_XMAP[k] !== xkey)
    .map(([k]) => MOD_XMAP[k]).join('+');
  return pre ? `${pre}+${xkey}` : xkey;
}

// ── Throttled mousemove ───────────────────────────────────────────────────────
let lastMove = 0;
const MOVE_THROTTLE = 16; // ~60fps

// ── Event dispatcher ──────────────────────────────────────────────────────────
async function dispatch(event) {
  const wins = getWindows();
  if (!wins.length) return 0;

  switch (event.type) {

    case 'keydown': {
      const xkey = resolveKey(event.key);
      if (!xkey) break;
      const combo = comboStr(xkey, event.mods ?? {});
      await xdoParallel(wins, wid => ['keydown', '--clearmodifiers', '--window', wid, combo]);
      break;
    }

    case 'keyup': {
      const xkey = resolveKey(event.key);
      if (!xkey) break;
      const combo = comboStr(xkey, event.mods ?? {});
      await xdoParallel(wins, wid => ['keyup', '--clearmodifiers', '--window', wid, combo]);
      break;
    }

    case 'mousemove': {
      const now = Date.now();
      if (now - lastMove < MOVE_THROTTLE) break;
      lastMove = now;
      await xdoParallel(wins, wid => {
        const g = getGeo(wid);
        if (!g) return null;
        const ax = g.x + Math.round(event.tx * g.w);
        const ay = g.y + Math.round(event.ty * g.h);
        return ['mousemove', String(ax), String(ay)];
      });
      break;
    }

    case 'mousedown': {
      const btn = String(event.button ?? 1);
      await xdoParallel(wins, wid => {
        const g = getGeo(wid);
        if (!g) return null;
        const ax = g.x + Math.round(event.tx * g.w);
        const ay = g.y + Math.round(event.ty * g.h);
        return ['mousemove', String(ax), String(ay), 'mousedown', btn];
      });
      break;
    }

    case 'mouseup': {
      const btn = String(event.button ?? 1);
      await xdoParallel(wins, wid => {
        const g = getGeo(wid);
        if (!g) return null;
        const ax = g.x + Math.round(event.tx * g.w);
        const ay = g.y + Math.round(event.ty * g.h);
        return ['mousemove', String(ax), String(ay), 'mouseup', btn];
      });
      break;
    }

    case 'scroll': {
      const btn = event.dy < 0 ? '4' : '5';
      const reps = Math.min(Math.abs(event.dy ?? 1), 5);
      for (let i = 0; i < reps; i++) {
        await xdoParallel(wins, wid => {
          const g = getGeo(wid);
          if (!g) return null;
          const ax = g.x + Math.round((event.tx ?? 0.5) * g.w);
          const ay = g.y + Math.round((event.ty ?? 0.5) * g.h);
          return ['mousemove', String(ax), String(ay), 'click', btn];
        });
      }
      break;
    }

    case 'ping':
      getWindows(true); // force refresh
      break;
  }

  return getWindows().length;
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const p = req.url === '/' ? '/dashboard.html' : req.url;
  const f = path.join(__dirname, p);
  if (fs.existsSync(f)) {
    const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'text/plain' });
    fs.createReadStream(f).pipe(res);
  } else { res.writeHead(404); res.end(); }
});

// ── WS ────────────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  console.log('[ws] connected');
  ws.on('message', async raw => {
    let ev;
    try { ev = JSON.parse(raw.toString()); } catch { return; }
    const n = await dispatch(ev);
    if (ws.readyState === 1)
      ws.send(JSON.stringify({ type: 'ack', windows: n }));
  });
  ws.on('close', () => console.log('[ws] disconnected'));
});

server.listen(PORT, () => console.log(`[broadcast-server] :${PORT}`));
