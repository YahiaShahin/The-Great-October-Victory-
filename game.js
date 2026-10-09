/* ============================================================
   نصر أكتوبر العظيم — The Great October Victory
   A retro pixel-art shoot-'em-up with a hangar, weapons, skins,
   two currencies, elite enemy tiers and five boss fights.
   Vanilla JS + Canvas. Internal resolution 320x180, scaled up with
   image-rendering: pixelated. All sprites are drawn with rectangles.
   ============================================================ */
'use strict';

/* ============================================================
   ALIEN PILOT CHATTER — edit this list to add your own lines!
   Just add more strings. The pixel font supports:
   A-Z, 0-9 and  : $ - + ! . , / % ? > < ' * = ( ) |
   (anything else shows up as a "?"). Keep lines under ~30 characters
   so the bubble fits on screen.
   ============================================================ */
const SPEECH_LINES = [
  'KHAMAS!!',
  'YOU ARE ANTISEMENTIC',
  'WHERE IS MY MONEY?!',
  'KHAMAS!!',
  'KHAMAS!!',
  'KHAMAS!!',
  'KHAMAS!!',
  'KHAMAS!!',
  'ITS A NEW HOLOCOST!'
];
const TALK_MIN = 4;        // seconds between lines (min) for each enemy
const TALK_MAX = 9;        // seconds between lines (max)
const MAX_BUBBLES = 3;     // most speech bubbles on screen at once

/* ALIEN LOOK — make the nose and hat as silly as you like.
   0 = the original size; each +1 adds one more pixel. */
const PILOT_NOSE = 3;      // extra nose length (pixels, points left)
const PILOT_HAT = 3;       // extra hat height (pixels, stovepipe style)

(() => {
  /* ---------------------------------------------------------
     Setup & helpers
  --------------------------------------------------------- */
  const W = 320, H = 180, HUD_H = 14, HORIZON = H - 30;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const pad = (n, len = 6) => String(Math.floor(n)).padStart(len, '0');
  const mod = (n, m) => ((n % m) + m) % m;
  const fmt = (n) => String(Math.floor(n));

  const keys = new Set();
  const down = (...codes) => codes.some((c) => keys.has(c));

  /* ---------------------------------------------------------
     3x5 bitmap font (every letter is truly pixel-perfect)
  --------------------------------------------------------- */
  const GLYPHS = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011',
    D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111',
    J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111',
    V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111',
    3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
    6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110',
    ':': '000010000010000', $: '011110010011110', '-': '000000111000000',
    '+': '000010111010000', '!': '010010010000010', '.': '000000000000010',
    ',': '000000000010100', '/': '001001010100100', '%': '101001010100101',
    '?': '110001010000010', '>': '100010001010100', '<': '001010100010001',
    "'": '010010000000000', '*': '101010111010101', '=': '000111000111000',
    '(': '001010010010001', ')': '100010010010100', '|': '010010010010010',
    ' ': '000000000000000',
  };

  const textW = (s, sc = 1) => String(s).length * 4 * sc - sc;

  function drawGlyphs(s, x, y, col, sc) {
    ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const g = GLYPHS[s[i]] || GLYPHS['?'];
      for (let k = 0; k < 15; k++) {
        if (g[k] === '1') {
          ctx.fillRect(x + i * 4 * sc + (k % 3) * sc, y + Math.floor(k / 3) * sc, sc, sc);
        }
      }
    }
  }

  function text(str, x, y, col = '#fff', sc = 1, shadow = null, align = 'left') {
    const s = String(str).toUpperCase();
    if (align === 'center') x -= Math.floor(textW(s, sc) / 2);
    else if (align === 'right') x -= textW(s, sc);
    x = Math.round(x); y = Math.round(y);
    if (shadow) drawGlyphs(s, x + sc, y + sc, shadow, sc);
    drawGlyphs(s, x, y, col, sc);
  }

  /* ---------------------------------------------------------
     Sprite helpers
  --------------------------------------------------------- */
  function makeSprite(w, h, art) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    art((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); });
    return c;
  }

  function tint(src, col) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function tintOver(src, col, a) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = a;
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* cached recolours: tier 1 = normal, 2 = gold elite, 3 = red ace, 'w' = hit flash */
  function variant(c, tier, white) {
    c._v = c._v || {};
    const k = white ? 'w' : tier;
    if (!c._v[k]) {
      c._v[k] = white ? tint(c, '#ffffff')
        : tier === 2 ? tintOver(c, '#ffd23f', 0.5)
        : tier >= 3 ? tintOver(c, '#ff2a2a', 0.55) : c;
    }
    return c._v[k];
  }

  const blit = (img, x, y) => ctx.drawImage(img, Math.round(x), Math.round(y));

  const FLAG_RED = '#ce1126', FLAG_WHITE = '#ffffff', FLAG_BLACK = '#111111', GOLD = '#ffd23f';

  /* ---- The player's F-35 (34x13), recolourable for skins ---- */
  function buildPlayer(p) {
    return makeSprite(34, 13, (r) => {
      const { dark, mid, light, cock, cockD } = p;
      r(3, 0, 8, 5, dark);                                   // tail fin with flag
      r(4, 1, 6, 1, FLAG_RED); r(4, 2, 6, 1, FLAG_WHITE); r(4, 3, 6, 1, FLAG_BLACK);
      r(6, 2, 2, 1, GOLD);
      r(4, 5, 24, 5, mid); r(5, 5, 22, 1, light); r(4, 9, 24, 1, dark);   // fuselage
      r(28, 6, 4, 3, mid); r(32, 7, 2, 1, mid); r(33, 7, 1, 1, dark);      // nose
      r(1, 6, 3, 3, dark); r(2, 7, 1, 1, '#222222'); r(1, 9, 5, 2, dark);  // exhaust/stabiliser
      r(19, 5, 6, 1, cockD); r(19, 4, 6, 1, cock); r(20, 3, 4, 1, cock); r(21, 3, 2, 1, '#ffffff');
      r(23, 8, 3, 2, '#222222');                                             // intake
      r(11, 6, 6, 1, FLAG_RED); r(11, 7, 6, 1, FLAG_WHITE); r(11, 8, 6, 1, FLAG_BLACK); r(13, 7, 2, 1, GOLD);
      r(9, 10, 13, 1, light); r(8, 11, 10, 1, mid); r(7, 12, 7, 1, dark);    // wing
    });
  }

  const SPR = {};
  SPR.wingman = makeSprite(9, 5, (r) => {
    r(0, 2, 9, 2, '#8a95a6'); r(6, 1, 2, 1, '#4fd8ff'); r(2, 0, 3, 2, '#3a4252');
    r(2, 4, 3, 1, '#3a4252'); r(0, 2, 1, 2, '#3a4252');
  });

  /* ---- Enemies (all face left) ---- */
  function droneArt(f) {
    return makeSprite(13, 9, (r) => {
      const rot = '#cfd8ff', dk = '#2a1740', body = '#7b3fa0', hi = '#b57be0';
      if (f === 0) { r(0, 0, 5, 1, rot); r(8, 0, 5, 1, rot); } else { r(1, 0, 3, 1, rot); r(9, 0, 3, 1, rot); }
      r(2, 1, 1, 2, dk); r(10, 1, 1, 2, dk); r(2, 2, 9, 1, dk);
      r(3, 3, 7, 3, body); r(4, 3, 5, 1, hi);
      r(5, 4, 3, 2, '#ff3b3b'); r(6, 4, 1, 1, '#ffffff');
      r(4, 6, 5, 1, dk); r(3, 7, 1, 2, dk); r(9, 7, 1, 2, dk);
    });
  }
  function jetArt() {
    return makeSprite(20, 9, (r) => {
      r(2, 3, 16, 3, '#b3412b'); r(0, 4, 3, 1, '#b3412b'); r(0, 4, 1, 1, '#2a0f0a');
      r(3, 3, 14, 1, '#e0603f'); r(3, 5, 15, 1, '#6e2417');
      r(6, 2, 5, 1, '#f5c542'); r(7, 3, 3, 1, '#c8962a');
      r(15, 0, 3, 3, '#8c2d1c'); r(16, 0, 1, 1, '#e0603f');
      r(8, 6, 8, 1, '#8c2d1c'); r(10, 7, 6, 1, '#6e2417'); r(12, 8, 3, 1, '#4a170f');
      r(18, 3, 2, 3, '#4a170f');
    });
  }
  function gunshipArt(f) {
    return makeSprite(24, 14, (r) => {
      const rot = '#cfd8ff';
      if (f === 0) r(2, 0, 20, 1, rot); else r(5, 0, 14, 1, rot);
      r(11, 1, 2, 2, '#222222');
      r(6, 3, 13, 6, '#2f5d62'); r(4, 4, 3, 4, '#2f5d62');
      r(7, 3, 11, 1, '#4f8f95'); r(6, 8, 13, 1, '#1e3d40');
      r(4, 4, 4, 3, '#7fd6ff'); r(5, 4, 1, 1, '#ffffff');
      r(10, 5, 5, 2, '#1e3d40');
      r(19, 5, 5, 2, '#2f5d62'); r(21, 3, 2, 1, '#1e3d40'); r(22, 3, 1, 5, rot);
      r(0, 8, 4, 1, '#222222'); r(0, 7, 2, 1, '#222222');
      r(6, 10, 13, 1, '#222222'); r(8, 9, 1, 1, '#222222'); r(16, 9, 1, 1, '#222222');
    });
  }
  function spinnerArt(f) {
    return makeSprite(15, 15, (r) => {
      r(4, 2, 7, 11, '#4b3a7a'); r(2, 4, 11, 7, '#4b3a7a'); r(3, 3, 9, 9, '#5d4a94');
      r(5, 5, 5, 5, '#ff3b3b'); r(7, 7, 1, 1, '#ffffff');
      if (f === 0) { r(6, 0, 3, 3, '#222222'); r(6, 12, 3, 3, '#222222'); r(0, 6, 3, 3, '#222222'); r(12, 6, 3, 3, '#222222'); }
      else { r(1, 1, 3, 3, '#222222'); r(11, 1, 3, 3, '#222222'); r(1, 11, 3, 3, '#222222'); r(11, 11, 3, 3, '#222222'); }
    });
  }
  function interceptorArt() {
    return makeSprite(22, 10, (r) => {
      r(2, 4, 18, 3, '#2b8a9e'); r(0, 5, 3, 1, '#2b8a9e'); r(4, 3, 12, 1, '#5fd0e0'); r(4, 7, 14, 1, '#1b5a68');
      r(8, 2, 5, 2, '#ffe066'); r(10, 0, 6, 3, '#1b5a68'); r(10, 7, 8, 3, '#1b5a68');
      r(18, 2, 3, 3, '#1b5a68'); r(20, 4, 2, 3, '#0f2f36');
    });
  }
  function bomberArt() {
    return makeSprite(30, 14, (r) => {
      r(2, 5, 26, 5, '#4a4f5c'); r(0, 7, 4, 2, '#4a4f5c'); r(4, 5, 22, 1, '#6b7280'); r(4, 9, 24, 1, '#2e3240');
      r(3, 5, 4, 2, '#ffb02e'); r(10, 0, 10, 5, '#383c48'); r(10, 10, 10, 4, '#383c48');
      r(24, 1, 5, 4, '#383c48'); r(12, 10, 8, 2, '#111111'); r(14, 7, 2, 2, '#ff3b3b');
    });
  }
  function carrierArt(f) {
    return makeSprite(34, 18, (r) => {
      r(2, 6, 30, 8, '#556070'); r(4, 4, 24, 2, '#7a8798'); r(20, 0, 8, 4, '#556070'); r(22, 1, 4, 1, '#ffe066');
      r(0, 8, 3, 4, '#556070'); r(8, 9, 5, 4, '#222222'); r(16, 9, 5, 4, '#222222');
      r(4, 13, 26, 1, '#3a4452'); r(31, 7, 3, 6, '#2b3340');
      r(9 + f * 8, 10, 3, 2, '#ff3b3b');
    });
  }

  SPR.drone = [droneArt(0), droneArt(1)];
  SPR.jet = [jetArt()];
  SPR.gunship = [gunshipArt(0), gunshipArt(1)];
  SPR.spinner = [spinnerArt(0), spinnerArt(1)];
  SPR.interceptor = [interceptorArt()];
  SPR.bomber = [bomberArt()];
  SPR.carrier = [carrierArt(0), carrierArt(1)];

  /* ---- Silly alien pilot (11x12): antennae, big eyes, long nose, black hat, diaper ---- */
  SPR.pilot = makeSprite(11 + PILOT_NOSE, 12 + PILOT_HAT, (r0) => {
    const G = '#f3e595', GD = '#e4c954', PINK = '#ff4fd8', HAT = '#111111';
    const o = PILOT_NOSE, t = PILOT_HAT;
    const r = (x, y, w, h, c) => r0(x + o, y + t, w, h, c);   // shifted so the long nose and tall hat have room
    r0(2 + o, 0, 1, 3 + t, G); r0(8 + o, 0, 1, 3 + t, G);     // antennae (grow with the hat)
    r0(2 + o, 0, 1, 1, PINK); r0(8 + o, 0, 1, 1, PINK);
    r0(3 + o, 1, 5, 2 + t, HAT); r(1, 3, 9, 1, HAT);          // black hat: tall crown + brim
    r(2, 4, 7, 5, G); r(2, 8, 7, 1, GD);                      // head
    r0(0, 6 + t, 3 + o, 2, G); r0(0, 6 + t, 1, 2, GD);        // long nose (points left)
    r(3, 5, 2, 2, '#111111'); r(6, 5, 2, 2, '#111111');                             // big eyes
    r(3, 5, 1, 1, '#ffffff'); r(6, 5, 1, 1, '#ffffff');
    r(4, 8, 3, 1, '#1a5a30');                                                       // goofy mouth
    r(3, 9, 5, 1, G);                                                               // tiny body
    r(2, 10, 7, 2, '#ffffff'); r(2, 11, 7, 1, '#d8d8e8'); r(5, 10, 1, 1, GOLD);     // diaper + pin
  });
  const PILOT_FLASH = tint(SPR.pilot, '#ffffff');

  /* ---- Bosses ---- */
  function bossHawk() {
    return makeSprite(50, 30, (r) => {
      r(8, 11, 38, 9, '#3b4a63'); r(9, 11, 36, 2, '#5a6f94'); r(9, 18, 36, 2, '#25304a');
      r(0, 14, 10, 3, '#3b4a63'); r(0, 15, 3, 1, '#ff4d6d');
      r(14, 3, 16, 8, '#2c3850'); r(16, 4, 12, 2, '#4a5c80');
      r(14, 20, 16, 8, '#2c3850'); r(16, 22, 12, 2, '#4a5c80');
      r(40, 5, 8, 6, '#2c3850'); r(40, 20, 8, 6, '#2c3850');
      r(12, 9, 8, 3, '#ff4d6d'); r(13, 9, 3, 1, '#ffd0d8');
      r(22, 14, 10, 1, '#ff4d6d'); r(46, 13, 4, 5, '#1a1f2e');
    });
  }
  function bossCarrier(f) {
    return makeSprite(62, 28, (r) => {
      r(2, 10, 56, 10, '#4a5568'); r(6, 6, 46, 4, '#6b7a90'); r(40, 0, 12, 6, '#4a5568'); r(42, 1, 8, 2, '#ffe066');
      r(0, 12, 4, 6, '#4a5568'); r(10, 12, 10, 6, '#1c2230'); r(24, 12, 10, 6, '#1c2230'); r(38, 12, 10, 6, '#1c2230');
      r(2, 20, 56, 3, '#2f3745'); r(58, 11, 4, 8, '#2b3340');
      r(12 + f * 14, 14, 4, 2, '#ff3b3b'); r(6, 8, 40, 1, '#8a99ad');
    });
  }
  function bossSpinner(f) {
    return makeSprite(42, 42, (r) => {
      const c = 21;
      for (let dy = -12; dy <= 12; dy++) { const w = Math.floor(Math.sqrt(144 - dy * dy)); r(c - w, c + dy, w * 2, 1, '#4b3a7a'); }
      for (let dy = -9; dy <= 9; dy++) { const w = Math.floor(Math.sqrt(81 - dy * dy)); r(c - w, c + dy, w * 2, 1, '#5d4a94'); }
      for (let dy = -5; dy <= 5; dy++) { const w = Math.floor(Math.sqrt(25 - dy * dy)); r(c - w, c + dy, w * 2, 1, '#ff3b3b'); }
      r(20, 20, 2, 2, '#ffffff');
      if (f === 0) { r(19, 0, 4, 9, '#222222'); r(19, 33, 4, 9, '#222222'); r(0, 19, 9, 4, '#222222'); r(33, 19, 9, 4, '#222222'); }
      else { r(3, 3, 6, 6, '#222222'); r(33, 3, 6, 6, '#222222'); r(3, 33, 6, 6, '#222222'); r(33, 33, 6, 6, '#222222'); }
    });
  }
  function bossBomber() {
    return makeSprite(66, 30, (r) => {
      r(2, 12, 60, 8, '#4a5370'); r(4, 12, 56, 2, '#6a7496');
      r(16, 2, 22, 10, '#5a6486'); r(16, 20, 22, 8, '#5a6486');
      r(56, 6, 8, 6, '#5a6486'); r(56, 20, 8, 6, '#5a6486');
      r(2, 13, 8, 3, '#ffb02e'); r(26, 20, 16, 3, '#111111');
      r(30, 14, 2, 2, '#ff3b3b'); r(40, 14, 2, 2, '#ff3b3b'); r(18, 0, 6, 2, '#ffb02e');
    });
  }
  function bossOmega(f) {
    return makeSprite(52, 52, (r) => {
      r(16, 0, 20, 52, '#2a2438'); r(0, 16, 52, 20, '#2a2438'); r(8, 8, 36, 36, '#3a3350');
      r(12, 12, 28, 28, '#4b4468'); r(14, 14, 24, 24, '#2a2438');
      r(20, 20, 12, 12, '#ff3b3b'); r(22, 22, 8, 8, '#ff9d9d'); r(25, 25, 2, 2, '#ffffff');
      r(2, 2, 8, 8, '#555566'); r(42, 2, 8, 8, '#555566'); r(2, 42, 8, 8, '#555566'); r(42, 42, 8, 8, '#555566');
      r(24, 0, 4, 4, GOLD); r(24, 48, 4, 4, GOLD); r(0, 24, 4, 4, GOLD); r(48, 24, 4, 4, GOLD);
      r(4 + f * 40, 4 + f * 40, 4, 4, '#ff3b3b');
    });
  }
  SPR.b_hawk = [bossHawk()];
  SPR.b_carrier = [bossCarrier(0), bossCarrier(1)];
  SPR.b_spinner = [bossSpinner(0), bossSpinner(1)];
  SPR.b_bomber = [bossBomber()];
  SPR.b_omega = [bossOmega(0), bossOmega(1)];

  /* ---- Icons ---- */
  function drawCoinIcon(x, y) {
    [4, 6, 8, 8, 8, 8, 6, 4].forEach((w, j) => {
      ctx.fillStyle = '#7a5200'; ctx.fillRect(x + (8 - w) / 2, y + j, w, 1);
    });
    ctx.fillStyle = GOLD; ctx.fillRect(x + 1, y + 2, 6, 4); ctx.fillRect(x + 2, y + 1, 4, 6);
    ctx.fillStyle = '#fff3a0'; ctx.fillRect(x + 2, y + 2, 1, 2);
    ctx.fillStyle = '#b8860b'; ctx.fillRect(x + 4, y + 3, 1, 2);
  }
  function drawGemIcon(x, y) {
    [1, 3, 5, 7, 5, 3, 1].forEach((w, j) => {
      ctx.fillStyle = '#1c86b5'; ctx.fillRect(x + (7 - w) / 2, y + j, w, 1);
    });
    ctx.fillStyle = '#4fd8ff'; ctx.fillRect(x + 2, y + 2, 3, 3); ctx.fillRect(x + 3, y + 1, 1, 5);
    ctx.fillStyle = '#d8f8ff'; ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 3, y + 1, 1, 1);
  }
  function drawBombIcon(x, y) {
    [3, 5, 7, 7, 7, 5, 3].forEach((w, j) => {
      ctx.fillStyle = '#20222c'; ctx.fillRect(x + (7 - w) / 2, y + 1 + j, w, 1);
    });
    ctx.fillStyle = '#5a5f78'; ctx.fillRect(x + 2, y + 3, 1, 2);
    ctx.fillStyle = '#ffb02e'; ctx.fillRect(x + 5, y, 2, 1); ctx.fillRect(x + 4, y + 1, 1, 1);
  }

  /* ---- Egyptian flag with golden eagle ---- */
  const flagCanvas = makeSprite(36, 24, (r) => {
    r(0, 0, 36, 8, FLAG_RED); r(0, 8, 36, 8, FLAG_WHITE); r(0, 16, 36, 8, FLAG_BLACK);
    ['.y...y.', 'yyyyyyy', '.yyyyy.', '..yyy..', '...y...'].forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === 'y') r(15 + i, 9 + j, 1, 1, '#c09300');
    });
  });
  function drawFlag(x, y, t) {
    for (let i = 0; i < 36; i++) {
      const oy = Math.round(Math.sin(i * 0.38 - t * 5) * 1.6 * (0.3 + i / 36));
      ctx.drawImage(flagCanvas, i, 0, 1, 24, x + i, y + oy, 1, 24);
    }
  }

  /* ---- Chunky, hard-edged Arabic title ---- */
  let titleMask = null;
  function buildTitle() {
    const str = 'نصر أكتوبر العظيم';
    const fam = "'Segoe UI','Tahoma','Noto Naskh Arabic','Noto Sans Arabic','Geeza Pro','Arial',sans-serif";
    const m = document.createElement('canvas').getContext('2d');
    let px = 40;
    do {
      m.font = `bold ${px}px ${fam}`;
      if (m.measureText(str).width <= 184) break;
      px -= 2;
    } while (px > 14);
    const w = Math.ceil(m.measureText(str).width) + 10;
    const h = Math.ceil(px * 1.5) + 8;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.font = `bold ${px}px ${fam}`;
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(str, w / 2, h / 2);
    const id = g.getImageData(0, 0, w, h);               // threshold alpha -> pure pixels
    for (let i = 3; i < id.data.length; i += 4) {
      const on = id.data[i] > 100;
      id.data[i] = on ? 255 : 0;
      id.data[i - 1] = id.data[i - 2] = id.data[i - 3] = 255;
    }
    g.putImageData(id, 0, 0);
    titleMask = {
      w, h, gold: tint(c, '#ffd23f'), light: tint(c, '#fff3a8'),
      shadow: tint(c, '#8a1020'), outline: tint(c, '#0b0b14'),
    };
  }
  function drawTitle(cx, cy) {
    if (!titleMask) return;
    const t = titleMask;
    const x = Math.round(cx - t.w / 2), y = Math.round(cy - t.h / 2);
    ctx.drawImage(t.shadow, x, y + 3); ctx.drawImage(t.shadow, x + 1, y + 3);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      ctx.drawImage(t.outline, x + dx, y + dy);
    }
    ctx.drawImage(t.gold, x, y);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, t.w, Math.round(t.h * 0.46)); ctx.clip();
    ctx.drawImage(t.light, x, y);
    ctx.restore();
  }

  /* ---------------------------------------------------------
     UI helpers
  --------------------------------------------------------- */
  function panel(x, y, w, h, fill = 'rgba(8,8,28,0.88)') {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = GOLD; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = FLAG_RED;
    for (const [cx, cy] of [[x - 3, y - 3], [x + w - 1, y - 3], [x - 3, y + h - 1], [x + w - 1, y + h - 1]]) {
      ctx.fillRect(cx, cy, 4, 4);
    }
  }

  class Button {
    constructor(label, x, y, w, h, action, alt) {
      Object.assign(this, { label, x, y, w, h, action, alt });
    }
    has(px, py) { return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h; }
    draw(sel, t) {
      const { x, y, w, h } = this;
      ctx.fillStyle = '#000'; ctx.fillRect(x + 2, y + 2, w, h);
      ctx.fillStyle = sel ? GOLD : '#2b2f6b'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = sel ? '#b8321a' : '#12153f'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = sel ? '#e85a3a' : '#2b2f6b'; ctx.fillRect(x + 2, y + 2, w - 4, 1);
      const sc = h >= 18 ? 2 : 1;
      const ty = y + Math.floor((h - 5 * sc) / 2);
      text(this.label, x + w / 2, ty, sel ? '#fff' : '#9fb0ff', sc, '#000', 'center');
      if (sel && Math.floor(t * 4) % 2 === 0) {
        text('>', x + 4, ty, GOLD, sc);
        text('<', x + w - 4 - 3 * sc, ty, GOLD, sc);
      }
    }
  }

  /* ---------------------------------------------------------
     Audio — tiny WebAudio chip-tune sound effects
  --------------------------------------------------------- */
  class Sfx {
    constructor() { this.ac = null; this.muted = false; this.last = {}; }
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ac.destination);
        const len = this.ac.sampleRate;
        this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ac = null; }
    }
    gate(name, ms) {                       // rate-limit noisy effects
      const now = performance.now();
      if (now - (this.last[name] || 0) < ms) return false;
      this.last[name] = now; return true;
    }
    tone(f, d, type = 'square', v = 0.07, slide = 0, delay = 0) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.02);
    }
    noise(d, v = 0.15, delay = 0, f0 = 3000) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + delay;
      const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ac.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(200, t + d);
      const g = this.ac.createGain();
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t); s.stop(t + d + 0.02);
    }
    shoot(kind) {
      if (!this.gate('shoot', 45)) return;
      if (kind === 'laser') this.tone(1500, 0.07, 'sawtooth', 0.025, -900);
      else if (kind === 'missile') this.noise(0.1, 0.05, 0, 1800);
      else if (kind === 'plasma') this.tone(300, 0.16, 'sawtooth', 0.05, 200);
      else if (kind === 'rail') { this.tone(2200, 0.25, 'sawtooth', 0.06, -1900); this.noise(0.2, 0.1); }
      else if (kind === 'arc') this.tone(700, 0.06, 'square', 0.03, 500);
      else if (kind === 'wave') this.tone(500, 0.08, 'triangle', 0.05, 300);
      else this.tone(900, 0.07, 'square', 0.035, -520);
    }
    tick() { if (this.gate('tick', 40)) this.tone(300, 0.05, 'square', 0.05, -120); }
    boom(big) { this.noise(big ? 0.7 : 0.35, big ? 0.28 : 0.2); this.tone(big ? 90 : 140, big ? 0.6 : 0.3, 'sawtooth', 0.09, -60); }
    coin() {
      if (!this.gate('coin', 45)) return;
      this.tone(988, 0.05, 'square', 0.04); this.tone(1319, 0.09, 'square', 0.04, 0, 0.05);
    }
    gem() { this.tone(1319, 0.06, 'square', 0.05); this.tone(1760, 0.06, 'square', 0.05, 0, 0.06); this.tone(2093, 0.12, 'square', 0.05, 0, 0.12); }
    hurt() { this.tone(200, 0.25, 'sawtooth', 0.12, -150); this.noise(0.15, 0.15); }
    select() { this.tone(660, 0.05, 'square', 0.05); }
    deny() { this.tone(160, 0.15, 'square', 0.06, -60); }
    buy() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.07, 'square', 0.05, 0, i * 0.055)); }
    power() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.07, 'triangle', 0.08, 0, i * 0.05)); }
    heal() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.08, 'square', 0.05, 0, i * 0.07)); }
    dash() { this.noise(0.18, 0.08, 0, 5000); }
    chatter() {                              // goofy alien babble
      if (!this.gate('chatter', 150)) return;
      const f = rand(300, 650);
      this.tone(f, 0.05, 'square', 0.03, 200);
      this.tone(f * 1.3, 0.05, 'square', 0.03, -150, 0.06);
      this.tone(f * 0.9, 0.07, 'square', 0.03, 120, 0.12);
    }
    bomb() { this.noise(0.9, 0.35, 0, 4000); this.tone(70, 0.8, 'sawtooth', 0.14, -40); }
    warning() { for (let i = 0; i < 4; i++) { this.tone(520, 0.2, 'square', 0.06, 0, i * 0.5); this.tone(380, 0.2, 'square', 0.06, 0, i * 0.5 + 0.25); } }
    start() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'square', 0.06, 0, i * 0.08)); }
    clear() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.1)); }
    over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, 0, i * 0.18)); }
  }

  /* ---------------------------------------------------------
     Background: scrolling pixel sky for five moods
  --------------------------------------------------------- */
  const PAL = {
    day: {
      sky: ['#1e5fbf', '#2a73d1', '#3a88e0', '#52a0ec', '#74b8f3', '#96cdf7', '#b9e0fa', '#dcf1fc'],
      cloud: '#ffffff', cloudShade: '#c6dff7',
      far: '#e3c183', pyr: ['#ecc986', '#b98a4a'], near: '#d9a24e', nearTop: '#ecbc6a',
      craft: '#1b3f78', sun: ['#fff6b0', '#ffe066'], sunPos: [252, 40, 13], streak: 'rgba(255,255,255,0.25)',
    },
    dusk: {
      sky: ['#150c2e', '#2d1b4e', '#4a2560', '#7a2f6b', '#b0436a', '#e0685a', '#f29a4a', '#fac96a'],
      cloud: '#e48fa6', cloudShade: '#8f4770',
      far: '#8a4350', pyr: ['#a65b55', '#5e2d48'], near: '#4a2340', nearTop: '#6a3350',
      craft: '#0b0b1f', sun: ['#ffd27a', '#ff9d3c'], sunPos: [160, HORIZON - 4, 24], streak: 'rgba(255,200,160,0.15)', stars: true,
    },
    night: {
      sky: ['#070a1c', '#0b1030', '#101a45', '#16235a', '#1d2e70', '#26397f', '#314a92', '#3d5aa5'],
      cloud: '#3b4f8c', cloudShade: '#1f2a55',
      far: '#24304f', pyr: ['#34476f', '#1b2644'], near: '#1a2340', nearTop: '#2a3760',
      craft: '#05070f', sun: ['#f4f1de', '#cfd2e6'], sunPos: [250, 36, 9], streak: 'rgba(160,190,255,0.14)', stars: true,
    },
    storm: {
      sky: ['#1a1f26', '#232a33', '#2d353f', '#38424d', '#46525e', '#566370', '#667584', '#76879a'],
      cloud: '#6e7c8c', cloudShade: '#3d4752',
      far: '#4a5560', pyr: ['#5d6a77', '#343d47'], near: '#2f3841', nearTop: '#47525d',
      craft: '#0d1116', sun: null, streak: 'rgba(200,220,255,0.3)', rain: true,
    },
    inferno: {
      sky: ['#1b0505', '#330a0a', '#4f1010', '#701a12', '#962a14', '#bf4118', '#e3641f', '#f5902e'],
      cloud: '#7a2a1a', cloudShade: '#3d120c',
      far: '#4a1a14', pyr: ['#6b2a1c', '#2e0f0b'], near: '#2a0d0a', nearTop: '#4a1a14',
      craft: '#0a0202', sun: ['#ffb347', '#ff5a1a'], sunPos: [240, 56, 16], streak: 'rgba(255,140,60,0.22)', embers: true,
    },
  };

  const CLOUDS = [
    [[4, 4, 24, 5], [8, 1, 10, 5], [16, 0, 8, 6]],
    [[2, 3, 20, 4], [6, 0, 10, 4]],
    [[0, 4, 34, 5], [6, 1, 12, 5], [14, -2, 10, 5], [22, 0, 8, 5]],
  ];
  const PYRAMIDS = [{ x: 90, h: 26 }, { x: 175, h: 15 }, { x: 330, h: 34 }, { x: 470, h: 20 }];
  const PALMS = [{ x: 40, h: 16 }, { x: 210, h: 13 }, { x: 395, h: 17 }];

  class Background {
    constructor() {
      this.mode = 'day'; this.scroll = 0; this.t = 0;
      this.clouds = [];
      for (let i = 0; i < 9; i++) this.clouds.push({ x: rand(0, W), y: rand(18, 100), s: randi(0, 2), l: i % 2 });
      this.craft = []; this.craftT = rand(2, 5);
      this.streaks = [];
      for (let i = 0; i < 14; i++) this.streaks.push({ x: rand(0, W), y: rand(20, 165), len: randi(6, 14), k: rand(1.5, 3) });
      this.stars = [];
      for (let i = 0; i < 46; i++) this.stars.push({ x: randi(0, W - 1), y: randi(1, 62), p: rand(0, 6) });
      this.rain = [];
      for (let i = 0; i < 46; i++) this.rain.push({ x: rand(0, W), y: rand(0, H), v: rand(160, 240) });
      this.embers = [];
      for (let i = 0; i < 30; i++) this.embers.push({ x: rand(0, W), y: rand(0, H), v: rand(10, 36), p: rand(0, 6) });
      this.sky = {};
      for (const m of Object.keys(PAL)) this.sky[m] = this.bakeSky(m);
    }

    bakeSky(mode) {
      const pal = PAL[mode];
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const bh = Math.ceil((H - 20) / pal.sky.length);
      pal.sky.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, W, bh + 1); });
      for (let i = 1; i < pal.sky.length; i++) {            // 2-row dither between bands
        const y = i * bh;
        for (let x = 0; x < W; x += 2) {
          g.fillStyle = pal.sky[i]; g.fillRect(x, y - 1, 1, 1);
          g.fillStyle = pal.sky[i - 1]; g.fillRect(x + 1, y, 1, 1);
        }
      }
      if (pal.sun) {
        const [sx, sy, sr] = pal.sunPos;
        g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
        for (let dy = -sr - 6; dy <= sr + 6; dy++) {
          const w = Math.floor(Math.sqrt((sr + 6) ** 2 - dy * dy));
          g.fillRect(sx - w, sy + dy, w * 2, 1);
        }
        g.globalAlpha = 1;
        for (let dy = -sr; dy <= sr; dy++) {
          const w = Math.floor(Math.sqrt(sr * sr - dy * dy));
          g.fillStyle = dy > sr * 0.3 ? pal.sun[1] : pal.sun[0];
          g.fillRect(sx - w, sy + dy, w * 2, 1);
        }
      }
      return c;
    }

    setMode(m) { this.mode = m; }

    update(dt, speed) {
      this.t += dt; this.scroll += speed * dt;
      for (const c of this.clouds) {
        c.x -= (c.l ? speed * 0.35 : speed * 0.18) * dt;
        if (c.x < -50) { c.x = W + rand(0, 60); c.y = rand(18, 100); c.s = randi(0, 2); }
      }
      this.craftT -= dt;
      if (this.craftT <= 0) {
        this.craftT = rand(6, 12);
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.craft.push({ x: dir < 0 ? W + 10 : -14, y: rand(22, 80), v: dir * rand(14, 24) });
      }
      for (const a of this.craft) a.x += a.v * dt;
      this.craft = this.craft.filter((a) => a.x > -30 && a.x < W + 30);
      for (const s of this.streaks) {
        s.x -= speed * s.k * dt;
        if (s.x < -20) { s.x = W + rand(0, 40); s.y = rand(20, 165); }
      }
      for (const r of this.rain) { r.y += r.v * dt; r.x -= 40 * dt; if (r.y > H) { r.y = -4; r.x = rand(0, W + 40); } }
      for (const e of this.embers) { e.y -= e.v * dt; e.x -= (speed * 0.5) * dt; if (e.y < -2 || e.x < -2) { e.y = H + 2; e.x = rand(0, W); } }
    }

    desertTop(x, k, base, a1, a2) {
      const sx = x + this.scroll * k;
      return Math.round(base + Math.sin(sx * 0.02) * a1 + Math.sin(sx * 0.06 + 1) * a2);
    }

    draw() {
      const pal = PAL[this.mode];
      ctx.drawImage(this.sky[this.mode], 0, 0);

      if (pal.stars) {
        for (const s of this.stars) {
          const b = Math.sin(this.t * 2 + s.p);
          ctx.fillStyle = b > 0.4 ? '#ffffff' : b > -0.4 ? '#9fb0ff' : '#4a4f8a';
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      }

      ctx.globalAlpha = 0.55; ctx.fillStyle = pal.craft;       // distant aircraft silhouettes
      for (const a of this.craft) {
        const x = Math.round(a.x), y = Math.round(a.y), d = a.v > 0 ? 1 : -1;
        ctx.fillRect(x, y + 1, 10, 1);
        ctx.fillRect(d > 0 ? x : x + 8, y, 2, 1);
        ctx.fillRect(x + 4, y + 2, 3, 1);
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff';
        ctx.fillRect(d > 0 ? x - 14 : x + 11, y + 1, 14, 1);
        ctx.globalAlpha = 0.55; ctx.fillStyle = pal.craft;
      }
      ctx.globalAlpha = 1;

      for (const c of this.clouds) {
        const shape = CLOUDS[c.s], ox = Math.round(c.x), oy = Math.round(c.y);
        ctx.globalAlpha = c.l ? 1 : 0.7;
        ctx.fillStyle = pal.cloud;
        for (const [x, y, w, h] of shape) ctx.fillRect(ox + x, oy + y, w, h);
        ctx.fillStyle = pal.cloudShade;
        const base = shape[0];
        ctx.fillRect(ox + base[0], oy + base[1] + base[3] - 1, base[2], 1);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = pal.far;                                 // far dunes
      for (let x = 0; x < W; x++) {
        const top = this.desertTop(x, 0.2, HORIZON, 5, 2);
        ctx.fillRect(x, top, 1, H - top);
      }
      const P = 600;                                           // pyramids (parallax)
      for (const p of PYRAMIDS) {
        const x0 = mod(p.x - this.scroll * 0.1 + 70, P) - 70;
        if (x0 > W) continue;
        const cx = x0 + p.h, base = HORIZON + 4;
        for (let i = 0; i < p.h; i++) {
          const half = p.h - i;
          ctx.fillStyle = pal.pyr[0]; ctx.fillRect(cx - half, base - i, half, 1);
          ctx.fillStyle = pal.pyr[1]; ctx.fillRect(cx, base - i, half, 1);
        }
      }
      ctx.fillStyle = pal.far;
      for (let x = 0; x < W; x++) {
        const top = Math.max(this.desertTop(x, 0.2, HORIZON, 5, 2), HORIZON + 4);
        ctx.fillRect(x, top, 1, H - top);
      }

      const nearTop = (x) => this.desertTop(x, 0.6, H - 20, 4, 1.5);
      ctx.fillStyle = pal.near;
      for (let x = 0; x < W; x++) { const top = nearTop(x); ctx.fillRect(x, top, 1, H - top); }
      ctx.fillStyle = pal.nearTop;
      for (let x = 0; x < W; x++) ctx.fillRect(x, nearTop(x), 1, 1);

      const PP = 480;
      for (const p of PALMS) {
        const x0 = Math.round(mod(p.x - this.scroll * 0.6 + 20, PP) - 20);
        if (x0 > W + 10) continue;
        const by = nearTop(x0) + 1;
        ctx.fillStyle = this.mode === 'inferno' ? '#2a1008' : '#5a3a1e';
        for (let i = 0; i < p.h; i++) ctx.fillRect(x0 + Math.round(i * 0.12), by - i, 2, 1);
        const tx = x0 + 1, ty = by - p.h;
        ctx.fillStyle = this.mode === 'inferno' ? '#4a1a0e' : '#2d7a3a';
        for (let d = 1; d <= 6; d++) {
          const dy = Math.round(d * 0.35 + (d > 3 ? (d - 3) * 0.6 : 0));
          ctx.fillRect(tx - d, ty + dy - 1, 1, 1); ctx.fillRect(tx + d, ty + dy - 1, 1, 1);
        }
        ctx.fillRect(tx, ty - 2, 1, 2); ctx.fillRect(tx - 1, ty - 1, 3, 1);
      }

      ctx.fillStyle = pal.streak;                              // wind streaks
      for (const s of this.streaks) ctx.fillRect(Math.round(s.x), Math.round(s.y), s.len, 1);

      if (pal.rain) {
        ctx.fillStyle = 'rgba(190,210,240,0.55)';
        for (const r of this.rain) { const x = Math.round(r.x), y = Math.round(r.y); ctx.fillRect(x, y, 1, 2); ctx.fillRect(x - 1, y + 2, 1, 2); }
      }
      if (pal.embers) {
        for (const e of this.embers) {
          ctx.fillStyle = Math.sin(this.t * 6 + e.p) > 0 ? '#ffb347' : '#ff5a1a';
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
        }
      }
    }
  }

  /* ---------------------------------------------------------
     Save data (persistent in localStorage)
  --------------------------------------------------------- */
  const SAVE_KEY = 'oct73_save_v2';
  const defaultSave = () => ({
    coins: 0, gems: 0, up: {}, weapons: ['vulcan'], weapon: 'vulcan',
    skins: ['std'], skin: 'std', hi: 0, bestStage: 1, stage: 1, diff: 1,
  });
  function loadSave() {
    const d = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        Object.assign(d, o);
        d.up = Object.assign({}, o.up || {});
        if (!Array.isArray(d.weapons) || !d.weapons.includes('vulcan')) d.weapons = ['vulcan'].concat(d.weapons || []);
        if (!Array.isArray(d.skins) || !d.skins.includes('std')) d.skins = ['std'].concat(d.skins || []);
      }
    } catch (e) { /* ignore */ }
    return d;
  }
  function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  /* ---------------------------------------------------------
     Hangar content
  --------------------------------------------------------- */
  // cur: 'c' = coins, 'g' = gems
  const UPGRADES = [
    { id: 'rate',   name: 'FIRE RATE',    max: 6, base: 300, cur: 'c', desc: 'SHOOT FASTER' },
    { id: 'dmg',    name: 'DAMAGE',       max: 6, base: 350, cur: 'c', desc: '+15% DAMAGE' },
    { id: 'hull',   name: 'HULL PLATING', max: 5, base: 400, cur: 'c', desc: '+1 MAX HP' },
    { id: 'engine', name: 'ENGINE',       max: 5, base: 250, cur: 'c', desc: 'FASTER SHIP' },
    { id: 'bspeed', name: 'BULLET SPEED', max: 3, base: 300, cur: 'c', desc: 'FASTER SHOTS' },
    { id: 'crit',   name: 'CRIT CHANCE',  max: 5, base: 450, cur: 'c', desc: '+5% DOUBLE DMG' },
    { id: 'magnet', name: 'COIN MAGNET',  max: 5, base: 200, cur: 'c', desc: 'WIDER PULL' },
    { id: 'cval',   name: 'COIN VALUE',   max: 5, base: 500, cur: 'c', desc: '+15% COINS' },
    { id: 'luck',   name: 'LUCK',         max: 5, base: 450, cur: 'c', desc: 'MORE POWER-UPS' },
    { id: 'power',  name: 'START POWER',  max: 3, base: 900, cur: 'c', desc: 'BEGIN WITH +1 LV' },
    { id: 'bombs',  name: 'BOMB BAY',     max: 3, base: 700, cur: 'c', desc: '+1 START BOMB' },
    { id: 'shield', name: 'SHIELD GEN',   max: 3, base: 600, cur: 'c', desc: 'START WITH SHIELD' },
    { id: 'regen',  name: 'REPAIR DRONE', max: 3, base: 800, cur: 'c', desc: 'SLOW HP REGEN' },
    { id: 'dash',   name: 'DASH COOLING', max: 4, base: 350, cur: 'c', desc: 'DASH RECHARGES' },
    { id: 'combo',  name: 'COMBO KEEPER', max: 3, base: 400, cur: 'c', desc: 'LONGER COMBOS' },
    { id: 'gemf',   name: 'GEM FINDER',   max: 3, base: 4,   cur: 'g', desc: 'MORE GEM DROPS' },
    { id: 'overd',  name: 'OVERDRIVE',    max: 3, base: 6,   cur: 'g', desc: 'POWER-UPS LAST' },
    { id: 'wing',   name: 'WINGMEN',      max: 2, base: 10,  cur: 'g', desc: 'AUTO-FIRE DRONES' },
    { id: 'revive', name: 'SECOND WIND',  max: 1, base: 20,  cur: 'g', desc: 'REVIVE ONCE A RUN' },
  ];
  const upCost = (u, lvl) => u.cur === 'g'
    ? u.base * (lvl + 1)
    : Math.round((u.base * (1 + lvl * 0.8) * (1 + lvl * 0.12)) / 10) * 10;

  const SKINS = [
    { id: 'std',     name: 'EGYPT GREY',     cost: 0,    cur: 'c', trail: ['#ff8a1f', '#fff3a0'],
      pal: { dark: '#3a4252', mid: '#8a95a6', light: '#c9d1dc', cock: '#4fd8ff', cockD: '#1c86b5' } },
    { id: 'desert',  name: 'DESERT CAMO',    cost: 600,  cur: 'c', trail: ['#ff8a1f', '#fff3a0'],
      pal: { dark: '#6e5330', mid: '#b08d57', light: '#d9bf8a', cock: '#9fe8ff', cockD: '#3c7a96' } },
    { id: 'arctic',  name: 'ARCTIC WOLF',    cost: 1800, cur: 'c', trail: ['#7fd6ff', '#ffffff'],
      pal: { dark: '#5a6b85', mid: '#cfd9e8', light: '#ffffff', cock: '#2a78b8', cockD: '#1a4a78' } },
    { id: 'night',   name: 'NIGHT RAVEN',    cost: 2200, cur: 'c', trail: ['#4fd8ff', '#ffffff'],
      pal: { dark: '#12151f', mid: '#2d3446', light: '#5b6685', cock: '#ff4d6d', cockD: '#a1243e' } },
    { id: 'crimson', name: 'CRIMSON STRIKE', cost: 3000, cur: 'c', trail: ['#ff3b3b', '#ffd0d0'],
      pal: { dark: '#5c0f16', mid: '#a3242f', light: '#e0535f', cock: '#ffd23f', cockD: '#a67c00' } },
    { id: 'jade',    name: 'JADE VIPER',     cost: 3000, cur: 'c', trail: ['#6dff9a', '#ffffff'],
      pal: { dark: '#154a2e', mid: '#2f8f5b', light: '#6fd39a', cock: '#d8ffe8', cockD: '#4a9a70' } },
    { id: 'gold',    name: 'GOLDEN FALCON',  cost: 15,   cur: 'g', trail: ['#ffd23f', '#ffffff'],
      pal: { dark: '#7a5a00', mid: '#d4a017', light: '#ffe27a', cock: '#4fd8ff', cockD: '#1c86b5' } },
    { id: 'neon',    name: 'NEON GHOST',     cost: 25,   cur: 'g', trail: ['#ff4fd8', '#4fffff'],
      pal: { dark: '#2a1060', mid: '#7a2cf0', light: '#ff4fd8', cock: '#4fffff', cockD: '#1a9a9a' } },
    { id: 'pharaoh', name: 'PHARAOH',        cost: 40,   cur: 'g', trail: ['#ffd23f', '#4fd8ff'],
      pal: { dark: '#0b2a5a', mid: '#1b4fa0', light: '#ffd23f', cock: '#ffd23f', cockD: '#a67c00' } },
  ];
  const SKIN_BY = {};
  for (const s of SKINS) {
    s.spr = buildPlayer(s.pal);
    s.sil = tint(s.spr, '#0e0e1e');
    SKIN_BY[s.id] = s;
  }

  /* ---------------------------------------------------------
     Enemies, bosses, stages, difficulty, power-ups
  --------------------------------------------------------- */
  const ET = {
    drone:       { w: 13, h: 9,  hp: 2,  speed: 48, score: 100,  coins: 3,  big: false },
    jet:         { w: 20, h: 9,  hp: 3,  speed: 88, score: 150,  coins: 4,  big: false },
    gunship:     { w: 24, h: 14, hp: 11, speed: 34, score: 350,  coins: 9,  big: true },
    spinner:     { w: 15, h: 15, hp: 9,  speed: 30, score: 300,  coins: 7,  big: true },
    interceptor: { w: 22, h: 10, hp: 7,  speed: 60, score: 300,  coins: 6,  big: false },
    bomber:      { w: 30, h: 14, hp: 24, speed: 22, score: 600,  coins: 16, big: true },
    carrier:     { w: 34, h: 18, hp: 42, speed: 26, score: 1000, coins: 26, big: true },
  };
  const TIER_HP = [1, 1, 2.4, 4.5];
  const TIER_SCORE = [1, 1, 2, 4];
  const TIER_COIN = [1, 1, 1.8, 3];

  const BOSSES = {
    b_hawk:    { name: 'IRON HAWK',     w: 50, h: 30, hp: 90,  score: 5000,  coins: 60,  gems: 6 },
    b_carrier: { name: 'SKY CARRIER',   w: 62, h: 28, hp: 150, score: 8000,  coins: 90,  gems: 8 },
    b_spinner: { name: 'STORM SPINNER', w: 42, h: 42, hp: 200, score: 12000, coins: 120, gems: 10 },
    b_bomber:  { name: 'DREAD BOMBER',  w: 66, h: 30, hp: 260, score: 16000, coins: 150, gems: 12 },
    b_omega:   { name: 'OMEGA CORE',    w: 52, h: 52, hp: 360, score: 30000, coins: 250, gems: 18 },
  };

  const STAGES = [
    { name: 'DESERT DAWN',  bg: 'day',     len: 55, pool: ['drone', 'jet'],                                                      boss: 'b_hawk',    tierMax: 1 },
    { name: 'SUNSET RAID',  bg: 'dusk',    len: 62, pool: ['drone', 'jet', 'gunship', 'spinner'],                                boss: 'b_carrier', tierMax: 2 },
    { name: 'MIDNIGHT RUN', bg: 'night',   len: 68, pool: ['drone', 'jet', 'gunship', 'spinner', 'interceptor'],                 boss: 'b_spinner', tierMax: 2 },
    { name: 'STORM FRONT',  bg: 'storm',   len: 72, pool: ['drone', 'jet', 'gunship', 'spinner', 'interceptor', 'bomber'],       boss: 'b_bomber',  tierMax: 3 },
    { name: 'OMEGA SKIES',  bg: 'inferno', len: 80, pool: ['drone', 'jet', 'gunship', 'spinner', 'interceptor', 'bomber', 'carrier'], boss: 'b_omega', tierMax: 3 },
  ];
  // relative spawn weights + earliest progress (0..1) a type may appear in a stage
  const WAVE_W = {
    drone: [40, 0], jet: [26, 0.12], gunship: [12, 0.2], spinner: [10, 0.25],
    interceptor: [11, 0.15], bomber: [6, 0.35], carrier: [4, 0.45],
  };

  const DIFFS = [
    { name: 'EASY',   hp: 0.8,  rate: 0.8,  bul: 0.85, coin: 0.85 },
    { name: 'NORMAL', hp: 1,    rate: 1,    bul: 1,    coin: 1 },
    { name: 'HARD',   hp: 1.35, rate: 1.25, bul: 1.12, coin: 1.4 },
    { name: 'INSANE', hp: 1.8,  rate: 1.6,  bul: 1.25, coin: 2 },
  ];

  const POWERUPS = {
    P: { col: '#e63946', w: 30, label: 'P' },   // weapon power
    B: { col: '#555b78', w: 12, label: 'B' },   // bomb
    S: { col: '#2ec4ff', w: 14, label: 'S' },   // shield
    H: { col: '#3ddc84', w: 14, label: '+' },   // repair
    M: { col: '#b36bff', w: 10, label: 'M' },   // magnet blast
    D: { col: '#e0a800', w: 10, label: '2' },   // double coins
    R: { col: '#ff7a1a', w: 10, label: 'R' },   // rapid fire
  };
  const POWER_KEYS = Object.keys(POWERUPS);

  /* ---------------------------------------------------------
     Weapons (each has a fire() that spawns bullets for power level 1..5)
  --------------------------------------------------------- */
  const WEAPONS = [
    { id: 'vulcan', name: 'VULCAN', desc: 'RAPID BULLETS', cost: 0, cur: 'c', cool: 0.24, color: '#ffd23f',
      fire(g, p, L, d, s) {
        const x = p.x + 31, y = p.y + 6;
        const add = (oy, vy) => g.pb({ x, y: y + oy, vx: 270 * s, vy, w: 7, h: 2, dmg: d, kind: 'vulcan', color: '#ffd23f' });
        if (L === 1) add(0, 0);
        else if (L === 2) { add(-3, 0); add(3, 0); }
        else if (L === 3) { add(0, 0); add(-3, -34); add(3, 34); }
        else if (L === 4) { add(-2, 0); add(2, 0); add(-4, -50); add(4, 50); }
        else { add(0, 0); add(-4, 0); add(4, 0); add(-3, -70); add(3, 70); }
      } },
    { id: 'spread', name: 'SCATTER', desc: 'WIDE PELLET FAN', cost: 1200, cur: 'c', cool: 0.42, color: '#ff9d3c',
      fire(g, p, L, d, s) {
        const x = p.x + 31, y = p.y + 6, n = 2 + L;
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 0.13;
          g.pb({ x, y, vx: Math.cos(a) * 240 * s, vy: Math.sin(a) * 240 * s, w: 4, h: 3, dmg: d * 0.8, kind: 'spread', color: '#ff9d3c', life: 0.55 });
        }
      } },
    { id: 'laser', name: 'PIERCER', desc: 'LASER THROUGH FOES', cost: 2500, cur: 'c', cool: 0.3, color: '#4fd8ff',
      fire(g, p, L, d, s) {
        const x = p.x + 31, y = p.y + 6, n = Math.ceil(L / 2);
        for (let i = 0; i < n; i++) {
          g.pb({ x, y: y + (i - (n - 1) / 2) * 6, vx: 430 * s, vy: 0, w: 14, h: L >= 4 ? 3 : 2, dmg: d * 0.9, kind: 'laser', color: '#4fd8ff', pierce: 1 + Math.floor(L / 2) });
        }
      } },
    { id: 'missile', name: 'HOMING MISSILES', desc: 'SEEKS NEAREST FOE', cost: 3500, cur: 'c', cool: 0.55, color: '#dfe6f2',
      fire(g, p, L, d, s) {
        const x = p.x + 24, y = p.y + 8, n = [1, 2, 2, 3, 4][L - 1];
        for (let i = 0; i < n; i++) {
          const a = n === 1 ? 0 : (i % 2 ? 1 : -1) * (0.5 + 0.3 * Math.floor(i / 2));
          g.pb({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, spd: 140, w: 5, h: 3, dmg: d * 2.2, kind: 'missile', home: true, splash: 18, life: 3.2 });
        }
      } },
    { id: 'wave', name: 'SINE WAVE', desc: 'WAVY PIERCING SHOTS', cost: 15, cur: 'g', cool: 0.26, color: '#ff4fd8',
      fire(g, p, L, d, s) {
        const x = p.x + 31, y = p.y + 6, pairs = Math.ceil(L / 2);
        for (let i = 0; i < pairs; i++) {
          const oy = (i - (pairs - 1) / 2) * 9;
          for (let k = 0; k < 2; k++) {
            g.pb({ x, y: y + oy, vx: 240 * s, vy: 0, w: 4, h: 4, dmg: d * 0.9, kind: 'wave', color: '#ff4fd8', amp: 7, ph: k * Math.PI, freq: 12, pierce: 2 });
          }
        }
      } },
    { id: 'arc', name: 'ARC LIGHTNING', desc: 'CHAINS BETWEEN FOES', cost: 25, cur: 'g', cool: 0.3, color: '#4fd8ff',
      fire(g, p, L, d, s) {
        const x = p.x + 31, y = p.y + 6, n = 1 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          g.pb({ x, y: y + (i - (n - 1) / 2) * 6, vx: 360 * s, vy: 0, w: 6, h: 2, dmg: d * 0.9, kind: 'arc', chain: 1 + Math.floor((L + 1) / 2) });
        }
      } },
    { id: 'plasma', name: 'PLASMA CANNON', desc: 'HEAVY SPLASH ORBS', cost: 8000, cur: 'c', cool: 0.8, color: '#b36bff',
      fire(g, p, L, d, s) {
        const x = p.x + 30, y = p.y + 6, size = 7 + L, n = L < 3 ? 1 : L < 5 ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const oy = n === 1 ? 0 : (i - (n - 1) / 2) * 12;
          g.pb({ x, y: y + oy - size / 2, vx: 190 * s, vy: n === 3 ? (i - 1) * 24 : 0, w: size, h: size, dmg: d * 3.5, kind: 'plasma', splash: 20 + 3 * L, color: '#b36bff' });
        }
      } },
    { id: 'rail', name: 'RAIL GUN', desc: 'SCREEN-WIDE BEAM', cost: 40, cur: 'g', cool: 1.1, color: '#ffffff',
      fire(g, p, L, d, s) {
        const x = p.x + 32, h = 3 + L, y = p.y + 6 - Math.floor(h / 2);
        g.pb({ x, y, vx: 0, vy: 0, w: W - x, h, dmg: d * (5 + 1.5 * L), kind: 'rail', pierce: Infinity, life: 0.14 });
      } },
  ];
  const WMAP = {};
  for (const w of WEAPONS) WMAP[w.id] = w;

  /* ---------------------------------------------------------
     Bullets (friendly and hostile)
  --------------------------------------------------------- */
  class Bullet {
    constructor(o) {
      Object.assign(this, {
        x: 0, y: 0, vx: 0, vy: 0, w: 3, h: 3, friendly: false, dmg: 1, kind: 'pellet',
        pierce: 0, life: 6, dead: false, home: false, splash: 0, chain: 0, color: '#ff4b2b',
        t: 0, amp: 0, ph: 0, freq: 12, target: null, hit: null, spd: 0,
      }, o);
      this.y0 = this.y;
      if (this.friendly && (this.pierce > 0 || this.kind === 'rail')) this.hit = new Set();
    }
    update(dt, g) {
      this.t += dt; this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.kind === 'rail') return;
      if (this.home) {
        if (!this.target || this.target.dead) this.target = g.nearestEnemy(this.x, this.y);
        let a = Math.atan2(this.vy, this.vx);
        if (this.target) {
          const tx = this.target.x + this.target.w / 2, ty = this.target.y + this.target.h / 2;
          const da = Math.atan2(ty - this.y, tx - this.x) - a;
          a += clamp(Math.atan2(Math.sin(da), Math.cos(da)), -6 * dt, 6 * dt);
        }
        this.spd = Math.min(this.spd + 180 * dt, 300);
        this.vx = Math.cos(a) * this.spd; this.vy = Math.sin(a) * this.spd;
      }
      this.x += this.vx * dt;
      if (this.kind === 'wave') this.y = this.y0 + Math.sin(this.t * this.freq + this.ph) * this.amp;
      else this.y += this.vy * dt;
      if (this.x > W + 30 || this.x < -30 || this.y < -30 || this.y > H + 30) this.dead = true;
    }
    draw() {
      const x = Math.round(this.x), y = Math.round(this.y);
      switch (this.kind) {
        case 'vulcan':
          ctx.fillStyle = '#ff8a1f'; ctx.fillRect(x - 2, y, 2, this.h);
          ctx.fillStyle = this.color; ctx.fillRect(x, y, this.w, this.h);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + this.w - 2, y, 2, this.h);
          break;
        case 'spread':
          ctx.fillStyle = this.color; ctx.fillRect(x, y, 4, 3);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 1, 1, 1);
          break;
        case 'laser':
          ctx.fillStyle = this.color; ctx.fillRect(x, y, this.w, this.h);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + this.w - 4, y, 4, this.h);
          break;
        case 'missile':
          ctx.fillStyle = '#ffb02e'; ctx.fillRect(x - 3, y + 1, 3, 1);
          ctx.fillStyle = '#dfe6f2'; ctx.fillRect(x, y, 5, 3);
          ctx.fillStyle = '#ff4b2b'; ctx.fillRect(x + 4, y + 1, 1, 1);
          break;
        case 'plasma': {
          const r = this.w / 2, cx = x + r, cy = y + r;
          const disc = (rad, col) => {
            ctx.fillStyle = col;
            for (let dy = -Math.floor(rad); dy <= Math.floor(rad); dy++) {
              const hw = Math.round(Math.sqrt(Math.max(0, rad * rad - dy * dy)));
              ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
            }
          };
          disc(r + 1, '#4a1a80'); disc(r, '#8a4ae0'); disc(r - 1.5, '#b36bff'); disc(Math.max(1, r - 3), '#f0e0ff');
          break;
        }
        case 'wave':
          ctx.fillStyle = this.color; ctx.fillRect(x + 1, y, 2, 4); ctx.fillRect(x, y + 1, 4, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 2, 2);
          break;
        case 'arc':
          ctx.fillStyle = '#4fd8ff'; ctx.fillRect(x, y, 6, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y, 2, 1);
          break;
        case 'rail': {
          const a = clamp(this.life / 0.14, 0, 1);
          ctx.globalAlpha = a;
          ctx.fillStyle = '#4fd8ff'; ctx.fillRect(x, y - 1, this.w, this.h + 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, this.w, this.h);
          ctx.globalAlpha = 1;
          break;
        }
        default: {                                   // hostile pellets / orbs
          const s = this.w;
          if (s >= 5) {
            ctx.fillStyle = '#3a0a0a'; ctx.fillRect(x - 1, y, s + 2, s); ctx.fillRect(x, y - 1, s, s + 2);
            ctx.fillStyle = this.color; ctx.fillRect(x, y, s, s);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 2, 2);
          } else {
            ctx.fillStyle = this.color; ctx.fillRect(x, y, 3, 3);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 1, 1);
          }
        }
      }
    }
  }

  class Particle {
    constructor(x, y, vx, vy, life, size, color, opt = {}) {
      Object.assign(this, {
        x, y, vx, vy, life, max: life, size, color,
        grav: opt.grav || 0, drag: opt.drag || 0, kind: opt.kind || 'px',
      });
    }
    update(dt) {
      this.life -= dt;
      this.vy += this.grav * dt;
      if (this.drag) { const f = Math.max(0, 1 - this.drag * dt); this.vx *= f; this.vy *= f; }
      this.x += this.vx * dt; this.y += this.vy * dt;
    }
    get dead() { return this.life <= 0; }
    draw() {
      const k = this.life / this.max;
      ctx.fillStyle = this.color;
      const s = Math.max(1, Math.round(this.size * (0.4 + k * 0.6)));
      if (this.kind === 'star') {
        ctx.fillRect(Math.round(this.x - 1), Math.round(this.y - s), 2, s * 2);
        ctx.fillRect(Math.round(this.x - s), Math.round(this.y - 1), s * 2, 2);
        return;
      }
      ctx.fillRect(Math.round(this.x), Math.round(this.y), s, s);
    }
  }

  /* ---------------------------------------------------------
     Pickups: coins, banknotes, gems and power-up capsules
  --------------------------------------------------------- */
  class Pickup {
    constructor(x, y, vx, vy, kind, cap) {
      Object.assign(this, { x, y, vx, vy, kind, cap, age: 0, mag: false, dead: false, spin: rand(0, 6) });
      this.life = kind === 'gem' ? 10 : kind === 'cap' ? 12 : 5;
    }
    update(dt, g) {
      this.age += dt; this.life -= dt; this.spin += dt * 14;
      const p = g.player;
      const dx = p.x + p.w / 2 - this.x, dy = p.y + p.h / 2 - this.y, d = Math.hypot(dx, dy) || 1;
      if (this.kind === 'cap') {
        this.x -= 16 * dt; this.y += Math.sin(this.age * 3) * 14 * dt;
        if (!g.dying && d < 15) { this.dead = true; g.collectCap(this); }
        if (this.x < -14 || this.life <= 0) this.dead = true;
        return;
      }
      const range = g.magnetR() * (this.kind === 'gem' ? 1.6 : 1);
      if (!g.dying && this.age > 0.3 && (d < range || g.magnetT > 0)) this.mag = true;
      if (this.mag && !g.dying) {
        const k = Math.min(1, dt * 10), sp = g.magnetT > 0 ? 260 : 200;
        this.vx += ((dx / d) * sp - this.vx) * k;
        this.vy += ((dy / d) * sp - this.vy) * k;
      } else {
        this.vy += (this.kind === 'note' ? 70 : 150) * dt;
        if (this.kind === 'note') this.vy = Math.min(this.vy, 38);
        this.vx *= Math.max(0, 1 - 1.6 * dt);
        this.vx -= 20 * dt;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (!this.mag && this.kind !== 'note' && this.y > H - 10) {
        this.y = H - 10; this.vy *= -0.45; if (Math.abs(this.vy) < 14) this.vy = 0;
      }
      if (this.kind === 'note' && !this.mag && this.y > H - 8) this.y = H - 8;
      if (!g.dying && d < 9) { this.dead = true; g.collect(this); }
      if (this.life <= 0 || this.x < -12) this.dead = true;
    }
    draw() {
      if (this.life < 1.5 && Math.floor(this.life * 12) % 2 === 0) return;
      const x = Math.round(this.x), y = Math.round(this.y);
      if (this.kind === 'cap') {
        const pu = POWERUPS[this.cap];
        ctx.fillStyle = '#000'; ctx.fillRect(x - 7, y - 6, 14, 12);
        ctx.fillStyle = pu.col; ctx.fillRect(x - 6, y - 5, 12, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 6, y - 5, 12, 2);
        text(pu.label, x, y - 2, '#ffffff', 1, '#000', 'center');
        return;
      }
      if (this.kind === 'gem') {
        const f = Math.floor(this.age * 6) % 2;
        drawGemIcon(x - 3, y - 3 + f);
        return;
      }
      if (this.kind === 'note') {
        const f = Math.floor(this.age * 8) % 2;
        ctx.fillStyle = '#17602d'; ctx.fillRect(x - 5, y - 3 + f, 10, 6 - f);
        ctx.fillStyle = '#4fd47a'; ctx.fillRect(x - 4, y - 2 + f, 8, 4 - f);
        ctx.fillStyle = '#17602d'; ctx.fillRect(x - 1, y - 1 + f, 2, 2 - f);
        ctx.fillStyle = '#e8ffe8'; ctx.fillRect(x - 3, y - 1 + f, 1, 1); ctx.fillRect(x + 2, y - 1 + f, 1, 1);
        return;
      }
      const w = Math.max(1, Math.round(Math.abs(Math.cos(this.spin)) * 6));
      const x0 = Math.round(x - w / 2);
      ctx.fillStyle = '#7a5200'; ctx.fillRect(x0 - 1, y - 4, w + 2, 8);
      ctx.fillStyle = GOLD; ctx.fillRect(x0, y - 3, w, 6);
      if (w >= 3) {
        ctx.fillStyle = '#b8860b'; ctx.fillRect(x0 + w - 1, y - 3, 1, 6);
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(x0 + 1, y - 2, 1, 2);
      }
    }
  }

  class Popup {
    constructor(x, y, txt, col, sc = 1, rise = true, life = 0.9) {
      Object.assign(this, { x, y, txt, col, sc, rise, life, max: life });
    }
    update(dt) { this.life -= dt; if (this.rise) this.y -= 22 * dt; }
    get dead() { return this.life <= 0; }
    draw() {
      if (this.life < 0.3 && Math.floor(this.life * 20) % 2 === 0) return;
      text(this.txt, this.x, this.y, this.col, this.sc, '#000', 'center');
    }
  }

  /* ---------------------------------------------------------
     Player
  --------------------------------------------------------- */
  class Player {
    constructor(x, y) {
      Object.assign(this, {
        x, y, vx: 0, vy: 0, w: 34, h: 13, hp: 4, maxhp: 4, cool: 0, inv: 0, flame: 0,
        hidden: false, dashT: 0, dashCd: 0, dx: 1, dy: 0, ghostT: 0, ghosts: [], wings: [], regenT: 0,
      });
    }
    get box() { return { x: this.x + 6, y: this.y + 3, w: this.w - 10, h: this.h - 6 }; }
    get core() { return { x: this.x + 14, y: this.y + 4, w: 9, h: 5 }; }
    initWings(n) {
      this.wings = [];
      for (let i = 0; i < n; i++) this.wings.push({ x: this.x, y: this.y, fireT: rand(0, 0.5), side: i % 2 ? 1 : -1 });
    }
    update(dt, g) {
      const st = g.st;
      let ax = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
      let ay = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
      if (ax && ay) { ax *= 0.7071; ay *= 0.7071; }
      if (this.dashT > 0) {
        this.dashT -= dt;
        const dd = Math.hypot(this.dx, this.dy) || 1;
        this.vx = (this.dx / dd) * 320; this.vy = (this.dy / dd) * 320;
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.025; this.ghosts.push({ x: this.x, y: this.y, life: 0.25 }); }
      } else {
        const k = Math.min(1, dt * 11);
        this.vx += (ax * st.speed - this.vx) * k;
        this.vy += (ay * st.speed - this.vy) * k;
      }
      this.x = clamp(this.x + this.vx * dt, 2, W - this.w - 2);
      this.y = clamp(this.y + this.vy * dt, HUD_H + 3, H - this.h - 6);
      this.cool -= dt;
      this.inv = Math.max(0, this.inv - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.flame += dt * 30;
      for (const gh of this.ghosts) gh.life -= dt;
      this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
      if ((down('Space') || g.mouseDown) && this.cool <= 0 && this.dashT <= 0) this.cool = g.fire(this);

      for (const w of this.wings) {                       // wingmen follow and shoot
        const tx = this.x + 6, ty = this.y + 6 + w.side * 17;
        w.x += (tx - w.x) * Math.min(1, dt * 9);
        w.y += (ty - w.y) * Math.min(1, dt * 9);
        w.fireT -= dt;
        if (w.fireT <= 0 && this.dashT <= 0) {
          w.fireT = 0.55 * st.cdMul;
          g.pb({ x: w.x + 9, y: w.y + 2, vx: 270 * st.bspd, vy: 0, w: 5, h: 2, dmg: 0.7 * st.dmgMul, kind: 'vulcan', color: '#9fe8ff' });
        }
      }
      if (st.regenEvery && this.hp < this.maxhp) {         // repair drone
        this.regenT += dt;
        if (this.regenT >= st.regenEvery) { this.regenT = 0; this.hp++; g.popups.push(new Popup(this.x + 16, this.y - 6, '+1 HP', '#6dff9a', 1)); }
      }
    }
    draw(g) {
      if (this.hidden) return;
      const skin = g.skin;
      for (const gh of this.ghosts) {
        ctx.globalAlpha = gh.life * 2;
        ctx.drawImage(skin.sil, Math.round(gh.x), Math.round(gh.y));
      }
      ctx.globalAlpha = 1;
      for (const w of this.wings) {
        ctx.drawImage(SPR.wingman, Math.round(w.x), Math.round(w.y));
      }
      if (this.inv > 0 && g.shieldT <= 0 && Math.floor(this.inv * 20) % 2 === 0) return;
      const x = Math.round(this.x), y = Math.round(this.y);
      const f = Math.floor(this.flame) % 2;
      ctx.fillStyle = skin.trail[0]; ctx.fillRect(x - 4 - f, y + 6, 4 + f, 3);
      ctx.fillStyle = skin.trail[1]; ctx.fillRect(x - 3, y + 7, 2 + f, 1);
      ctx.drawImage(skin.spr, x, y);
      if (g.shieldT > 0 && (g.shieldT > 1.5 || Math.floor(g.shieldT * 10) % 2 === 0)) {  // shield bubble
        const cx = x + 17, cy = y + 6;
        ctx.fillStyle = 'rgba(80,200,255,0.9)';
        for (let dy = -11; dy <= 11; dy++) {
          const hw = Math.floor(22 * Math.sqrt(1 - (dy * dy) / 144));
          ctx.fillRect(cx - hw, cy + dy, 1, 1); ctx.fillRect(cx + hw - 1, cy + dy, 1, 1);
        }
        ctx.fillStyle = 'rgba(80,200,255,0.12)'; ctx.fillRect(cx - 19, cy - 8, 38, 16);
      }
    }
  }

  /* ---------------------------------------------------------
     Enemies (7 types x 3 tiers)
  --------------------------------------------------------- */
  class Enemy {
    constructor(type, x, y, g, opt = {}) {
      const def = ET[type];
      this.type = type; this.def = def; this.x = x; this.y = y; this.baseY = y;
      this.w = def.w; this.h = def.h; this.tier = opt.tier || 1;
      this.t = 0; this.flash = 0; this.dead = false; this.isBoss = false; this.invuln = false;
      const hpMul = (1 + 0.28 * (g.stage - 1)) * TIER_HP[this.tier] * g.diff.hp;
      this.maxhp = this.hp = def.hp * hpMul;
      this.phase = opt.phase ?? rand(0, 6.28);
      this.freq = opt.freq ?? rand(2, 3.4);
      this.amp = opt.amp ?? rand(10, 26);
      this.fireT = rand(1, 2.4);
      this.mode = 'in'; this.hoverX = rand(W - 100, W - 60); this.stay = rand(7, 10);
      this.aimT = 0; this.trailT = 0; this.shots = 0; this.spawnT = 2; this.rot = rand(0, 6);
      this.talkT = rand(1.5, TALK_MAX); this.say = null; this.sayT = 0;
    }
    update(dt, g) {
      this.t += dt; this.flash = Math.max(0, this.flash - dt);
      if (this.sayT > 0) this.sayT -= dt;
      this.talkT -= dt;
      if (this.talkT <= 0) {
        this.talkT = rand(TALK_MIN, TALK_MAX);
        const talking = g.enemies.filter((o) => o.sayT > 0).length;
        if (SPEECH_LINES.length && talking < MAX_BUBBLES && this.x < W - 30 && this.x > 20) {
          this.say = pick(SPEECH_LINES); this.sayT = 2.2; g.sfx.chatter();
        }
      }
      const sp = this.def.speed * g.speedMul, tier = this.tier, rate = g.diff.rate;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      switch (this.type) {
        case 'drone':
          this.x -= sp * dt;
          this.y = this.baseY + Math.sin(this.t * this.freq + this.phase) * this.amp;
          if (g.stageIdx >= 2 || tier >= 2) {
            this.fireT -= dt;
            if (this.fireT <= 0 && this.x < W - 20 && this.x > 60) {
              this.fireT = (rand(3.2, 5) / rate) * (tier >= 2 ? 0.6 : 1);
              g.eb(this.x, cy, g.aim(this.x, cy), 85, 3);
            }
          }
          break;
        case 'jet': {
          this.x -= sp * dt;
          const p = g.player;
          if (!g.dying && this.x > p.x + 80) this.y += clamp(p.y + p.h / 2 - cy, -1, 1) * 32 * g.speedMul * dt;
          if (g.stageIdx >= 1 || tier >= 2) {
            this.fireT -= dt;
            if (this.fireT <= 0 && this.x < W - 30 && this.x > 90) {
              this.fireT = rand(2.2, 3.4) / rate;
              g.fan(this.x, cy, tier >= 2 ? 2 : 1, 0.18, 95, 3);
            }
          }
          break;
        }
        case 'gunship':
          if (this.mode === 'in') { this.x -= sp * 1.8 * dt; if (this.x <= this.hoverX) this.mode = 'hover'; }
          else if (this.mode === 'hover') {
            this.y = this.baseY + Math.sin(this.t * 1.4) * 18;
            this.stay -= dt; this.fireT -= dt;
            if (this.fireT <= 0) {
              this.fireT = Math.max(0.9, 2.1 / rate);
              const n = tier >= 3 ? 5 : (tier >= 2 || g.stageIdx >= 2) ? 3 : 1;
              g.fan(this.x, cy, n, 0.2, 95, 3);
            }
            if (this.stay <= 0) this.mode = 'out';
          } else this.x -= sp * 2.2 * dt;
          break;
        case 'spinner':
          this.rot += dt * 2;
          if (this.mode === 'in') { this.x -= sp * 1.8 * dt; if (this.x <= this.hoverX) this.mode = 'hover'; }
          else if (this.mode === 'hover') {
            this.y = this.baseY + Math.sin(this.t * 1.1) * 14;
            this.stay -= dt; this.fireT -= dt;
            if (this.fireT <= 0) {
              this.fireT = Math.max(1.3, 2.4 / rate);
              this.shots++;
              if (this.shots % 2) g.ring(cx, cy, 8 + 4 * (tier - 1), 70, this.rot, 3);
              else g.fan(cx, cy, 3, 0.25, 100, 3);
            }
            if (this.stay <= 0) this.mode = 'out';
          } else this.x -= sp * 2 * dt;
          break;
        case 'interceptor':
          if (this.mode === 'in') { this.x -= sp * 2.2 * dt; if (this.x <= W - 70) { this.mode = 'aim'; this.aimT = 1.1; } }
          else if (this.mode === 'aim') {
            this.aimT -= dt;
            if (this.aimT > 0.45) this.y += (g.player.y + g.player.h / 2 - this.h / 2 - this.y) * Math.min(1, dt * 4);
            if (this.aimT <= 0) this.mode = 'dash';
          } else {
            this.x -= 270 * g.diff.bul * dt;
            if (tier >= 2) { this.trailT -= dt; if (this.trailT <= 0) { this.trailT = 0.1; g.eb(this.x + 10, cy, Math.PI / 2, 22, 3); } }
          }
          break;
        case 'bomber':
          this.x -= sp * dt;
          this.y += (this.baseY - this.y) * Math.min(1, dt * 2);
          this.fireT -= dt; this.aimT -= dt;
          if (this.fireT <= 0 && this.x < W - 10) {
            this.fireT = (tier >= 2 ? 0.4 : 0.55) / rate;
            g.eb(cx, this.y + this.h, Math.PI / 2 + rand(-0.18, 0.18), 70, 3);
          }
          if (this.aimT <= 0 && this.x < W - 40 && this.x > 60) { this.aimT = 2.8 / rate; g.fan(this.x, cy, 3, 0.22, 90, 3); }
          break;
        case 'carrier':
          if (this.mode === 'in') { this.x -= sp * 1.8 * dt; if (this.x <= this.hoverX) this.mode = 'hover'; }
          else if (this.mode === 'hover') {
            this.y = this.baseY + Math.sin(this.t * 0.9) * 10;
            this.stay += 0; this.spawnT -= dt; this.fireT -= dt;
            this.stay -= dt * 0.6;
            if (this.spawnT <= 0) { this.spawnT = 3.4 / rate; g.spawnChild(this, 'drone'); g.spawnChild(this, 'drone'); }
            if (this.fireT <= 0) { this.fireT = 2.8 / rate; g.fan(this.x, cy, 2, 0.35, 90, 3); }
            if (this.stay <= 0) this.mode = 'out';
          } else this.x -= sp * 2 * dt;
          break;
        default: break;
      }
      this.y = clamp(this.y, HUD_H + 2, H - this.h - 14);
      if (this.x < -this.w - 14) this.dead = true;
    }
    draw(g) {
      const frames = SPR[this.type];
      const f = Math.floor(g.t * (this.type === 'carrier' ? 3 : 20)) % frames.length;
      const img = variant(frames[f], this.tier, this.flash > 0);
      const x = Math.round(this.x), y = Math.round(this.y);
      if (this.type === 'jet' || this.type === 'interceptor') {
        const ff = Math.floor(g.t * 20) % 2;
        ctx.fillStyle = '#ffb02e'; ctx.fillRect(x + this.w, y + 4, 3 + ff, 1);
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(x + this.w, y + 4, 1 + ff, 1);
      }
      if (this.type === 'interceptor' && this.mode === 'aim' && this.aimT < 0.6) {      // telegraph
        ctx.fillStyle = 'rgba(255,60,60,0.7)';
        const ly = Math.round(this.y + this.h / 2);
        for (let lx = 0; lx < x; lx += 4) ctx.fillRect(lx, ly, 2, 1);
      }
      ctx.drawImage(img, x, y);
      // alien pilot perched on top of the jet, wobbling a little
      const px = x + Math.floor(this.w / 2) - (5 + PILOT_NOSE), py = y - (8 + PILOT_HAT) + Math.round(Math.sin(this.t * 9 + this.phase));
      ctx.drawImage(this.flash > 0 ? PILOT_FLASH : SPR.pilot, px, py);
      if ((this.tier >= 2 || this.def.big) && this.hp < this.maxhp) {
        ctx.fillStyle = '#000'; ctx.fillRect(x, y - 12 - PILOT_HAT, this.w, 3);
        ctx.fillStyle = this.tier >= 3 ? '#ff4b4b' : this.tier === 2 ? GOLD : '#6dff9a';
        ctx.fillRect(x + 1, y - 11 - PILOT_HAT, Math.max(0, Math.round((this.w - 2) * this.hp / this.maxhp)), 1);
      }
    }
    drawSpeech() {
      if (!this.say || this.sayT <= 0 || this.dead) return;
      if (this.sayT < 0.3 && Math.floor(this.sayT * 20) % 2 === 0) return;
      const s = this.say.toUpperCase(), bw = textW(s) + 6, bh = 11;
      const cx = Math.round(this.x + this.w / 2), y = Math.round(this.y);
      const bx = clamp(cx - Math.floor(bw / 2), 2, W - bw - 2);
      let by = y - 8 - PILOT_HAT - bh - 5, below = false;
      if (by < HUD_H + 2) { by = y + this.h + 5; below = true; }           // no room above: go below
      const tx = clamp(cx - 1, bx + 3, bx + bw - 6);
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, bw, bh);
      if (!below) {                                                          // tail pointing down
        ctx.fillStyle = '#000'; ctx.fillRect(tx - 1, by + bh, 5, 1); ctx.fillRect(tx, by + bh + 1, 1, 1);
        ctx.fillRect(tx + 2, by + bh + 1, 1, 1); ctx.fillRect(tx + 1, by + bh + 2, 1, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, by + bh, 3, 1); ctx.fillRect(tx + 1, by + bh + 1, 1, 1);
      } else {                                                               // tail pointing up
        ctx.fillStyle = '#000'; ctx.fillRect(tx - 1, by - 1, 5, 1); ctx.fillRect(tx, by - 2, 1, 1);
        ctx.fillRect(tx + 2, by - 2, 1, 1); ctx.fillRect(tx + 1, by - 3, 1, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, by - 1, 3, 1); ctx.fillRect(tx + 1, by - 2, 1, 1);
      }
      text(s, bx + 3, by + 3, '#111111', 1);
    }
  }

  /* ---------------------------------------------------------
     Bosses
  --------------------------------------------------------- */
  const BOSS_AI = {
    b_hawk(b, g, dt) {
      const r = g.diff.rate, mx = b.x, my = b.y + b.h / 2;
      b.a = (b.a ?? 1) - dt; b.b = (b.b ?? 3) - dt; b.c = (b.c ?? 5) - dt;
      if (b.a <= 0) { b.a = (b.phase === 1 ? 1.5 : b.phase === 2 ? 1.05 : 0.8) / r; g.fan(mx, my, b.phase >= 2 ? 5 : 3, 0.2, 105, 4); }
      if (b.b <= 0) { b.b = 4.2 / r; for (let i = 0; i < 9; i++) g.eb(mx, my, Math.PI - 0.8 + i * 0.2, 85, 3); }
      if (b.phase >= 2 && b.c <= 0) { b.c = 5 / r; g.ring(mx + 10, my, 12, 70, rand(0, 6.28), 4); }
    },
    b_carrier(b, g, dt) {
      const r = g.diff.rate, mx = b.x, my = b.y + b.h / 2;
      b.a = (b.a ?? 2) - dt; b.b = (b.b ?? 2) - dt; b.c = (b.c ?? 3) - dt;
      if (b.a <= 0) {
        b.a = (b.phase >= 2 ? 2.6 : 3.4) / r;
        if (g.enemies.length < 12) { g.spawnChild(b, 'drone'); g.spawnChild(b, b.phase >= 2 ? 'jet' : 'drone'); }
      }
      if (b.b <= 0) { b.b = 2.2 / r; for (let i = 0; i < 5; i++) g.eb(mx, b.y + 6 + (i * (b.h - 12)) / 4, Math.PI, 90, 3); }
      if (b.phase >= 2 && b.c <= 0) { b.c = 3.6 / r; g.ring(mx + 20, my, 14, 68, rand(0, 6.28), 4); }
    },
    b_spinner(b, g, dt) {
      const r = g.diff.rate, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      b.spin = b.spin ?? 0;
      b.a = (b.a ?? 1) - dt; b.b = (b.b ?? 2) - dt; b.c = (b.c ?? 4) - dt;
      if (b.a <= 0) {
        b.a = 0.16 / r;
        const arms = b.phase === 3 ? 3 : 2, dir = b.phase === 2 ? -1 : 1;
        b.spin += dir * 0.33;
        for (let k = 0; k < arms; k++) g.eb(cx, cy, b.spin + (k * Math.PI * 2) / arms, 72, 4, '#b36bff');
      }
      if (b.phase >= 2 && b.b <= 0) { b.b = 1.8 / r; g.fan(cx, cy, 3, 0.25, 100, 3); }
      if (b.phase >= 3 && b.c <= 0) { b.c = 4 / r; g.ring(cx, cy, 16, 66, rand(0, 6.28), 4); }
    },
    b_bomber(b, g, dt) {
      const r = g.diff.rate, mx = b.x, my = b.y + b.h / 2;
      b.a = (b.a ?? 1.5) - dt; b.b = (b.b ?? 1.2) - dt; b.c = (b.c ?? 4) - dt;
      if (b.a <= 0) {
        b.a = (b.phase === 1 ? 2.8 : b.phase === 2 ? 2.0 : 1.5) / r;
        const gap = randi(0, 9);
        for (let i = 0; i < 11; i++) {
          if (Math.abs(i - gap) <= 1) continue;
          g.eb(W * 0.3 + i * 20, HUD_H + 2, Math.PI / 2, 70, 4, '#ffb02e');
        }
      }
      if (b.b <= 0) { b.b = 1.6 / r; g.fan(mx, my, 3, 0.22, 95, 3); }
      if (b.phase >= 2 && b.c <= 0) {
        b.c = 4 / r;
        const gap = randi(0, 8);
        for (let i = 0; i < 10; i++) { if (Math.abs(i - gap) <= 1) continue; g.eb(mx, HUD_H + 8 + i * 15, Math.PI, 70, 3); }
      }
    },
    b_omega(b, g, dt) {
      const r = g.diff.rate * (b.phase === 3 ? 1.25 : 1), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      b.pat = b.pat ?? 0; b.patT = (b.patT ?? 3.5) - dt; b.e = (b.e ?? 0) - dt; b.spin = b.spin ?? 0;
      if (b.patT <= 0) { b.pat = (b.pat + 1) % 4; b.patT = 3.5; b.e = 0.3; if (b.pat === 3) { g.spawnChild(b, 'jet'); g.spawnChild(b, 'jet'); } }
      if (b.e > 0) return;
      if (b.pat === 0) { b.e = 0.16 / r; b.spin += 0.35; g.eb(cx, cy, b.spin, 74, 4, '#ff4b6e'); g.eb(cx, cy, b.spin + Math.PI, 74, 4, '#ff4b6e'); }
      else if (b.pat === 1) { b.e = 0.9 / r; g.fan(cx, cy, 7, 0.16, 105, 4); }
      else if (b.pat === 2) { b.e = 1.2 / r; g.ring(cx, cy, 16, 70, b.spin += 0.2, 4); }
      else { b.e = 0.5 / r; g.eb(rand(W * 0.3, W - 8), HUD_H + 2, Math.PI / 2, 80, 4, '#ffb02e'); }
    },
  };

  class Boss {
    constructor(id, g) {
      const d = BOSSES[id];
      this.id = id; this.type = id; this.def = d; this.name = d.name;
      this.x = W + 4; this.y = H / 2 - d.h / 2; this.w = d.w; this.h = d.h;
      this.isBoss = true; this.tier = 1; this.t = 0; this.flash = 0; this.dead = false;
      this.dying = false; this.invuln = true; this.phase = 1;
      this.maxhp = this.hp = d.hp * (1 + 0.6 * g.loop) * g.diff.hp;
    }
    update(dt, g) {
      this.t += dt; this.flash = Math.max(0, this.flash - dt);
      if (this.dying) return;
      const targetX = W - this.w - 10;
      if (this.invuln) {
        this.x -= 40 * dt;
        if (this.x <= targetX) { this.x = targetX; this.invuln = false; }
        return;
      }
      const ratio = this.hp / this.maxhp;
      this.phase = ratio > 0.55 ? 1 : ratio > 0.25 ? 2 : 3;
      const amp = this.id === 'b_omega' ? 26 : 40;
      this.y = clamp(H / 2 - this.h / 2 + Math.sin(this.t * (0.7 + 0.15 * this.phase)) * amp, HUD_H + 2, H - this.h - 10);
      BOSS_AI[this.id](this, g, dt);
    }
    draw(g) {
      const frames = SPR[this.id];
      const base = frames[Math.floor(g.t * 3) % frames.length];
      base._v = base._v || {};
      if (!base._v.o) base._v.o = tint(base, '#a8bde8');                  // light rim so dark bosses read on dark skies
      if (!base._v.h) base._v.h = tintOver(base, '#ffffff', 0.5);        // soft hit flash
      const img = this.flash > 0 ? base._v.h : base;
      let x = Math.round(this.x), y = Math.round(this.y);
      if (this.dying) { x += randi(-2, 2); y += randi(-2, 2); }
      if (this.invuln && Math.floor(g.t * 10) % 2 === 0) ctx.globalAlpha = 0.7;
      const o = base._v.o;
      ctx.drawImage(o, x - 1, y); ctx.drawImage(o, x + 1, y); ctx.drawImage(o, x, y - 1); ctx.drawImage(o, x, y + 1);
      ctx.drawImage(img, x, y);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------
     Game
  --------------------------------------------------------- */
  const WORDS = ['POW!', 'KABOOM!', 'BOOM!', 'CHA-CHING!', 'ZAP!', 'BZZT!', 'BOING!', 'KAPOW!'];
  const BLAST = ['#ffffff', '#ffe066', '#ffb02e', '#ff6b1a', '#d62828'];
  const TABS = ['UPGRADES', 'WEAPONS', 'SKINS'];
  const ROW_X = 16, ROW_W = 288, ROW_H = 14, ROW_STEP = 15, ROW_Y0 = 42, VIS = 8;

  class MenuJet {
    constructor() { this.x = -40; this.y = rand(24, 130); this.v = rand(70, 120); }
    update(dt) { this.x += this.v * dt; }
    get dead() { return this.x > W + 40; }
    draw(sil) {
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(Math.round(this.x) - 5, Math.round(this.y) + 7, 5, 2);
      blit(sil, this.x, this.y);
    }
  }

  class Game {
    constructor() {
      this.sfx = new Sfx();
      this.bg = new Background();
      this.bg.setMode('dusk');
      this.save = loadSave();
      this.state = 'menu';       // menu | playing | paused | over
      this.screen = 'main';      // main | howto | hangar
      this.sel = 0; this.t = 0;
      this.menuJets = []; this.jetT = 1.5;
      this.mouseDown = false;
      this.saveT = 0; this.dirty = false;
      this.tab = 0; this.hScroll = 0; this.hSel = 0; this.hMsg = ''; this.hMsgT = 0; this.hMsgCol = '#fff';
      this.buildButtons();
      this.computeStats();
      this.clearRun();
    }

    get skin() { return SKIN_BY[this.save.skin] || SKIN_BY.std; }
    get diff() { return DIFFS[this.save.diff] || DIFFS[1]; }

    flush() { writeSave(this.save); this.dirty = false; }

    buildButtons() {
      const cyc = (arr, key, lim) => (dir = 1) => {
        const n = lim();
        this.save[key] = mod(this.save[key] + dir - (key === 'stage' ? 1 : 0), n) + (key === 'stage' ? 1 : 0);
        this.sfx.select(); this.dirty = true;
      };
      const cycDiff = cyc(DIFFS, 'diff', () => DIFFS.length);
      const cycStage = cyc(null, 'stage', () => Math.min(5, this.save.bestStage));
      this.bDiff = new Button('', 66, 138, 94, 12, () => cycDiff(1), cycDiff);
      this.bStage = new Button('', 164, 138, 90, 12, () => cycStage(1), cycStage);
      this.menuBtns = [
        new Button('START MISSION', 90, 74, 140, 18, () => this.startRun()),
        new Button('HANGAR', 90, 95, 140, 18, () => { this.screen = 'hangar'; this.hSel = 0; this.hScroll = 0; this.sfx.select(); }),
        new Button('HOW TO PLAY', 90, 116, 140, 18, () => { this.screen = 'howto'; this.sel = 0; this.sfx.select(); }),
        this.bDiff, this.bStage,
      ];
      this.howBtns = [new Button('BACK', 110, 156, 100, 14, () => this.backToMenu())];
      this.overBtns = [
        new Button('RETRY', 100, 124, 120, 14, () => this.startRun()),
        new Button('HANGAR', 100, 140, 120, 14, () => { this.toMenu(); this.screen = 'hangar'; this.hSel = 0; this.hScroll = 0; }),
        new Button('MENU', 100, 156, 120, 14, () => this.toMenu()),
      ];
      this.pauseBtns = [
        new Button('RESUME', 100, 84, 120, 18, () => { this.state = 'playing'; }),
        new Button('QUIT TO MENU', 100, 106, 120, 18, () => { this.flush(); this.toMenu(); }),
      ];
      this.hTabs = TABS.map((n, i) => new Button(n, [16, 108, 200][i], 26, [88, 88, 60][i], 12, () => this.setTab(i)));
      this.hBack = new Button('BACK', 266, 26, 38, 12, () => this.backToMenu());
    }

    buttons() {
      if (this.state === 'menu') return this.screen === 'main' ? this.menuBtns : this.screen === 'howto' ? this.howBtns : null;
      if (this.state === 'over') return this.overBtns;
      if (this.state === 'paused') return this.pauseBtns;
      return null;
    }

    backToMenu() { this.screen = 'main'; this.sel = 0; this.sfx.select(); this.flush(); }
    toMenu() { this.state = 'menu'; this.screen = 'main'; this.sel = 0; this.bg.setMode('dusk'); this.sfx.select(); this.flush(); }

    computeStats() {
      const u = this.save.up, L = (k) => u[k] || 0;
      this.st = {
        cdMul: 1 - 0.075 * L('rate'), dmgMul: 1 + 0.15 * L('dmg'), maxhp: 4 + L('hull'),
        speed: 110 * (1 + 0.1 * L('engine')), bspd: 1 + 0.1 * L('bspeed'),
        crit: 0.03 + 0.05 * L('crit'), magnet: 58 + 16 * L('magnet'), cval: 1 + 0.15 * L('cval'),
        luck: L('luck'), startPower: 1 + L('power'), bombs: 1 + L('bombs'), maxBombs: 5,
        shield: [0, 4, 7, 10][L('shield')], regenEvery: [0, 18, 12, 8][L('regen')],
        dashCd: 2.6 - 0.4 * L('dash'), combo: 1.5 + 0.3 * L('combo'), gemf: L('gemf'),
        wing: L('wing'), revive: L('revive'), overd: 1 + 0.3 * L('overd'),
      };
    }

    clearRun() {
      this.player = new Player(36, H / 2 - 6);
      this.enemies = []; this.bullets = []; this.ebullets = []; this.particles = [];
      this.pickups = []; this.popups = []; this.bolts = [];
      this.score = 0; this.runCoins = 0; this.runGems = 0; this.time = 0;
      this.stage = 1; this.stageIdx = 0; this.loop = 0; this.cfg = STAGES[0];
      this.phase = 'wave'; this.stageT = 0; this.waveT = 1.5; this.boss = null;
      this.warnT = 0; this.clearT = 0; this.bossDeathT = 0; this.bossFxT = 0;
      this.speedMul = 1; this.shake = 0; this.hitstop = 0; this.flash = 0; this.dmgFlash = 0;
      this.dying = 0; this.combo = 0; this.comboT = 0; this.banner = null;
      this.power = 1; this.bombs = 0; this.bombCd = 0;
      this.shieldT = 0; this.magnetT = 0; this.dcT = 0; this.rapidT = 0; this.revived = false;
      this.weaponId = 'vulcan'; this.overT = 0; this.newBest = false;
      this.stageCoins0 = 0; this.stageGems0 = 0; this.fade = 0;
    }

    /* ---------------- run lifecycle ---------------- */
    startRun() {
      this.sfx.init();
      this.computeStats();
      this.clearRun();
      const st = this.st, sv = this.save;
      const p = this.player;
      p.maxhp = st.maxhp; p.hp = st.maxhp; p.initWings(st.wing);
      this.weaponId = sv.weapons.includes(sv.weapon) ? sv.weapon : 'vulcan';
      this.power = st.startPower; this.bombs = st.bombs; this.shieldT = st.shield;
      this.state = 'playing';
      this.beginStage(clamp(sv.stage, 1, Math.min(5, sv.bestStage)));
      this.sfx.start();
    }

    beginStage(n) {
      this.stage = n; this.stageIdx = (n - 1) % 5; this.loop = Math.floor((n - 1) / 5);
      this.cfg = STAGES[this.stageIdx];
      this.bg.setMode(this.cfg.bg);
      this.phase = 'wave'; this.stageT = 0; this.waveT = 2.2; this.boss = null;
      this.stageCoins0 = this.runCoins; this.stageGems0 = this.runGems;
      this.banner = { title: 'STAGE ' + n, sub: this.cfg.name + (this.loop ? ' - LOOP ' + (this.loop + 1) : ''), t: 2.6 };
      this.fade = 0.5;
      if (n > this.save.bestStage) this.save.bestStage = Math.min(5, n);
      this.dirty = true;
    }

    gameOver() {
      this.state = 'over'; this.overT = 0; this.sel = 0;
      this.newBest = this.score > this.save.hi;
      if (this.newBest) this.save.hi = Math.floor(this.score);
      this.flush();
      this.sfx.over();
    }

    /* ---------------- input ---------------- */
    onKey(code) {
      if (code === 'KeyM') this.sfx.muted = !this.sfx.muted;
      this.sfx.init();
      if (this.state === 'playing') {
        if (code === 'KeyP' || code === 'Escape') { this.state = 'paused'; this.sel = 0; }
        else if (code === 'ShiftLeft' || code === 'ShiftRight') this.tryDash();
        else if (code === 'KeyX') this.useBomb();
        return;
      }
      if (this.state === 'paused' && (code === 'KeyP' || code === 'Escape')) { this.state = 'playing'; return; }
      if (this.state === 'menu' && this.screen === 'hangar') { this.hangarKey(code); return; }
      const btns = this.buttons();
      if (!btns) return;
      if (this.state === 'over' && this.overT < 0.8) return;
      if (code === 'ArrowUp' || code === 'KeyW') { this.sel = mod(this.sel - 1, btns.length); this.sfx.select(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { this.sel = mod(this.sel + 1, btns.length); this.sfx.select(); }
      else if (code === 'ArrowLeft' || code === 'KeyA') { if (btns[this.sel].alt) btns[this.sel].alt(-1); }
      else if (code === 'ArrowRight' || code === 'KeyD') { if (btns[this.sel].alt) btns[this.sel].alt(1); }
      else if (code === 'Enter' || code === 'Space') btns[this.sel].action();
      else if (code === 'Escape') {
        if (this.state === 'menu' && this.screen === 'howto') this.backToMenu();
        else if (this.state === 'over') this.toMenu();
      }
    }

    pointer(x, y, click) {
      let over = false;
      if (this.state === 'menu' && this.screen === 'hangar') {
        for (const b of [...this.hTabs, this.hBack]) if (b.has(x, y)) { over = true; if (click) b.action(); }
        const items = this.hItems();
        for (let i = 0; i < VIS; i++) {
          const idx = this.hScroll + i;
          if (idx >= items.length) break;
          const yy = ROW_Y0 + i * ROW_STEP;
          if (x >= ROW_X && x < ROW_X + ROW_W && y >= yy && y < yy + ROW_H) {
            over = true;
            if (this.hSel !== idx) { this.hSel = idx; this.sfx.select(); }
            if (click) this.hangarAct(items[idx]);
          }
        }
      } else {
        const btns = this.buttons();
        if (btns) {
          btns.forEach((b, i) => {
            if (b.has(x, y)) {
              over = true;
              if (this.sel !== i) { this.sel = i; this.sfx.select(); }
              if (click && !(this.state === 'over' && this.overT < 0.5)) { this.sfx.init(); b.action(); }
            }
          });
        }
      }
      canvas.style.cursor = over ? 'pointer' : 'default';
    }

    wheel(dir) {
      if (this.state === 'menu' && this.screen === 'hangar') {
        const n = this.hItems().length;
        this.hScroll = clamp(this.hScroll + dir, 0, Math.max(0, n - VIS));
        this.hSel = clamp(this.hSel, this.hScroll, Math.min(n - 1, this.hScroll + VIS - 1));
      }
    }

    /* ---------------- hangar ---------------- */
    hItems() {
      return this.tab === 0 ? UPGRADES.map((it) => ({ kind: 'up', it }))
        : this.tab === 1 ? WEAPONS.map((it) => ({ kind: 'wp', it }))
        : SKINS.map((it) => ({ kind: 'skin', it }));
    }
    setTab(i) { this.tab = i; this.hSel = 0; this.hScroll = 0; this.sfx.select(); }
    hMsgSet(s, c) { this.hMsg = s; this.hMsgCol = c; this.hMsgT = 1.6; }

    hangarKey(code) {
      const n = this.hItems().length;
      if (code === 'ArrowUp' || code === 'KeyW') this.hSel = mod(this.hSel - 1, n);
      else if (code === 'ArrowDown' || code === 'KeyS') this.hSel = mod(this.hSel + 1, n);
      else if (code === 'ArrowLeft' || code === 'KeyA') { this.setTab(mod(this.tab - 1, 3)); return; }
      else if (code === 'ArrowRight' || code === 'KeyD') { this.setTab(mod(this.tab + 1, 3)); return; }
      else if (code === 'Enter' || code === 'Space') { this.hangarAct(this.hItems()[this.hSel]); return; }
      else if (code === 'Escape') { this.backToMenu(); return; }
      else return;
      this.sfx.select();
      if (this.hSel < this.hScroll) this.hScroll = this.hSel;
      if (this.hSel >= this.hScroll + VIS) this.hScroll = this.hSel - VIS + 1;
    }

    hangarAct({ kind, it }) {
      const sv = this.save, cur = it.cur === 'g' ? 'gems' : 'coins';
      const spend = (cost) => {
        if (sv[cur] < cost) { this.hMsgSet('NOT ENOUGH ' + (cur === 'gems' ? 'GEMS' : 'COINS'), '#ff6b6b'); this.sfx.deny(); return false; }
        sv[cur] -= cost; return true;
      };
      if (kind === 'up') {
        const lvl = sv.up[it.id] || 0;
        if (lvl >= it.max) { this.hMsgSet('ALREADY MAXED', '#ffb02e'); this.sfx.deny(); return; }
        if (!spend(upCost(it, lvl))) return;
        sv.up[it.id] = lvl + 1;
        this.hMsgSet(it.name + ' UPGRADED!', '#6dff9a'); this.sfx.buy();
      } else {
        const list = kind === 'wp' ? sv.weapons : sv.skins, key = kind === 'wp' ? 'weapon' : 'skin';
        if (list.includes(it.id)) {
          sv[key] = it.id; this.hMsgSet(it.name + ' EQUIPPED', '#9fb0ff'); this.sfx.select();
        } else {
          if (!spend(it.cost)) return;
          list.push(it.id); sv[key] = it.id;
          this.hMsgSet('UNLOCKED ' + it.name + '!', '#6dff9a'); this.sfx.buy();
        }
      }
      this.computeStats();
      this.flush();
    }

    /* ---------------- helpers used by entities ---------------- */
    magnetR() { return this.st.magnet; }
    bs(v) { return v * this.diff.bul * (1 + 0.05 * this.stageIdx + 0.1 * this.loop); }
    eb(x, y, ang, sp, size = 3, col = '#ff4b2b') {
      if (this.ebullets.length > 280) return;
      const v = this.bs(sp);
      this.ebullets.push(new Bullet({ x: x - size / 2, y: y - size / 2, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, w: size, h: size, color: col, life: 9 }));
    }
    aim(x, y) { const p = this.player; return Math.atan2(p.y + p.h / 2 - y, p.x + p.w / 2 - x); }
    fan(x, y, n, spread, sp, size, col) {
      const base = this.aim(x, y);
      for (let i = 0; i < n; i++) this.eb(x, y, base + (i - (n - 1) / 2) * spread, sp, size, col);
    }
    ring(x, y, n, sp, off, size, col) {
      for (let i = 0; i < n; i++) this.eb(x, y, off + (i * Math.PI * 2) / n, sp, size, col);
    }
    pb(o) { this.bullets.push(new Bullet(Object.assign({ friendly: true }, o))); }
    spawnChild(parent, type) {
      this.enemies.push(new Enemy(type, parent.x, parent.y + rand(2, Math.max(3, parent.h - 9)), this, { amp: rand(8, 16) }));
    }
    nearestEnemy(x, y) {
      let best = null, bd = 1e9;
      for (const e of this.enemies) {
        if (e.dead || e.invuln || e.dying || e.x + e.w < x - 10) continue;
        const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    fire(p) {
      const w = WMAP[this.weaponId], st = this.st;
      w.fire(this, p, this.power, st.dmgMul, st.bspd);
      this.sfx.shoot(w.id);
      this.particles.push(new Particle(p.x + 34, p.y + 7, 0, 0, 0.07, 2, '#ffffff', { kind: 'star' }));
      return w.cool * st.cdMul * (this.rapidT > 0 ? 0.65 : 1);
    }

    tryDash() {
      const p = this.player;
      if (this.dying > 0 || p.dashCd > 0 || p.dashT > 0) return;
      const ax = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
      const ay = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
      p.dx = ax || ay ? ax : 1; p.dy = ay;
      p.dashT = 0.18; p.dashCd = this.st.dashCd; p.inv = Math.max(p.inv, 0.3);
      this.sfx.dash();
    }

    useBomb() {
      if (this.state !== 'playing' || this.dying > 0 || this.bombs <= 0 || this.bombCd > 0) return;
      if (this.phase === 'warning') return;
      this.bombs--; this.bombCd = 0.6;
      const p = this.player, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * 6.283;
        this.particles.push(new Particle(cx, cy, Math.cos(a) * 280, Math.sin(a) * 280, 0.55, 3, i % 2 ? '#ffffff' : '#4fd8ff', { drag: 2.4 }));
      }
      for (const b of this.ebullets) {
        for (let k = 0; k < 2; k++) this.particles.push(new Particle(b.x, b.y, rand(-30, 30), rand(-30, 30), 0.35, 1, '#ffe066'));
      }
      this.ebullets.length = 0;
      for (const e of this.enemies) {
        if (e.dead || e.invuln || e.dying) continue;
        e.hp -= (e.isBoss ? 25 : 18) * this.st.dmgMul; e.flash = 0.15;
        if (e.hp <= 0) this.killEnemy(e);
      }
      this.flash = 0.6; this.shake = 9; p.inv = Math.max(p.inv, 1.2);
      this.sfx.bomb();
      this.popups.push(new Popup(W / 2, 70, 'BOMB!', '#ffffff', 3, false, 0.7));
    }

    /* ---------------- scoring, drops ---------------- */
    explode(cx, cy, big) {
      const n = big ? 38 : 24;
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.283), s = rand(25, big ? 150 : 120);
        this.particles.push(new Particle(cx, cy, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), randi(1, big ? 4 : 3), pick(BLAST), { drag: 2.2 }));
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283;
        this.particles.push(new Particle(cx, cy, Math.cos(a) * 100, Math.sin(a) * 100, 0.25, 2, '#ffffff', { drag: 5 }));
      }
      for (let i = 0; i < 5; i++) {
        this.particles.push(new Particle(cx + rand(-4, 4), cy + rand(-4, 4), rand(-20, 10), rand(-25, -5), rand(0.5, 0.9), 3, '#6b6b7a', { drag: 1 }));
      }
      this.particles.push(new Particle(cx, cy, 0, 0, 0.22, big ? 10 : 7, '#ffffff', { kind: 'star' }));
      if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
    }

    burstCoins(cx, cy, n) {
      for (let i = 0; i < n && this.pickups.length < 200; i++) {
        const a = rand(0, 6.283), s = rand(40, 130);
        this.pickups.push(new Pickup(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 50, Math.random() < 0.18 ? 'note' : 'coin'));
      }
    }
    burstGems(cx, cy, n) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.283), s = rand(30, 110);
        this.pickups.push(new Pickup(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 60, 'gem'));
      }
    }
    dropCap(x, y) {
      const hurt = this.player.hp <= this.player.maxhp / 2;
      let tot = 0; const opts = [];
      for (const k of POWER_KEYS) {
        let w = POWERUPS[k].w;
        if (k === 'H') w *= hurt ? 3 : 0.3;
        if (k === 'P' && this.power >= 5) w *= 0.2;
        if (k === 'B' && this.bombs >= this.st.maxBombs) w *= 0.2;
        opts.push([k, w]); tot += w;
      }
      let r = Math.random() * tot, key = 'P';
      for (const [k, w] of opts) { r -= w; if (r <= 0) { key = k; break; } }
      this.pickups.push(new Pickup(x, y, 0, 0, 'cap', key));
    }

    killEnemy(e) {
      if (e.isBoss) { this.startBossDeath(e); return; }
      if (e.dead) return;
      e.dead = true;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2, def = e.def, st = this.st;
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = st.combo;
      this.score += Math.round(def.score * TIER_SCORE[e.tier] * (1 + 0.1 * Math.min(this.combo - 1, 15)));
      this.explode(cx, cy, def.big);
      this.burstCoins(cx, cy, Math.round(def.coins * TIER_COIN[e.tier] * rand(0.8, 1.2)));
      const gemP = (e.tier === 3 ? 0.35 : e.tier === 2 ? 0.1 : 0) + (e.type === 'carrier' ? 0.5 : e.type === 'bomber' ? 0.2 : 0)
        + (e.tier >= 2 ? 0.04 : 0.01) * st.gemf;
      if (Math.random() < gemP) this.burstGems(cx, cy, e.tier === 3 ? 2 : 1);
      const capP = (e.tier === 3 ? 0.6 : e.tier === 2 ? 0.28 : 0.045 + 0.012 * st.luck) + (e.type === 'carrier' || e.type === 'bomber' ? 0.7 : 0);
      if (Math.random() < capP) this.dropCap(cx, cy);
      this.popups.push(new Popup(cx, cy - 10, pick(WORDS), '#ffe066', 1));
      if (this.combo >= 5 && this.combo % 5 === 0) this.popups.push(new Popup(cx, cy + 4, 'COMBO X' + this.combo, '#ff9d3c', 1, true, 0.9));
      this.shake = Math.max(this.shake, def.big ? 6 : 3);
      this.hitstop = def.big ? 0.06 : 0.03;
      this.flash = Math.max(this.flash, def.big ? 0.22 : 0.08);
      this.sfx.boom(def.big);
    }

    startBossDeath(b) {
      if (b.dying) return;
      b.dying = true; b.invuln = true; b.hp = 0;
      this.phase = 'bossdying'; this.bossDeathT = 2.2; this.bossFxT = 0;
      this.ebullets.length = 0;
      for (const e of this.enemies) if (!e.isBoss && !e.dead) this.killEnemy(e);
      this.sfx.boom(true); this.shake = 8;
    }

    finishBoss() {
      const b = this.boss, def = b.def;
      b.dead = true;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      for (let i = 0; i < 3; i++) this.explode(cx + rand(-10, 10), cy + rand(-10, 10), true);
      this.score += def.score;
      this.burstCoins(cx, cy, def.coins);
      this.burstGems(cx, cy, def.gems + (this.loop ? 4 : 0));
      for (let i = 0; i < 2; i++) this.dropCap(cx + rand(-14, 14), cy + rand(-14, 14));
      this.flash = 0.7; this.shake = 10; this.sfx.boom(true); this.sfx.clear();
      this.phase = 'clear'; this.clearT = 6;
      const p = this.player;
      if (p.hp < p.maxhp) p.hp++;
      this.bombs = Math.min(this.st.maxBombs, this.bombs + 1);
      this.shieldT = Math.max(this.shieldT, 3);
      for (let i = 0; i < 28; i++) {                         // coin shower
        this.pickups.push(new Pickup(rand(20, W - 10), HUD_H + rand(0, 20), rand(-10, 10), rand(0, 40), Math.random() < 0.2 ? 'note' : 'coin'));
      }
      const nxt = Math.min(5, this.stage + 1);
      if (nxt > this.save.bestStage) this.save.bestStage = nxt;
      this.flush();
    }

    collect(c) {
      const st = this.st;
      if (c.kind === 'gem') {
        this.save.gems++; this.runGems++; this.sfx.gem();
        this.popups.push(new Popup(c.x, c.y - 6, '+1', '#8fe8ff', 1, true, 0.6));
      } else {
        const v = Math.max(1, Math.round((c.kind === 'note' ? 25 : 5) * st.cval * this.diff.coin * (this.dcT > 0 ? 2 : 1)));
        this.save.coins += v; this.runCoins += v; this.sfx.coin();
      }
      this.dirty = true;
      for (let i = 0; i < 3; i++) this.particles.push(new Particle(c.x, c.y, rand(-30, 30), rand(-40, -10), 0.3, 1, c.kind === 'gem' ? '#d8f8ff' : '#fff3a0'));
    }

    collectCap(c) {
      const st = this.st, p = this.player, over = st.overd;
      let msg = '';
      switch (c.cap) {
        case 'P':
          if (this.power < 5) { this.power++; msg = 'POWER UP!'; } else { this.score += 500; msg = 'MAX POWER +500'; }
          break;
        case 'B':
          if (this.bombs < st.maxBombs) { this.bombs++; msg = 'BOMB +1'; } else { this.score += 300; msg = 'BOMBS FULL'; }
          break;
        case 'S': this.shieldT = Math.max(this.shieldT, 8 * over); msg = 'SHIELD'; break;
        case 'H':
          if (p.hp < p.maxhp) { p.hp++; msg = 'REPAIR +1'; } else { this.shieldT = Math.max(this.shieldT, 4); msg = 'SHIELD'; }
          break;
        case 'M': this.magnetT = 6 * over; msg = 'MAGNET!'; break;
        case 'D': this.dcT = 12 * over; msg = 'COINS X2'; break;
        case 'R': this.rapidT = 10 * over; msg = 'RAPID FIRE'; break;
        default: break;
      }
      this.popups.push(new Popup(c.x, c.y - 8, msg, '#ffffff', 1, true, 1.1));
      for (let i = 0; i < 8; i++) this.particles.push(new Particle(c.x, c.y, rand(-60, 60), rand(-60, 60), 0.4, 2, POWERUPS[c.cap].col, { drag: 2 }));
      this.sfx.power();
    }

    hurtPlayer() {
      const p = this.player;
      if (p.inv > 0 || this.dying > 0 || p.dashT > 0) return;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (this.shieldT > 0) {
        this.shieldT = 0; p.inv = 0.8; this.shake = 3;
        this.popups.push(new Popup(cx, p.y - 6, 'BLOCKED!', '#4fd8ff', 1));
        for (let i = 0; i < 14; i++) this.particles.push(new Particle(cx, cy, rand(-90, 90), rand(-90, 90), 0.4, 2, '#4fd8ff', { drag: 2 }));
        this.sfx.tick(); this.sfx.tone(500, 0.12, 'triangle', 0.08, -300);
        return;
      }
      p.hp--; p.inv = 1.4;
      this.power = Math.max(this.st.startPower, this.power - 1);
      this.combo = 0; this.comboT = 0;
      this.shake = 7; this.dmgFlash = 0.18; this.hitstop = 0.05;
      for (let i = 0; i < 12; i++) {
        this.particles.push(new Particle(cx, cy, rand(-90, 90), rand(-90, 90), 0.4, 2, pick(['#ffffff', '#ffb02e', '#ff4b2b']), { drag: 2 }));
      }
      if (p.hp <= 0) {
        if (this.st.revive && !this.revived) {
          this.revived = true; p.hp = Math.ceil(p.maxhp / 2); p.inv = 2.5; this.shieldT = 3;
          this.ebullets.length = 0;
          this.popups.push(new Popup(W / 2, 80, 'SECOND WIND!', '#6dff9a', 2, false, 1.5));
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * 6.283;
            this.particles.push(new Particle(cx, cy, Math.cos(a) * 200, Math.sin(a) * 200, 0.5, 2, '#6dff9a', { drag: 2.5 }));
          }
          this.sfx.heal(); return;
        }
        p.hp = 0; this.dying = 1.0; p.hidden = true;
        this.explode(cx, cy, true); this.explode(cx - 8, cy + 2, true);
        this.shake = 9; this.flash = 0.3;
        this.sfx.boom(true);
      } else this.sfx.hurt();
    }

    /* ---------------- waves ---------------- */
    spawnWaves(dt) {
      this.waveT -= dt;
      if (this.waveT > 0) return;
      const cfg = this.cfg, p = clamp(this.stageT / cfg.len, 0, 1);
      const rate = this.diff.rate * (1 + 0.18 * this.loop);
      this.waveT = lerp(3.0, 1.7, p) / rate;
      if (this.enemies.length >= 16) return;
      let tot = 0; const opts = [];
      for (const t of cfg.pool) {
        const [w, minP] = WAVE_W[t];
        if (p >= minP) { opts.push([t, w]); tot += w; }
      }
      let r = Math.random() * tot, type = opts[0][0];
      for (const [t, w] of opts) { r -= w; if (r <= 0) { type = t; break; } }
      const tierMax = this.loop > 0 ? 3 : cfg.tierMax;
      let tier = 1;
      if (tierMax >= 2 && Math.random() < 0.08 + 0.22 * p + 0.05 * this.loop) tier = 2;
      if (tierMax >= 3 && Math.random() < 0.04 + 0.1 * p + 0.05 * this.loop) tier = 3;
      this.spawnGroup(type, tier);
    }

    spawnGroup(type, tier) {
      const def = ET[type], idx = this.stageIdx;
      const mk = (x, y, o = {}) => this.enemies.push(new Enemy(type, x, y, this, Object.assign({ tier }, o)));
      if (type === 'drone' || type === 'jet') {
        const n = type === 'jet' ? randi(2, 3) + (idx >= 2 ? 1 : 0) : randi(3, 5) + (idx >= 2 ? 1 : 0);
        const form = pick(['line', 'column', 'vee', 'swarm', 'line']);
        const y = rand(HUD_H + 22, H - def.h - 50), amp = rand(10, 24), freq = rand(2, 3);
        if (form === 'line') {
          for (let i = 0; i < n; i++) mk(W + 8 + i * 22, y, { phase: -i * 0.65, amp, freq });
        } else if (form === 'column') {
          const span = H - 60 - HUD_H;
          for (let i = 0; i < n; i++) mk(W + 8 + (i % 2) * 10, HUD_H + 14 + (i * span) / Math.max(1, n - 1), { phase: i, amp: 6 });
        } else if (form === 'vee') {
          mk(W + 8, y, { phase: 0, amp: 4 });
          for (let k = 1; k <= Math.floor(n / 2); k++) {
            mk(W + 8 + k * 16, clamp(y - k * 14, HUD_H + 6, H - 40), { phase: 0, amp: 4 });
            mk(W + 8 + k * 16, clamp(y + k * 14, HUD_H + 6, H - 40), { phase: 0, amp: 4 });
          }
        } else {
          for (let i = 0; i < n; i++) mk(W + 8 + rand(0, 90), rand(HUD_H + 8, H - def.h - 30));
        }
      } else {
        let count = 1;
        if ((type === 'gunship' || type === 'spinner' || type === 'interceptor') && idx >= 3 && Math.random() < 0.35) count = 2;
        for (let i = 0; i < count; i++) {
          let y;
          if (type === 'bomber') y = rand(HUD_H + 6, 40);
          else if (count === 2) y = i ? rand(H / 2 + 5, H - def.h - 30) : rand(HUD_H + 10, H / 2 - 20);
          else y = rand(HUD_H + 14, H - def.h - 32);
          mk(W + 8 + i * 26, y);
        }
      }
    }

    /* ---------------- update ---------------- */
    update(dt) {
      this.t += dt;
      if (this.hMsgT > 0) this.hMsgT -= dt;
      if (this.dirty) { this.saveT += dt; if (this.saveT > 2) { this.saveT = 0; this.flush(); } }

      if (this.state === 'menu') {
        this.bg.update(dt, 20);
        this.jetT -= dt;
        if (this.jetT <= 0) { this.jetT = rand(2.5, 5); this.menuJets.push(new MenuJet()); }
        this.menuJets.forEach((j) => j.update(dt));
        this.menuJets = this.menuJets.filter((j) => !j.dead);
        return;
      }
      if (this.state === 'paused') return;
      if (this.state === 'over') {
        this.overT += dt;
        this.bg.update(dt, 12);
        this.updateFx(dt);
        return;
      }

      // ---- playing ----
      if (this.hitstop > 0) { this.hitstop -= dt; return; }
      this.time += dt;
      this.speedMul = Math.min(1.9, 1 + 0.07 * Math.min(this.stageIdx, 4) + 0.12 * this.loop + 0.002 * this.stageT);
      this.shieldT = Math.max(0, this.shieldT - dt); this.magnetT = Math.max(0, this.magnetT - dt);
      this.dcT = Math.max(0, this.dcT - dt); this.rapidT = Math.max(0, this.rapidT - dt);
      this.bombCd = Math.max(0, this.bombCd - dt);
      this.comboT = Math.max(0, this.comboT - dt);
      if (this.comboT <= 0) this.combo = 0;
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      if (this.fade > 0) this.fade -= dt;
      this.bg.update(dt, 44 * (0.85 + 0.15 * this.speedMul));

      const p = this.player;
      if (this.dying > 0) {
        this.dying -= dt;
        if (this.dying <= 0) { this.gameOver(); return; }
      } else p.update(dt, this);

      // stage flow
      if (this.phase === 'wave') {
        this.stageT += dt;
        this.spawnWaves(dt);
        if (this.stageT >= this.cfg.len) { this.phase = 'warning'; this.warnT = 3.4; this.sfx.warning(); }
      } else if (this.phase === 'warning') {
        this.warnT -= dt;
        if (this.warnT <= 0) {
          this.boss = new Boss(this.cfg.boss, this);
          this.enemies.push(this.boss);
          this.phase = 'boss';
        }
      } else if (this.phase === 'bossdying') {
        this.bossDeathT -= dt; this.bossFxT -= dt;
        const b = this.boss;
        if (this.bossFxT <= 0) {
          this.bossFxT = 0.11;
          this.explode(b.x + rand(0, b.w), b.y + rand(0, b.h), false);
          this.shake = Math.max(this.shake, 3); this.sfx.boom(false);
        }
        if (this.bossDeathT <= 0) this.finishBoss();
      } else if (this.phase === 'clear') {
        this.clearT -= dt;
        if (this.clearT <= 0) this.beginStage(this.stage + 1);
      }

      this.bullets.forEach((b) => b.update(dt, this));
      this.ebullets.forEach((b) => b.update(dt, this));
      this.enemies.forEach((e) => e.update(dt, this));
      this.collisions();
      this.pickups.forEach((c) => c.update(dt, this));
      this.updateFx(dt);

      this.bullets = this.bullets.filter((b) => !b.dead);
      this.ebullets = this.ebullets.filter((b) => !b.dead);
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.pickups = this.pickups.filter((c) => !c.dead);
    }

    updateFx(dt) {
      this.particles.forEach((q) => q.update(dt));
      this.particles = this.particles.filter((q) => !q.dead);
      this.popups.forEach((q) => q.update(dt));
      this.popups = this.popups.filter((q) => !q.dead);
      this.bolts.forEach((b) => { b.life -= dt; });
      this.bolts = this.bolts.filter((b) => b.life > 0);
      this.shake = Math.max(0, this.shake - dt * 22);
      this.flash = Math.max(0, this.flash - dt * 1.2);
      this.dmgFlash = Math.max(0, this.dmgFlash - dt);
    }

    collisions() {
      const p = this.player;
      // player bullets vs enemies
      for (const b of this.bullets) {
        if (b.dead) continue;
        for (const e of this.enemies) {
          if (e.dead || e.invuln || e.dying) continue;
          if (b.hit && b.hit.has(e)) continue;
          if (overlap(b, e)) {
            this.hitEnemy(b, e);
            if (b.dead) break;
          }
        }
      }
      if (this.dying > 0) return;
      // enemy bullets vs player
      const hb = this.shieldT > 0 ? { x: p.x - 2, y: p.y - 4, w: p.w + 4, h: p.h + 8 } : p.core;
      for (const b of this.ebullets) {
        if (!b.dead && overlap(hb, b)) { b.dead = true; this.hurtPlayer(); }
      }
      // enemy bodies vs player
      const bx = p.box;
      for (const e of this.enemies) {
        if (e.dead || e.dying || e.invuln || p.dashT > 0 || !overlap(bx, e)) continue;
        if (!e.isBoss && (e.type === 'drone' || e.type === 'jet' || e.type === 'interceptor')) this.killEnemy(e);
        else if (!e.isBoss) { e.hp -= 5; e.flash = 0.1; if (e.hp <= 0) this.killEnemy(e); }
        this.hurtPlayer();
      }
    }

    hitEnemy(b, e) {
      let dmg = b.dmg;
      const crit = Math.random() < this.st.crit;
      if (crit) dmg *= 2;
      e.hp -= dmg; e.flash = 0.08;
      if (b.hit) b.hit.add(e);
      if (b.pierce > 0) { if (b.pierce !== Infinity) b.pierce--; } else b.dead = true;
      const hx = Math.min(b.x + b.w, e.x + e.w / 2), hy = b.y + b.h / 2;
      for (let i = 0; i < 3; i++) this.particles.push(new Particle(hx, hy, rand(-20, 80), rand(-60, 60), 0.25, 1, crit ? '#ffffff' : '#ffe066', { drag: 2 }));
      if (crit) this.particles.push(new Particle(hx, hy, 0, 0, 0.15, 3, '#ffffff', { kind: 'star' }));
      this.sfx.tick();
      if (this.shake < 1.5) this.shake = 1.5;
      if (b.splash) this.splash(hx, hy, b.splash, dmg * 0.6, e);
      if (b.chain) this.chain(e, b.chain, dmg * 0.7);
      if (e.hp <= 0) this.killEnemy(e);
    }

    splash(x, y, r, dmg, except) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.283;
        this.particles.push(new Particle(x, y, Math.cos(a) * r * 4, Math.sin(a) * r * 4, 0.2, 2, '#ffb02e', { drag: 6 }));
      }
      for (const e of this.enemies) {
        if (e === except || e.dead || e.invuln || e.dying) continue;
        if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + e.w / 2) {
          e.hp -= dmg; e.flash = 0.08;
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
    }

    chain(from, n, dmg) {
      let cur = from; const done = new Set([from]);
      for (let i = 0; i < n; i++) {
        let best = null, bd = 80;
        for (const e of this.enemies) {
          if (done.has(e) || e.dead || e.invuln || e.dying) continue;
          const d = Math.hypot(e.x + e.w / 2 - (cur.x + cur.w / 2), e.y + e.h / 2 - (cur.y + cur.h / 2));
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        done.add(best);
        this.bolts.push({ x1: cur.x + cur.w / 2, y1: cur.y + cur.h / 2, x2: best.x + best.w / 2, y2: best.y + best.h / 2, life: 0.14 });
        best.hp -= dmg; best.flash = 0.08;
        if (best.hp <= 0) this.killEnemy(best);
        cur = best;
      }
    }

    /* ---------------- drawing ---------------- */
    draw() {
      if (this.state === 'menu') { this.drawMenu(); return; }

      this.bg.draw();
      ctx.save();
      const sx = Math.round((Math.random() - 0.5) * 2 * this.shake);
      const sy = Math.round((Math.random() - 0.5) * 2 * this.shake);
      ctx.translate(sx, sy);
      this.pickups.forEach((c) => c.draw());
      this.enemies.forEach((e) => e.draw(this));
      this.ebullets.forEach((b) => b.draw());
      this.bullets.forEach((b) => b.draw());
      this.player.draw(this);
      this.bolts.forEach((b) => this.drawBolt(b));
      this.particles.forEach((q) => q.draw());
      this.popups.forEach((q) => q.draw());
      this.enemies.forEach((e) => { if (e.drawSpeech) e.drawSpeech(); });
      ctx.restore();

      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash)})`; ctx.fillRect(0, 0, W, H); }
      if (this.dmgFlash > 0) { ctx.fillStyle = `rgba(255,30,30,${this.dmgFlash * 1.4})`; ctx.fillRect(0, 0, W, H); }
      if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(this.fade * 1.6, 0, 1)})`; ctx.fillRect(0, 0, W, H); }

      this.drawHUD();
      this.drawBanners();

      if (this.state === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        text('PAUSED', W / 2, 50, GOLD, 4, '#b8321a', 'center');
        this.pauseBtns.forEach((b, i) => b.draw(i === this.sel, this.t));
        text('COINS AND GEMS ARE ALWAYS SAVED', W / 2, 140, '#9fb0ff', 1, null, 'center');
      } else if (this.state === 'over') this.drawGameOver();
    }

    drawBolt(b) {
      ctx.fillStyle = '#4fd8ff';
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(lerp(b.x1, b.x2, t) + (i && i < steps ? rand(-2, 2) : 0));
        const y = Math.round(lerp(b.y1, b.y2, t) + (i && i < steps ? rand(-2, 2) : 0));
        ctx.fillRect(x, y, 2, 2);
        if (i % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = '#4fd8ff'; }
      }
    }

    drawHUD() {
      ctx.fillStyle = 'rgba(8,8,24,0.9)'; ctx.fillRect(0, 0, W, HUD_H);
      ctx.fillStyle = GOLD; ctx.fillRect(0, HUD_H - 1, W, 1);
      ctx.fillStyle = '#000'; ctx.fillRect(0, HUD_H, W, 1);

      text('SCORE', 4, 5, GOLD, 1);
      text(pad(this.score), 26, 2, '#ffffff', 2, '#333');
      drawCoinIcon(80, 3);
      text(fmt(this.runCoins), 90, 2, '#ffe066', 2, '#5a3b00');
      drawGemIcon(142, 4);
      text(fmt(this.runGems), 152, 2, '#8fe8ff', 2, '#0c3a4a');
      text('ST', 184, 5, '#9fb0ff', 1);
      text(this.stage, 196, 2, '#ffffff', 2, '#333');
      text('HP', 216, 5, '#ff8a8a', 1);
      const p = this.player;
      const blink = p.hp <= 1 && Math.floor(this.t * 5) % 2 === 0;
      for (let i = 0; i < p.maxhp; i++) {
        const x = 230 + i * 10;
        ctx.fillStyle = '#000'; ctx.fillRect(x, 3, 9, 8);
        ctx.fillStyle = i < p.hp ? (blink ? '#ffb3b3' : '#e63946') : '#2a2a40';
        ctx.fillRect(x + 1, 4, 7, 6);
        if (i < p.hp) { ctx.fillStyle = '#ff8a8a'; ctx.fillRect(x + 1, 4, 7, 1); }
      }

      // combo
      if (this.combo >= 2) {
        text('COMBO X' + this.combo, 4, 17, '#ff9d3c', 1, '#000');
        ctx.fillStyle = '#000'; ctx.fillRect(4, 24, 40, 2);
        ctx.fillStyle = '#ff9d3c'; ctx.fillRect(4, 24, Math.round(40 * this.comboT / this.st.combo), 2);
      }

      // boss bar
      const b = this.boss;
      if (b && !b.dead && (this.phase === 'boss' || this.phase === 'bossdying')) {
        text(b.name, W / 2, 17, '#ffffff', 1, '#000', 'center');
        ctx.fillStyle = '#000'; ctx.fillRect(70, 24, 180, 6);
        ctx.fillStyle = '#5a1020'; ctx.fillRect(71, 25, 178, 4);
        ctx.fillStyle = b.phase === 3 ? '#ff4b4b' : b.phase === 2 ? '#ffb02e' : '#6dff9a';
        ctx.fillRect(71, 25, Math.max(0, Math.round(178 * b.hp / b.maxhp)), 4);
      }

      // bottom strip: bombs, dash, status, weapon
      ctx.fillStyle = 'rgba(8,8,24,0.72)'; ctx.fillRect(0, H - 11, W, 11);
      for (let i = 0; i < this.bombs; i++) drawBombIcon(3 + i * 9, H - 10);
      if (this.bombs === 0) text('NO BOMBS', 3, H - 8, '#666a85', 1);
      text('DASH', 56, H - 8, '#9fb0ff', 1);
      const dp = this.player.dashCd <= 0 ? 1 : 1 - this.player.dashCd / this.st.dashCd;
      ctx.fillStyle = '#000'; ctx.fillRect(78, H - 8, 26, 5);
      ctx.fillStyle = dp >= 1 ? '#6dff9a' : '#4a5a9a'; ctx.fillRect(79, H - 7, Math.round(24 * dp), 3);
      let sx = 112;
      const stat = (label, t, col) => { if (t > 0) { text(label + ' ' + Math.ceil(t), sx, H - 8, col, 1, '#000'); sx += (label.length + 3) * 4 + 4; } };
      stat('SHD', this.shieldT, '#4fd8ff'); stat('RPD', this.rapidT, '#ff9d3c');
      stat('X2', this.dcT, '#ffd23f'); stat('MAG', this.magnetT, '#b36bff');
      const w = WMAP[this.weaponId];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < this.power ? w.color : '#2a2a50'; ctx.fillRect(W - 24 + i * 4, H - 8, 3, 5); }
      text(w.name, W - 28, H - 8, '#ffffff', 1, '#000', 'right');
      if (this.sfx.muted) text('MUTE', 258, H - 8, '#888', 1);
    }

    drawBanners() {
      if (this.banner && this.state === 'playing') {
        const k = this.banner.t;
        if (k > 0.3 || Math.floor(k * 16) % 2) {
          text(this.banner.title, W / 2, 60, GOLD, 4, '#b8321a', 'center');
          text(this.banner.sub, W / 2, 86, '#ffffff', 1, '#000', 'center');
        }
      }
      if (this.phase === 'warning' && this.state === 'playing') {
        const on = Math.floor(this.warnT * 4) % 2 === 0;
        ctx.fillStyle = on ? 'rgba(255,0,0,0.18)' : 'rgba(255,0,0,0.06)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = on ? '#ff3b3b' : '#7a1010';
        ctx.fillRect(0, 56, W, 3); ctx.fillRect(0, 108, W, 3);
        if (on) text('WARNING!', W / 2, 70, '#ffffff', 4, '#c01010', 'center');
        text(BOSSES[this.cfg.boss].name + ' APPROACHES', W / 2, 96, '#ffd0d0', 1, '#000', 'center');
      }
      if (this.phase === 'clear' && this.state === 'playing') {
        text('STAGE CLEAR!', W / 2, 52, '#6dff9a', 3, '#0a4a22', 'center');
        text('+' + (this.runCoins - this.stageCoins0) + ' COINS   +' + (this.runGems - this.stageGems0) + ' GEMS', W / 2, 82, '#ffffff', 1, '#000', 'center');
        if (this.stage % 5 === 0) text('VICTORY! ENDLESS LOOPS NEXT', W / 2, 94, GOLD, 1, '#000', 'center');
        else text('NEXT: ' + STAGES[this.stage % 5].name, W / 2, 94, '#9fb0ff', 1, '#000', 'center');
      }
    }

    drawGameOver() {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      panel(70, 8, 180, 164);
      text('GAME OVER', W / 2, 16, '#ff4b4b', 4, '#4a0a0a', 'center');
      text('STAGE ' + this.stage + ' - ' + this.cfg.name, W / 2, 42, '#9fb0ff', 1, '#000', 'center');
      text('SCORE: ' + pad(this.score), W / 2, 54, '#ffffff', 2, '#333', 'center');
      drawCoinIcon(110, 71);
      text('+' + this.runCoins, 122, 71, '#ffe066', 2, '#5a3b00');
      drawGemIcon(110, 88);
      text('+' + this.runGems, 122, 87, '#8fe8ff', 2, '#0c3a4a');
      text('BEST: ' + pad(this.save.hi), W / 2, 104, '#9fb0ff', 1, '#000', 'center');
      if (this.newBest && Math.floor(this.t * 3) % 2 === 0) text('NEW HI-SCORE!', W / 2, 113, '#6dff9a', 1, '#000', 'center');
      this.overBtns.forEach((b, i) => b.draw(i === this.sel, this.t));
    }

    /* ---------------- menu screens ---------------- */
    drawSearchlights() {
      const gy = H - 20;
      [[34, 0], [286, 2.1], [160, 4.3]].forEach(([bx, ph]) => {
        const a = Math.sin(this.t * 0.7 + ph) * 0.55;
        ctx.fillStyle = 'rgba(255,246,176,0.10)';
        for (let d = 0; d < 150; d++) {
          const x = bx + Math.tan(a) * d, w = 2 + d * 0.1;
          ctx.fillRect(Math.round(x - w / 2), gy - d, Math.round(w), 1);
        }
        ctx.fillStyle = '#2a2a40'; ctx.fillRect(bx - 3, gy - 1, 6, 3);
      });
    }

    drawMenu() {
      this.bg.draw();
      this.drawSearchlights();
      this.menuJets.forEach((j) => j.draw(this.skin.sil));

      if (this.screen === 'hangar') { this.drawHangar(); return; }

      for (const [x, y] of [[16, 48], [268, 48]]) {
        ctx.fillStyle = '#9aa3b2'; ctx.fillRect(x - 2, y - 4, 2, 120);
        ctx.fillStyle = GOLD; ctx.fillRect(x - 3, y - 7, 4, 4);
        drawFlag(x, y, this.t);
      }

      if (this.screen === 'howto') { this.drawHowTo(); return; }

      panel(62, 6, 196, 168);
      const bob = Math.round(Math.sin(this.t * 2.2) * 1.5);
      drawTitle(W / 2, 29 + bob);
      text('THE GREAT OCTOBER VICTORY', W / 2, 60, '#ffffff', 1, '#000', 'center');
      ctx.fillStyle = FLAG_RED; ctx.fillRect(80, 69, 53, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(133, 69, 54, 1);
      ctx.fillStyle = '#000000'; ctx.fillRect(187, 69, 53, 1);

      this.bDiff.label = DIFFS[this.save.diff].name;
      this.bStage.label = 'STAGE ' + this.save.stage;
      this.menuBtns.forEach((b, i) => b.draw(i === this.sel, this.t));

      if (Math.floor(this.t * 2.4) % 2 === 0) text('PRESS START', W / 2, 156, GOLD, 2, '#000', 'center');
      text('HI ' + pad(this.save.hi), 70, 168, '#9fb0ff', 1);
      drawCoinIcon(142, 166); text(fmt(this.save.coins), 152, 168, '#ffe066', 1);
      drawGemIcon(206, 167); text(fmt(this.save.gems), 215, 168, '#8fe8ff', 1);
    }

    drawHowTo() {
      panel(30, 6, 260, 168);
      text('HOW TO PLAY', W / 2, 12, GOLD, 2, '#b8321a', 'center');
      let y = 32;
      const H1 = (s) => { text(s, 42, y, GOLD, 1); y += 8; };
      const L = (s) => { text(s, 42, y, '#ffffff', 1); y += 8; };
      H1('CONTROLS');
      L('WASD / ARROWS   MOVE');
      L('SPACE / CLICK   FIRE (HOLD)');
      L('SHIFT           DASH - DODGES EVERYTHING');
      L('X / R-CLICK     BOMB - CLEARS THE SCREEN');
      L('P / ESC PAUSE   M MUTE');
      H1('CAPSULES');
      L('P POWER  B BOMB  S SHIELD  + REPAIR');
      L('M MAGNET  2 DOUBLE COINS  R RAPID FIRE');
      H1('GOAL');
      L('SURVIVE 5 STAGES AND BEAT EVERY BOSS.');
      L('COINS AND GEMS ARE SAVED. SPEND THEM IN');
      L('THE HANGAR ON UPGRADES, WEAPONS, SKINS.');
      L('GOLD AND RED FOES ARE TOUGHER BUT DROP GEMS.');
      L('GETTING HIT COSTS A POWER LEVEL!');
      this.howBtns.forEach((b, i) => b.draw(i === this.sel, this.t));
    }

    drawHangar() {
      const sv = this.save;
      panel(10, 6, 300, 168);
      text('HANGAR', 16, 12, GOLD, 2, '#b8321a');
      const ship = this.skin.spr;
      blit(ship, 68, 10);
      drawCoinIcon(150, 11); text(fmt(sv.coins), 161, 12, '#ffe066', 2, '#5a3b00');
      drawGemIcon(228, 12); text(fmt(sv.gems), 238, 12, '#8fe8ff', 2, '#0c3a4a');
      this.hTabs.forEach((b, i) => b.draw(i === this.tab, this.t));
      this.hBack.draw(false, this.t);

      const items = this.hItems();
      for (let i = 0; i < VIS; i++) {
        const idx = this.hScroll + i;
        if (idx >= items.length) break;
        const y = ROW_Y0 + i * ROW_STEP, sel = idx === this.hSel;
        ctx.fillStyle = sel ? GOLD : '#2b2f6b'; ctx.fillRect(ROW_X, y, ROW_W, ROW_H);
        ctx.fillStyle = sel ? '#3a1a2a' : '#12153f'; ctx.fillRect(ROW_X + 1, y + 1, ROW_W - 2, ROW_H - 2);
        this.drawHRow(items[idx], y, sel);
      }
      if (this.hScroll > 0) { ctx.fillStyle = GOLD; ctx.fillRect(307, 43, 1, 1); ctx.fillRect(306, 44, 3, 1); ctx.fillRect(305, 45, 5, 1); }
      if (this.hScroll + VIS < items.length) { ctx.fillStyle = GOLD; ctx.fillRect(305, 156, 5, 1); ctx.fillRect(306, 157, 3, 1); ctx.fillRect(307, 158, 1, 1); }

      if (this.hMsgT > 0) text(this.hMsg, W / 2, 164, this.hMsgCol, 1, '#000', 'center');
      else text('A/D TAB   W/S SELECT   ENTER BUY OR EQUIP   ESC BACK', W / 2, 164, '#7f89c8', 1, null, 'center');
    }

    drawHRow({ kind, it }, y, sel) {
      const sv = this.save, x = ROW_X, w = ROW_W, ty = y + 4;
      const nameCol = sel ? '#ffffff' : '#c9d1ff';
      text(it.name, x + 5, ty, nameCol, 1);
      const price = (cost, cur) => {
        const have = (cur === 'g' ? sv.gems : sv.coins) >= cost;
        const s = fmt(cost);
        text(s, x + w - 14, ty, have ? '#6dff9a' : '#ff6b6b', 1, null, 'right');
        if (cur === 'g') drawGemIcon(x + w - 11, y + 3); else drawCoinIcon(x + w - 12, y + 3);
      };
      if (kind === 'up') {
        const lvl = sv.up[it.id] || 0;
        for (let i = 0; i < it.max; i++) { ctx.fillStyle = i < lvl ? GOLD : '#2a2a50'; ctx.fillRect(x + 66 + i * 5, y + 4, 4, 5); }
        text(it.desc, x + 102, ty, '#7f89c8', 1);
        if (lvl >= it.max) text('MAX', x + w - 5, ty, GOLD, 1, null, 'right');
        else price(upCost(it, lvl), it.cur);
      } else if (kind === 'wp') {
        ctx.fillStyle = '#000'; ctx.fillRect(x + 66, y + 3, 8, 8);
        ctx.fillStyle = it.color; ctx.fillRect(x + 67, y + 4, 6, 6);
        text(it.desc, x + 102, ty, '#7f89c8', 1);
        const owned = sv.weapons.includes(it.id);
        if (sv.weapon === it.id) text('EQUIPPED', x + w - 5, ty, '#6dff9a', 1, null, 'right');
        else if (owned) text('OWNED', x + w - 5, ty, '#9fb0ff', 1, null, 'right');
        else price(it.cost, it.cur);
      } else {
        [it.pal.mid, it.pal.light, it.pal.cock].forEach((c, i) => {
          ctx.fillStyle = '#000'; ctx.fillRect(x + 66 + i * 9, y + 3, 8, 8);
          ctx.fillStyle = c; ctx.fillRect(x + 67 + i * 9, y + 4, 6, 6);
        });
        text(it.cur === 'g' ? 'PREMIUM' : 'STANDARD', x + 102, ty, '#7f89c8', 1);
        const owned = sv.skins.includes(it.id);
        if (sv.skin === it.id) text('EQUIPPED', x + w - 5, ty, '#6dff9a', 1, null, 'right');
        else if (owned) text('OWNED', x + w - 5, ty, '#9fb0ff', 1, null, 'right');
        else price(it.cost, it.cur);
      }
    }
  }

  /* ---------------------------------------------------------
     Boot: input + main loop
  --------------------------------------------------------- */
  buildTitle();
  const game = new Game();

  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    const first = !keys.has(e.code);
    keys.add(e.code);
    if (first && !e.repeat) game.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    game.mouseDown = false;
    if (game.state === 'playing') game.state = 'paused';
  });

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  }
  canvas.addEventListener('pointermove', (e) => game.pointer(...toGame(e), false));
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    if (e.button === 2) { game.sfx.init(); game.useBomb(); return; }      // right click = bomb
    const wasPlaying = game.state === 'playing';
    game.pointer(...toGame(e), true);
    if (wasPlaying && e.button === 0) game.mouseDown = true;                // hold left click to fire
  });
  const releaseMouse = () => { game.mouseDown = false; };
  window.addEventListener('pointerup', releaseMouse);
  window.addEventListener('pointercancel', releaseMouse);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); game.wheel(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  window.addEventListener('beforeunload', () => game.flush());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
