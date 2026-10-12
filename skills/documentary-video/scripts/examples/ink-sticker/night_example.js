// 墨线贴纸 · 夜景示例（用 night.js + char34.js）：广场夜里，守卫在拱廊下火把旁打瞌睡，另一个人提着灯笼踮脚摸向井边
// 换题材时：换布景和人物造型，夜景的做法（夜色、光池、受光、月光轮廓、纸纹）照搬
// node night_example.js out.png [t]
'use strict';
const fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const C = require('./char34'), NT = require('./night');
const { LW, G, clamp, chaikin, resample, smooth, jit, path, ell, add, rot, limbPoly, renderFigure, buildMan, tc } = C;
const { NIGHT_INK, N, nightOpts, falloff, pool, halo, flame, nightSky, moonDisc, litWindow, paperOverlay } = NT;
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');
const W = 1080, H = 1920, SC = 1.5;

const prep = (p, closed) => resample(p, 6, closed);
const rectP = (x, y, w, h) => prep([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
function shape(ctx, P, col, seed, { sh = null, shOff = [16, 0], w = LW } = {}) {
  const Q = jit(P, seed + 101, 1.5); ctx.fillStyle = col; path(ctx, Q); ctx.fill();
  if (sh) { ctx.save(); path(ctx, Q); ctx.clip(); ctx.fillStyle = sh; ctx.fill(); ctx.fillStyle = col; path(ctx, Q.map(q => [q[0] + shOff[0], q[1] + shOff[1]])); ctx.fill(); ctx.restore(); }
  ctx.strokeStyle = NIGHT_INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; path(ctx, jit(P, seed)); ctx.stroke();
}
const line = (ctx, P, w = LW, col = NIGHT_INK, seed = 0) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; path(ctx, jit(prep(P, false), seed), false); ctx.stroke(); };

// 道具
function bucketParts(grip) { const w = 66, h = 74, top = 84, T_ = v => add(grip, v);
  return [{ name: 'bHandle', P: limbPoly([T_([-w / 2 + 4, top]), T_([0, -2]), T_([w / 2 - 4, top])], [[0, 7], [1, 7]]).poly, col: '#8A6440', seed: 71 },
    { name: 'bucket', P: smooth([[-w / 2, top], [w / 2, top], [w * 0.42, top + h], [-w * 0.42, top + h]].map(T_), true, 1), col: '#C8742F', lit: [10, -4], seed: 72, after: g => { for (const k of [0.25, 0.72]) { const hw = w / 2 - w * 0.08 * k, y = top + h * k; g.fillStyle = tc('#4C4A4F'); path(g, chaikin([[-hw, y - 5], [0, y + 1], [hw, y - 5], [hw, y + 4], [0, y + 10], [-hw, y + 4]].map(T_), true, 1)); g.fill(); } } },
    { name: 'rim', P: ell(0, top, w / 2, 11, 0, 30).map(T_), col: '#7A4A22', seed: 73, over: ['bucket'], ew: 3 }]; }
function lanternParts(hand, t) { const top = add(hand, [0, 14]), w = 40, h = 54;
  const glass = smooth([[top[0] - w / 2, top[1] + 12], [top[0] + w / 2, top[1] + 12], [top[0] + w / 2 - 3, top[1] + 12 + h], [top[0] - w / 2 + 3, top[1] + 12 + h]], true, 1);
  return [{ name: 'lRing', P: limbPoly([add(hand, [-9, 16]), add(hand, [0, -4]), add(hand, [9, 16])], [[0, 5], [1, 5]]).poly, col: '#4C4A4F', seed: 91 },
    { name: 'lGlass', P: glass, col: '#FFD27A', glow: true, seed: 92, after: g => { const c = [top[0], top[1] + 12 + h * 0.62], f = 1 + 0.1 * Math.sin(t * 17); g.fillStyle = '#FFF3C4'; path(g, smooth([[c[0], c[1] - 26 * f], [c[0] + 7, c[1] - 4], [c[0], c[1] + 6], [c[0] - 7, c[1] - 4]], true, 2)); g.fill(); } },
    { name: 'lCap', P: smooth([[top[0] - w / 2 - 4, top[1] + 12], [top[0], top[1] - 4], [top[0] + w / 2 + 4, top[1] + 12]], true, 1), col: '#4C4A4F', seed: 93, over: ['lGlass'], ew: 3 },
    { name: 'lBase', P: smooth([[top[0] - w / 2 - 3, top[1] + 12 + h], [top[0] + w / 2 + 3, top[1] + 12 + h], [top[0] + w / 2, top[1] + 22 + h], [top[0] - w / 2, top[1] + 22 + h]], true, 1), col: '#4C4A4F', seed: 94, over: ['lGlass'], ew: 3 }]; }
const insertBefore = (fig, name, ps) => { const i = fig.parts.findIndex(p => p.name === name); fig.parts.splice(i, 0, ...ps); };

const SNEAK = { thigh: 70, shin: 68, upper: 56, fore: 54, torso: 124, tw: 104, head: 50, foot: 58, skirt: 46, quilt: true, tunic: '#D9C7A0', tunicSh: '#B9A47C', tunicSh2: '#A08B64', hose: '#4E6E8E', hoseSh: '#3B5672', hoseSh2: '#2E445B', hoseF: '#3B5672', hair: '#3A2A24', hairSh: '#271C18', hat: 'kettle', mustache: true };
const GUARD = { thigh: 66, shin: 64, upper: 54, fore: 52, torso: 118, tw: 112, head: 52, foot: 56, skirt: 40, quilt: false, tunic: '#7C93A8', tunicSh: '#5F778D', tunicSh2: '#4C6276', hose: '#8C7A5E', hoseSh: '#6E5E46', hoseSh2: '#574A37', hoseF: '#6E5E46', hair: '#6B4A30', hairSh: '#4E3522', hat: 'coif', coif: '#E8DDC6', coifSh: '#C9BBA0', beard: true };

function frame(ctx, t) {
  G.K = Math.floor(t * 12);
  const MOON = [820, 300], HORIZON = 1262;
  nightSky(ctx, W, HORIZON, t); moonDisc(ctx, ...MOON);
  // 远景：两座塔（一扇亮窗）
  const tower = (x, top, w, lean, seed) => { const c = Math.sin(lean) * (1255 - top); shape(ctx, prep([[x, 1255], [x + c, top], [x + w + c, top], [x + w, 1255]], true), N('#C98F68'), seed, { sh: N('#A9714E'), shOff: [-14, 0] }); shape(ctx, prep([[x + c - 8, top], [x + c - 8, top - 30], [x + w + c + 8, top - 30], [x + w + c + 8, top]], true), N('#B57D58'), seed + 1); };
  tower(250, 300, 74, 0, 11); tower(352, 620, 66, 0.07, 12); litWindow(ctx, 270, 420, 14, 30, { seed: 13 });
  // 中景：拱廊房子，有的窗亮着
  const house = (x, w, top, wall, roofY, seed, arches, lit) => { const b = 1265; shape(ctx, rectP(x, top, w, b - top), N(wall), seed); shape(ctx, prep([[x - 14, top + 6], [x + w * 0.5, roofY], [x + w + 14, top + 6], [x + w + 14, top + 26], [x - 14, top + 26]], true), N('#B8664A'), seed + 1);
    const aw = w / arches; for (let i = 0; i < arches; i++) { const ax = x + i * aw + 10, ay = b - 150; shape(ctx, prep([[ax, b], [ax, ay + 40], ...Array.from({ length: 9 }, (_, k) => { const a = Math.PI + k / 8 * Math.PI; return [ax + (aw - 20) / 2 + Math.cos(a) * (aw - 20) / 2, ay + 40 + Math.sin(a) * 40]; }), [ax + aw - 20, b]], true), '#151A2E', seed + 2 + i);
      const wx = x + i * aw + aw / 2 - 16, wy = top + 70; if (lit.includes(i)) litWindow(ctx, wx, wy, 32, 52, { seed: seed + 5 + i }); else shape(ctx, rectP(wx, wy, 32, 52), '#2A2F4A', seed + 5 + i, { w: 4.5 }); } };
  house(-30, 470, 840, '#E4BE8E', 760, 21, 3, [2]); house(760, 360, 880, '#E9D3A8', 800, 23, 2, [0]); house(-30, 300, 990, '#D9A27A', 930, 22, 2, []); house(900, 220, 1010, '#D29A74', 950, 24, 1, [0]);
  // 地面
  ctx.fillStyle = N('#A39274'); path(ctx, jit(prep([[-40, HORIZON], [1120, HORIZON], [1120, 1960], [-40, 1960]], true), 132, 1.5)); ctx.fill(); line(ctx, [[-40, HORIZON], [1120, HORIZON]], LW, NIGHT_INK, 31);
  for (let k = 0; k < 6; k++) { const y = 1310 + k * k * 22 + k * 40; line(ctx, [[-40, y], [1120, y + (k % 2 ? 6 : -4)]], 3, '#2A2E4A', 32 + k); }

  // 光源：墙上的火把 + 人物手里的灯笼
  const TORCH = [455, 1010], mX = 860, mGY = 1455, mDir = -1;
  const mP = { fN: [30, -6], fF: [-46, 0], heelF: 0.6, hN: [78, -168], hF: [30, -236], lean: 0.2, drop: 12, look: [1, 0.1], brow: -0.6, smile: 0.4, lid: 0.4, elbowPref: [-0.3, 1] };
  const mFig = buildMan(mP, SNEAK), lh = mFig.joints.hN, LANT = [mX + mDir * SC * lh[0], mGY + SC * (lh[1] + 54)];
  pool(ctx, TORCH[0], TORCH[1] + 40, 280, 250, 'rgba(255,150,60,A)'); pool(ctx, TORCH[0] - 40, 1410, 340, 90, 'rgba(255,150,60,A)', [0.10, 0.12, 0.14]);
  pool(ctx, LANT[0], LANT[1] - 40, 300, 300, 'rgba(255,180,90,A)', [0.08, 0.10, 0.12]); pool(ctx, LANT[0] + 10, mGY + 4, 320, 80, 'rgba(255,180,90,A)', [0.12, 0.14, 0.16]);
  shape(ctx, rectP(TORCH[0] - 7, TORCH[1], 14, 70), N('#6B4A36', 0.8), 41, { w: 4.5 }); flame(ctx, TORCH[0], TORCH[1] - 6, 1.25, t, 1);

  // 井 + 钩子上的桶（靠灯笼一侧受光）
  const WX = 660, RIM = 1175, RX = 150, RY = 34, BASE = 1385, PT = 760, kW = falloff([WX, 1200], LANT, 520);
  const wl = (P, col, sh, seed, o = [10, 0]) => shape(ctx, P, N(col, kW * 0.6), seed, { sh: N(sh, kW * 0.3), shOff: o });
  wl(rectP(WX - RX + 12, PT, 22, RIM - PT + 10), '#9A7550', '#77583A', 41); wl(rectP(WX + RX - 34, PT, 22, RIM - PT + 10), '#9A7550', '#77583A', 42);
  wl(prep([[WX - RX - 40, PT - 20], [WX, PT - 120], [WX + RX + 40, PT - 20]], true), '#B8664A', '#96503A', 43); wl(rectP(WX - RX - 6, PT - 24, RX * 2 + 12, 28), '#A8825B', '#84643F', 44);
  wl(prep(ell(WX, RIM, RX, RY, 0, 48), true), '#BDB4A6', '#9C9387', 45); ctx.fillStyle = '#121426'; path(ctx, prep(ell(WX, RIM + 3, RX - 20, RY - 9, 0, 40), true)); ctx.fill();
  shape(ctx, prep(ell(WX, 790, 24, 24, 0, 24), true), N('#8A6440', 0.3), 47); line(ctx, [[WX, 790], [WX, 985]], 4, N('#5A4632', 0.4), 48);
  renderFigure(ctx, WX - 4, 985 + 12 + 240, 1, { parts: bucketParts([0, -160]) }, Object.assign({ scale: SC, ground: false, box: [1200, 1200, 600, 1080] }, nightOpts({ x: WX, gy: 1300, dir: 1, chestH: 160, light: LANT, k: kW, moon: MOON })));
  const wf = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI; wf.push([WX + Math.cos(a) * RX, RIM + Math.sin(a) * RY]); } for (let k = 24; k >= 0; k--) { const a = k / 24 * Math.PI; wf.push([WX + Math.cos(a) * RX, BASE + Math.sin(a) * RY * 0.9]); }
  wl(prep(wf, true), '#C8BFB0', '#A69D8F', 49, [26, 0]); for (let k = 0; k < 3; k++) { const y = RIM + 60 + k * 62; line(ctx, [[WX - RX + 8, y], [WX + RX - 8, y + 4]], 3, '#3A3C55', 50 + k); }

  // 守卫：坐着打瞌睡（睡着的表情 + 点头），被火把照亮
  const bX = 210, bGY = 1395, kB = falloff([bX, 1200], TORCH, 650);
  line(ctx, [[bX - 70, bGY], [bX - 40, bGY - 560]], 13, NIGHT_INK, 61); line(ctx, [[bX - 70, bGY], [bX - 40, bGY - 560]], 7, N('#9A7550', kB), 61);
  shape(ctx, smooth([[bX - 51, bGY - 552], [bX - 36, bGY - 610], [bX - 27, bGY - 548]], true, 1), N('#B6BEC2', kB), 62, { w: 4.5 });
  shape(ctx, rectP(bX - 60, bGY - 80, 120, 18), N('#8A6440', kB), 63); for (const lx of [bX - 50, bX + 38]) shape(ctx, rectP(lx, bGY - 64, 12, 64), N('#77583A', kB), 64 + lx);
  const nod = Math.sin(t * 1.6);
  renderFigure(ctx, bX, bGY, 1, buildMan({ fN: [86, 0], fF: [58, 0], hN: [70, -96], hF: [50, -104], lean: 0.24 + 0.03 * nod, drop: 64, blink: 1, mouth: 0.25 + 0.06 * nod, brow: -0.2, elbowPref: [-0.2, 1] }, GUARD),
    Object.assign({ scale: 1.32 }, nightOpts({ x: bX, gy: bGY, dir: 1, chestH: 300, light: TORCH, k: kB * 0.9, moon: MOON })));
  for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1), zx = bX - 10 - k * 40 + i * 6, zy = bGY - 380 - k * 150, zs = 26 + k * 22; ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * k); ctx.font = `${zs}px YaHeiB`; ctx.lineWidth = 7; ctx.strokeStyle = NIGHT_INK; ctx.strokeText('Z', zx, zy); ctx.fillStyle = '#E8E2D0'; ctx.fillText('Z', zx, zy); ctx.restore(); }

  // 提灯笼的人：脸和身前被灯笼照亮（鬼祟的表情）
  insertBefore(mFig, 'armN', lanternParts(lh, t));
  renderFigure(ctx, mX, mGY, mDir, mFig, Object.assign({ scale: SC }, nightOpts({ x: mX, gy: mGY, dir: mDir, light: LANT, k: 0.8, moon: MOON })));
  halo(ctx, ...LANT);
  paperOverlay(ctx, W, H);
}
const cv = createCanvas(W, H), ctx = cv.getContext('2d'); frame(ctx, +(process.argv[3] || 2.3));
fs.writeFileSync(process.argv[2] || 'night_example.png', cv.toBuffer('image/png'));
