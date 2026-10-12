// 布景 D · 秋天的院子：黄昏 → 夜。院墙、光秃的树、落叶、院门、门边一盏灯笼（全片最后一个暖光源）
'use strict';
const L = require('./lib');
const { C, NT, W, prep, rectP, ink, fillP, solid } = L;
const { clamp, lerp, ell, smooth } = C;
const { N, NIGHT_INK: NI, pool, flame, halo, nightSky, moonDisc } = NT;

const GROUND = 1290, DOOR = { x0: 640, x1: 960, top: 640 }, LANTERN = [590, 760], MOONP = [260, 330];
// night：0 = 黄昏（暖灰），1 = 夜（夜色 + 灯笼）
function col(c, x, y, night, lamp) { if (night <= 0) return dusk(c); const k = lamp * clamp(Math.pow(NT.falloff([x, y], LANTERN, 700), 1.2)); return night >= 1 ? N(c, k) : mixHex(dusk(c), N(c, k), night); }
const hex = c => c.startsWith('rgb') ? c.match(/\d+/g).slice(0, 3).map(Number) : [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };
const dusk = c => { const [r, g, b] = hex(c), m = (r + g + b) / 3; return `rgb(${Math.round(lerp(r, m, 0.45) * 0.86 + 22)},${Math.round(lerp(g, m, 0.45) * 0.8 + 12)},${Math.round(lerp(b, m, 0.45) * 0.78 + 8)})`; };

// 落叶：确定性的轨迹（时间的纯函数）
function leaves(ctx, t, n, night, { x0 = -60, x1 = W + 60, yTop = 300, yBot = GROUND + 120, seed = 1 } = {}) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { const sp = 90 + r() * 80, ph = r() * 20, x0_ = lerp(x0, x1, r()), cyc = (yBot - yTop) / sp, tt = (t + ph) % cyc, y = yTop + tt * sp, x = x0_ + 50 * Math.sin(tt * 2.2 + i) - tt * 30;
    const rot = tt * 3 + i, c = col(['#D98A3A', '#C9A14A', '#B8664A'][i % 3], x, y, night, 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(tt * 3 + i)));
    const P = prep([[-16, 0], [0, -9], [16, 0], [0, 9]], true); fillP(ctx, P, c, 950 + i); ink(ctx, P, 1, { seed: 960 + i, closed: true, w: 3, col: night > 0.5 ? NI : '#3A2E2A' }); ctx.restore(); }
}

function drawYard(ctx, t, { night = 0, lamp = 0, door = 0 } = {}) {
  const ink_ = night > 0.5 ? NI : '#2A2440';
  // 天空：黄昏是暖灰色带，夜里换成夜空
  if (night < 1) { const bands = ['#B9A79A', '#C7AE96', '#D3B48E', '#D9B082']; bands.forEach((c, i) => { const y = -40 + i * 260; const P = [[-60, y]]; for (let x = -60; x <= W + 60; x += 60) P.push([x, y + 14 * Math.sin(x / 150 + i)]); P.push([W + 60, GROUND], [-60, GROUND]); fillP(ctx, prep(P, true), c, 900 + i); }); }
  if (night > 0) { ctx.save(); ctx.globalAlpha = night; ctx.fillStyle = NT.SKY[0]; ctx.fillRect(-400, -400, W + 800, GROUND + 400); ctx.translate(-200, 0); nightSky(ctx, W + 400, GROUND - 200, t, { stars: 34, seed: 9 }); ctx.translate(200, 0); moonDisc(ctx, MOONP[0], MOONP[1], 60, NI); ctx.restore(); }
  // 院墙
  const wall = prep([[-60, 820], [W + 60, 820], [W + 60, GROUND], [-60, GROUND]], true);
  solid(ctx, wall, col('#BDB3A8', 540, 1000, night, lamp), { sh: col('#A69D8F', 540, 1000, night, lamp), seed: 910, ink: ink_, lit: [0, -16], noShadow: true });
  solid(ctx, prep([[-60, 790], [W + 60, 790], [W + 60, 840], [-60, 840]], true), col('#5B6470', 540, 810, night, lamp), { seed: 911, ink: ink_ });
  // 院门（门楼 + 两扇门）
  solid(ctx, prep([[DOOR.x0 - 70, DOOR.top - 10], [DOOR.x0 + 20, DOOR.top - 120], [DOOR.x1 - 20, DOOR.top - 120], [DOOR.x1 + 70, DOOR.top - 10]], true), col('#5B6470', 800, 560, night, lamp), { sh: col('#48505B', 800, 560, night, lamp), seed: 912, ink: ink_ });
  for (const x of [DOOR.x0 - 30, DOOR.x1]) solid(ctx, rectP(x, DOOR.top, 30, GROUND - DOOR.top), col('#7A5640', x, 960, night, lamp), { seed: 913 + x % 3, ink: ink_ });
  const mid = (DOOR.x0 + DOOR.x1) / 2;
  for (const [a, b] of [[DOOR.x0, mid], [mid, DOOR.x1]]) { const P = rectP(a, DOOR.top, b - a, GROUND - DOOR.top); solid(ctx, P, col('#9A7550', (a + b) / 2, 960, night, lamp), { sh: col('#7A5A3C', (a + b) / 2, 960, night, lamp), seed: 915 + a % 5, ink: ink_, noShadow: true });
    for (let k = 0; k < 3; k++) ink(ctx, prep([[a + 10, DOOR.top + 140 + k * 200], [b - 10, DOOR.top + 140 + k * 200]], false), 1, { seed: 918 + k, w: 3, col: ink_ }); }
  // 树：光秃的枝，挂着几片叶子
  const sway = 0.015 * Math.sin(t * 1.1);
  const br = (pts, w, s) => solid(ctx, C.limbPoly(pts.map(([x, y]) => [x + (GROUND - y) * sway, y]), [[0, w], [1, w * 0.4]]).poly, col('#5E412F', 200, 700, night, lamp), { seed: s, ink: ink_, noShadow: true });
  br([[230, GROUND + 10], [250, 900], [210, 600], [180, 380]], 60, 930); br([[240, 820], [380, 640], [470, 520]], 26, 931); br([[215, 650], [90, 500], [40, 420]], 22, 932); br([[200, 520], [300, 380], [320, 300]], 14, 933); br([[380, 640], [420, 720], [520, 760]], 12, 934);
  // 地面 + 落叶堆
  fillP(ctx, rectP(-60, GROUND, W + 120, 900), col('#A89A80', 540, 1400, night, lamp), 940); ink(ctx, prep([[-60, GROUND], [W + 60, GROUND]], false), 1, { seed: 941, col: ink_ });
  for (let i = 0; i < 26; i++) { const x = (i * 97) % (W + 100) - 40, y = GROUND + 20 + (i * 53) % 180; const P = prep([[x - 16, y], [x, y - 7], [x + 16, y], [x, y + 7]], true); fillP(ctx, P, col(['#D98A3A', '#C9A14A', '#B8664A'][i % 3], x, y, night, lamp), 942 + i); ink(ctx, P, 1, { seed: 970 + i, closed: true, w: 2.5, col: ink_ }); }
  // 灯笼：挂在门边，夜里点亮
  const lx = LANTERN[0] + 8 * Math.sin(t * 1.4), ly = LANTERN[1];
  ink(ctx, prep([[LANTERN[0], DOOR.top - 40], [lx, ly - 70]], false), 1, { seed: 980, w: 3, col: ink_ });
  if (lamp > 0) pool(ctx, lx, ly + 360, 420, 160, 'rgba(255,170,80,A)', [0.08 * lamp, 0.1 * lamp, 0.12 * lamp], 981);
  const body = prep(ell(lx, ly, 52, 70, 0, 28), true); solid(ctx, body, lamp > 0 ? '#F3C46A' : col('#E8DDC6', lx, ly, night, lamp), { seed: 982, ink: ink_ });
  for (const dx of [-0.5, 0, 0.5]) ink(ctx, prep([[lx + dx * 52, ly - 66], [lx + dx * 62, ly], [lx + dx * 52, ly + 66]], false), 1, { seed: 983, w: 3, col: ink_ });
  solid(ctx, rectP(lx - 30, ly - 84, 60, 16), col('#3A2C2A', lx, ly, night, lamp), { seed: 984, ink: ink_, noShadow: true }); solid(ctx, rectP(lx - 30, ly + 66, 60, 16), col('#3A2C2A', lx, ly, night, lamp), { seed: 985, ink: ink_, noShadow: true });
  if (lamp > 0) halo(ctx, lx, ly, 150);
}
const LIGHT = LANTERN, MOON = MOONP;
module.exports = { GROUND, DOOR, LANTERN, LIGHT, MOON, drawYard, leaves, col };
