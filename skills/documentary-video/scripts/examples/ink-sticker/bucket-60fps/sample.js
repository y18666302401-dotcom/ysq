// 第 04 期样片（10 秒，无旁白）：博洛尼亚广场，摩德纳士兵从井上偷走木桶 → 守卫发现 → 追出画面 → 空钩子还在晃
// 墨线贴纸 · 人物 v2（3/4 侧身 + 整体轮廓），抖线 12 次/秒，人物动作逐帧平滑
// node sample.js still 4.2 out.png | stills 1,3,4.2,5.4,6.2,7,8.5,9.6 sheet.png | events | video 30 out.mp4 | video 60 out.mp4
'use strict';
const fs = require('fs'), PATH = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const C = require('../char34');
const { INK, PAPER, LW, G, clamp, lerp, sm, vn, chaikin, resample, smooth, jit, path, ell, add, rot, limbPoly, taper, renderFigure, buildMan } = C;
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');

const W = 1080, H = 1920, DUR = 10, SC = 1.5, GY = 1455;
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = k => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function keys(ks) { return t => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t < ks[i][0]) { const [t0, a] = ks[i - 1], [t1, b, e] = ks[i]; const u = (t - t0) / (t1 - t0); const f = e === 'lin' ? u : e === 'out' ? eo(u) : e === 'back' ? backOut(u) : eio(u); return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], f)) : lerp(a, b, f); } return ks[ks.length - 1][1]; }; }

// ---------- 线条工具（与 ink-sticker 相同的抖线 / 错位上色 / 画线进度） ----------
function ink(ctx, P, prog = 1, { w = LW, col = INK, closed = false, seed = 0 } = {}) {
  if (prog <= 0) return; const Q = jit(P, seed); const n = Math.max(2, Math.floor(Q.length * clamp(prog)));
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; path(ctx, Q.slice(0, n), closed && prog >= 1); ctx.stroke();
  if (prog < 1) { const e = Q[n - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e[0], e[1], w, 0, Math.PI * 2); ctx.fill(); }
}
function fillP(ctx, P, col, seed = 0, dx = 0, dy = 0) { const Q = jit(P, seed + 101, 1.5).map(p => [p[0] + dx, p[1] + dy]); ctx.fillStyle = col; path(ctx, Q, true); ctx.fill(); }
const prep = (p, closed) => resample(p, 6, closed);
const rectP = (x, y, w, h) => prep([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
const PAPER_TEX = (() => { const c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = PAPER; x.fillRect(0, 0, W, H); let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 380; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 160; const g = x.createRadialGradient(px, py, 0, px, py, rr); const dk = r() < .5; g.addColorStop(0, dk ? 'rgba(150,120,90,0.035)' : 'rgba(255,252,240,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(110,90,70,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); } return c; })();

// ---------- 时间表 ----------
const T = { draw: 0, fill0: 0.55, fill1: 1.35, bucketPop: 1.15, sneak0: 1.4, sneak1: 3.4, reach0: 3.55, grab: 3.95, proud0: 4.3, proud1: 4.75,
  b0: 4.15, b1: 5.15, see: 5.25, jumpUp: 5.36, land: 5.62, mJolt: 5.42, freeze0: 5.66, run: 6.0, mOut: 7.3, bRun: 6.25, bOut: 8.0 };

// ---------- 场景：博洛尼亚广场（双塔 + 拱廊 + 石井） ----------
const WELL = { x: 660, rimY: 1175, rx: 150, ry: 34, baseY: 1385, postTop: 760 };
const PULLEY = [WELL.x, 790], ROPE_L = 195;   // 钩子在 y≈985
function sceneObjects() {
  const O = [];
  const add_ = (t0, lines, fills, opt = {}) => O.push(Object.assign({ t0, lines, fills }, opt));
  // 天空淡蓝一块（不描边）
  add_(0, [], [[prep([[-40, -40], [1120, -40], [1120, 1260], [-40, 1260]], true), '#DCE5E2']], { noLine: true });
  // 双塔：阿西内利（高、直）+ 加里森达（矮、斜）
  const tower = (x, top, w, lean, seed) => { const b = 1255, c = Math.sin(lean) * (b - top); const body = prep([[x, b], [x + c, top], [x + w + c, top], [x + w, b]], true);
    const crown = prep([[x + c - 8, top], [x + c - 8, top - 30], [x + w + c + 8, top - 30], [x + w + c + 8, top]], true);
    const lines = [[body, true], [crown, true]]; for (let k = 0; k < 7; k++) { const yy = top + 80 + k * (b - top - 120) / 7, xx = x + c * (b - yy) / (b - top) + w * (k % 2 ? 0.62 : 0.3); lines.push([[[xx, yy], [xx, yy + 24]], false, 4]); }
    return { lines, fills: [[body, '#C98F68', '#A9714E'], [crown, '#B57D58']], seed }; };
  const ta = tower(250, 300, 74, 0, 11), tg = tower(352, 620, 66, 0.07, 12);
  add_(0.0, ta.lines, ta.fills, { seed: 11 }); add_(0.12, tg.lines, tg.fills, { seed: 12 });
  // 左右两排带拱廊的房子
  const house = (x, w, top, wall, roofY, seed, arches) => { const b = 1265; const body = rectP(x, top, w, b - top); const roof = prep([[x - 14, top + 6], [x + w * 0.5, roofY], [x + w + 14, top + 6]], false);
    const roofF = prep([[x - 14, top + 6], [x + w * 0.5, roofY], [x + w + 14, top + 6], [x + w + 14, top + 26], [x - 14, top + 26]], true);
    const lines = [[body, true], [roof, false]], fills = [[body, wall, null], [roofF, '#B8664A', null]];
    const aw = w / arches; for (let i = 0; i < arches; i++) { const ax = x + i * aw + 10, ay = b - 150; const arch = prep([[ax, b], [ax, ay + 40], ...Array.from({ length: 9 }, (_, k) => { const a = Math.PI + k / 8 * Math.PI; return [ax + (aw - 20) / 2 + Math.cos(a) * (aw - 20) / 2, ay + 40 + Math.sin(a) * 40]; }), [ax + aw - 20, b]], false);
      lines.push([arch, false]); fills.push([prep(arch.concat([[ax, b]]), true), '#7E6255', null]); }
    for (let i = 0; i < arches; i++) { const wx = x + i * aw + aw / 2 - 16, wy = top + 70; const win = rectP(wx, wy, 32, 52); lines.push([win, true, 4.5]); fills.push([win, '#5E6E7A', null]); }
    return { lines, fills, seed }; };
  const hl = house(-30, 470, 840, '#E4BE8E', 760, 21, 3), hl2 = house(-30, 300, 990, '#D9A27A', 930, 22, 2), hr = house(760, 360, 880, '#E9D3A8', 800, 23, 2), hr2 = house(900, 220, 1010, '#D29A74', 950, 24, 1);
  add_(0.22, hl.lines, hl.fills, { seed: 21 }); add_(0.32, hr.lines, hr.fills, { seed: 23 }); add_(0.4, hl2.lines, hl2.fills, { seed: 22 }); add_(0.46, hr2.lines, hr2.fills, { seed: 24 });
  // 石板地
  const ground = prep([[-40, 1262], [1120, 1262], [1120, 1960], [-40, 1960]], true);
  const glines = [[prep([[-40, 1262], [1120, 1262]], false), false]];
  for (let k = 0; k < 6; k++) { const y = 1310 + k * k * 22 + k * 40; glines.push([prep([[-40, y], [1120, y + (k % 2 ? 6 : -4)]], false), false, 3]); }
  add_(0.3, glines.map(l => [l[0], l[1], l[2] || 5]), [[ground, '#D9C8A5', null]], { seed: 31, ground: true });
  return O;
}
const OBJ = sceneObjects();
// 石井：后沿（井口深色）→ [吊着的桶] → 前壁；木架 + 滑轮
function wellBack() { const w = WELL; return { rim: prep(ell(w.x, w.rimY, w.rx, w.ry, 0, 48), true), hole: prep(ell(w.x, w.rimY + 3, w.rx - 20, w.ry - 9, 0, 40), true),
  postL: rectP(w.x - w.rx + 12, w.postTop, 22, w.rimY - w.postTop + 10), postR: rectP(w.x + w.rx - 34, w.postTop, 22, w.rimY - w.postTop + 10), beam: rectP(w.x - w.rx - 6, w.postTop - 24, w.rx * 2 + 12, 28),
  roof: prep([[w.x - w.rx - 40, w.postTop - 20], [w.x, w.postTop - 120], [w.x + w.rx + 40, w.postTop - 20]], true) }; }
function wellFront() { const w = WELL; const P = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI; P.push([w.x + Math.cos(a) * w.rx, w.rimY + Math.sin(a) * w.ry]); }
  for (let k = 24; k >= 0; k--) { const a = k / 24 * Math.PI; P.push([w.x + Math.cos(a) * w.rx, w.baseY + Math.sin(a) * w.ry * 0.9]); } return prep(P, true); }

function drawObj(ctx, o, t) {
  const lp = clamp((t - o.t0) / 0.7), fk = o.noLine ? 1 : clamp((t - T.fill0 - o.t0 * 0.6) / 0.5);
  for (const [P, col, shade] of o.fills) { if (fk <= 0) break; ctx.save(); if (fk < 1) { ctx.beginPath(); const Y = 1300 - 1500 * eio(fk); ctx.moveTo(-60, 2000); for (let x = -60; x <= W + 60; x += 40) ctx.lineTo(x, Y + 26 * Math.sin(x / 70 + fk * 6)); ctx.lineTo(W + 60, 2000); ctx.closePath(); ctx.clip(); }
    fillP(ctx, P, col, o.seed || 0); if (shade) { ctx.save(); path(ctx, P); ctx.clip(); fillP(ctx, P, shade, (o.seed || 0) + 3, 0, 0); fillP(ctx, P, col, (o.seed || 0) + 3, 16, 0); ctx.restore(); } ctx.restore(); }
  if (!o.noLine) for (const [P, closed, w] of o.lines) ink(ctx, P, lp, { closed, seed: o.seed || 0, w: w || LW });
}

// ---------- 道具：木桶（本期唯一的饱和色）、长矛 ----------
// 局部坐标：抓握点为原点，hang = 握着提手、桶在下面；ang = 摆动角
function bucketParts(grip, ang = 0, seed = 0) {
  const w = 66, h = 74, top = 84, T_ = v => add(grip, rot(v, ang));
  const body = smooth([[-w / 2, top], [w / 2, top], [w * 0.42, top + h], [-w * 0.42, top + h]].map(T_), true, 1);
  const rim = ell(0, top, w / 2, 11, 0, 30).map(T_);
  const handle = limbPoly([T_([-w / 2 + 4, top]), T_([0, -2]), T_([w / 2 - 4, top])], [[0, 7], [1, 7]]);
  return [
    { name: 'bHandle', P: handle.poly, col: '#8A6440', seed: 71 + seed },
    { name: 'bucket', P: body, col: '#C8742F', sh: '#9E5420', lit: [10, -4], seed: 72 + seed, after: g => {
      for (const k of [0.25, 0.72]) { const hw = w / 2 - w * 0.08 * k, y = top + h * k; const band = [[-hw, y - 5], [0, y + 1], [hw, y - 5], [hw, y + 4], [0, y + 10], [-hw, y + 4]].map(T_); g.fillStyle = '#4C4A4F'; path(g, chaikin(band, true, 1)); g.fill(); }
      for (const k of [-0.22, 0.08, 0.32]) taper(g, [T_([k * w, top + 10]), T_([k * w * 0.9, top + h - 6])], 2.2, '#9E5420', { seed: 9 }); } },
    { name: 'rim', P: rim, col: '#7A4A22', seed: 73 + seed, over: ['bucket'], ew: 3, after: g => { g.fillStyle = '#5C3618'; path(g, ell(0, top + 2, w / 2 - 7, 6.5, 0, 24).map(T_)); g.fill(); } },
  ];
}
function spearParts(hand, ang = 0) { const a = add(hand, rot([0, 200], ang)), b = add(hand, rot([0, -330], ang)); const L = limbPoly([a, hand, b], [[0, 9], [1, 8]]);
  const tip = smooth([add(b, rot([-11, 6], ang)), add(b, rot([0, -52], ang)), add(b, rot([11, 6], ang))], true, 1);
  return [{ name: 'shaft', P: L.poly, col: '#9A7550', sh: '#77583A', lit: [3, 0], seed: 81 }, { name: 'tip', P: tip, col: '#B6BEC2', sh: '#80898E', lit: [4, -2], seed: 82, over: ['shaft'], ew: 2.6 }];
}
const insertBefore = (fig, name, ps) => { const i = fig.parts.findIndex(p => p.name === name); fig.parts.splice(i, 0, ...ps); };

// ---------- 人物造型（同测试图） ----------
const MODENA = { thigh: 70, shin: 68, upper: 56, fore: 54, torso: 124, tw: 104, head: 50, foot: 58, skirt: 46, quilt: true,
  tunic: '#D9C7A0', tunicSh: '#B9A47C', tunicSh2: '#A08B64', hose: '#4E6E8E', hoseSh: '#3B5672', hoseSh2: '#2E445B', hoseF: '#3B5672', hair: '#3A2A24', hairSh: '#271C18', hat: 'kettle', mustache: true };
const BOLOGNA = { thigh: 66, shin: 64, upper: 54, fore: 52, torso: 118, tw: 112, head: 52, foot: 56, skirt: 40, quilt: false,
  tunic: '#7C93A8', tunicSh: '#5F778D', tunicSh2: '#4C6276', hose: '#8C7A5E', hoseSh: '#6E5E46', hoseSh2: '#574A37', hoseF: '#6E5E46', hair: '#6B4A30', hairSh: '#4E3522', hat: 'coif', coif: '#E8DDC6', coifSh: '#C9BBA0', beard: true,
  emblem: (g, R, tw, T_) => { const c = R([0.05 * tw, -T_ * 0.68]); g.fillStyle = '#EFE6D6'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(c[0] - 20, c[1] - 22); g.lineTo(c[0] + 20, c[1] - 22); g.lineTo(c[0] + 18, c[1] + 6); g.quadraticCurveTo(c[0], c[1] + 26, c[0] - 18, c[1] + 6); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#B5655A'; g.fillRect(c[0] - 3.5, c[1] - 20, 7, 38); g.fillRect(c[0] - 18, c[1] - 9, 36, 7); } };

// ---------- 步态（支撑脚钉在地上，摆动脚划弧） ----------
function gait(t, xFn, t0, period, offset, lead, lift) {
  const u0 = (t - t0) / period + offset, n = Math.floor(u0), u = u0 - n;
  const plant = m => { const tm = t0 + (m - offset + 0.25) * period; return xFn(Math.max(t0, tm)) + lead; };
  if (u < 0.5) return [plant(n), 0];
  const s = (u - 0.5) / 0.5; return [lerp(plant(n), plant(n + 1), eio(s)), -lift * Math.sin(Math.PI * s)];
}
const stepTimes = (t0, t1, period, offsets) => { const out = []; for (const o of offsets) for (let m = 1; ; m++) { const tt = t0 + (m - o) * period; if (tt > t1) break; if (tt > t0 + 0.05) out.push(+tt.toFixed(3)); } return out.sort((a, b) => a - b); };
const toLocal = (wx, wy, x, gy, dir) => [(wx - x) * dir / SC, (wy - gy) / SC];

// 摩德纳士兵 M
const mX = t => t < T.sneak1 ? lerp(-260, 560, sm((t - T.sneak0) / (T.sneak1 - T.sneak0)) * 0.25 + 0.75 * clamp((t - T.sneak0) / (T.sneak1 - T.sneak0))) :
  t < T.run ? 560 : lerp(560, -380, (u => u < 0.25 ? 2 * u * u : u - 0.125)((t - T.run) / (T.mOut - T.run)) / 0.875);
const SNEAK_P = 0.66, RUN_P = 0.34, BWALK_P = 0.5, BRUN_P = 0.32;
const bX = t => t < T.b1 ? lerp(1320, 930, clamp((t - T.b0) / (T.b1 - T.b0))) : t < T.bRun ? 930 : lerp(930, -380, (u => u < 0.25 ? 2 * u * u : u - 0.125)((t - T.bRun) / (T.bOut - T.bRun)) / 0.875);

function hookPos(t) { const k = t - T.grab; const th = t < T.grab ? 0.025 * Math.sin(t * 2.2) : 0.32 * Math.exp(-k * 0.5) * Math.sin(2 * Math.PI * k / 1.25 + 0.4) + 0.025 * Math.exp(-k * 2) ;
  return add(PULLEY, rot([0, ROPE_L], -th)); }

function mPose(t) {
  const dir = t < T.run ? 1 : -1, x = mX(t), S = MODENA; let P = { look: [1, 0], mouth: 0, brow: 0, blink: 0, lean: 0.04 }, sx = 1, sy = 1, oy = 0, holding = t >= T.grab;
  const blink = (t0) => (t > t0 && t < t0 + 0.12 ? 1 : 0);
  if (t < T.sneak1 + 0.12) { // 踮脚偷偷走：高抬腿、两只手像爪子、左右张望
    const f = o => gait(t, mX, T.sneak0, SNEAK_P, o, 14, 48); const fN = f(0), fF = f(0.5); const ph = (t - T.sneak0) / SNEAK_P * Math.PI * 2;
    P = { fN: toLocal(fN[0], GY + fN[1], x, GY, 1), fF: toLocal(fF[0], GY + fF[1], x, GY, 1), heelN: fN[1] < 0 ? 0 : 0.6, heelF: fF[1] < 0 ? 0 : 0.6,
      hN: [46, -214 + 8 * Math.sin(ph)], hF: [30, -222 + 8 * Math.cos(ph)], lean: 0.16, drop: 10 + 6 * Math.abs(Math.sin(ph)),
      look: Math.sin(t * 2.6) > 0 ? [1, -0.1] : [-0.8, -0.1], mouth: 0, brow: -0.6, blink: blink(2.3), elbowPref: [-0.2, 1] };
    oy = -6 * Math.abs(Math.sin(ph));
  } else if (t < T.grab) { // 伸手去够钩子上的桶
    const k = eio((t - T.reach0) / (T.grab - T.reach0)), hk = hookPos(t), tgt = toLocal(hk[0] - 4, hk[1] + 12, x, GY, 1);
    P = { fN: [34, 0], fF: [-30, 0], heelF: 0.3 * k, hN: [lerp(46, tgt[0], k), lerp(-214, tgt[1], k)], hF: [lerp(30, -40, k), lerp(-222, -150, k)], lean: lerp(0.1, -0.06, k), drop: lerp(8, -4, k),
      look: [0.6, -0.8], mouth: 0.15, brow: 0.5, elbowPref: [-0.6, 1] };
  } else if (t < T.mJolt) { // 抓到了：拉到胸前 → 得意地举到肩高、看镜头
    const k1 = eio((t - T.grab) / (T.proud0 - T.grab)), k2 = backOut((t - T.proud0) / (T.proud1 - T.proud0)), hk = toLocal(...add(hookPos(T.grab), [-4, 12]), x, GY, 1);
    const chest = [66, -200], proud = [84, -262];
    const h = t < T.proud0 ? [lerp(hk[0], chest[0], k1), lerp(hk[1], chest[1], k1)] : [lerp(chest[0], proud[0], k2), lerp(chest[1], proud[1], k2)];
    P = { fN: [34, 0], fF: [-30, 0], hN: h, hF: [-34, -150], lean: t < T.proud0 ? 0 : lerp(0, -0.08, k2), drop: 0, look: t < T.proud0 + 0.1 ? [0.6, 0.3] : [0.15, 0.05], mouth: t < T.proud0 ? 0.25 : 0.55, brow: 1, blink: blink(4.55), elbowPref: [-0.5, 1] };
  } else if (t < T.run) { // 被发现：一哆嗦，定住
    const j = Math.exp(-(t - T.mJolt) * 9) * Math.sin((t - T.mJolt) * 30);
    P = { fN: [34, 0], fF: [-30, 0], hN: [84, -262 + 10 * j], hF: [-30, -175], lean: -0.1, drop: 0, look: [1, -0.05], mouth: 0.7, brow: 1.6, elbowPref: [-0.5, 1] };
    oy = t < T.mJolt + 0.22 ? -34 * Math.sin(Math.PI * (t - T.mJolt) / 0.22) : 0; if (t < T.mJolt + 0.22) { sy = 1.08; sx = 0.94; }
  } else { // 转身就跑，桶举在前面晃
    const f = o => gait(t, mX, T.run, RUN_P, o, -20, 56); const fN = f(0), fF = f(0.5), ph = (t - T.run) / RUN_P * Math.PI * 2;
    P = { fN: toLocal(fN[0], GY + fN[1], x, GY, -1), fF: toLocal(fF[0], GY + fF[1], x, GY, -1), heelN: fN[1] < 0 ? 0.4 : 0, heelF: fF[1] < 0 ? 0.4 : 0,
      hN: [80, -250 + 10 * Math.sin(ph)], hF: [-60 - 30 * Math.sin(ph), -190], lean: 0.22, drop: 14 + 8 * Math.abs(Math.sin(ph)), look: [1, -0.1], mouth: 0.6, brow: 1.2, elbowPref: [-0.4, 1] };
    oy = -10 * Math.abs(Math.sin(ph)); const k = (t - T.run) / 0.24; if (k < 1) { const s = backOut(k); sx = lerp(0.75, 1, s); sy = lerp(1.18, 1, s); }
  }
  return { x, dir, P, S, sx, sy, oy, holding };
}
function bPose(t) {
  const x = bX(t), S = BOLOGNA; let P, sx = 1, sy = 1, oy = 0, dir = -1, fx = null;
  if (t < T.b1 + 0.1) { const f = o => gait(t, bX, T.b0, BWALK_P, o, -10, 26); const fN = f(0), fF = f(0.5), ph = (t - T.b0) / BWALK_P * Math.PI * 2;
    P = { fN: toLocal(fN[0], GY + fN[1], x, GY, -1), fF: toLocal(fF[0], GY + fF[1], x, GY, -1), hN: [48, -208], hF: [-30 * Math.sin(ph) - 6, -150], lean: 0.02, look: [0.6, 0.15], mouth: 0, brow: 0, elbowPref: [-0.6, 1], spear: 0 };
  } else if (t < T.bRun) {
    const crouch = t >= T.see && t < T.jumpUp, air = t >= T.jumpUp && t < T.land;
    const ja = air ? Math.sin(Math.PI * (t - T.jumpUp) / (T.land - T.jumpUp)) : 0; oy = -80 * ja;
    if (crouch) { sy = 0.9; sx = 1.08; } else if (air) { sy = 1.1; sx = 0.93; } else if (t >= T.land && t < T.land + 0.12) { sy = 0.92; sx = 1.06; }
    const shock = t >= T.see;
    P = { fN: [24, air ? -10 : 0], fF: [-28, air ? -18 : 0], hN: shock ? [52, -236] : [48, -208], hF: shock ? [70, -258] : [-6, -150], lean: shock ? -0.08 : 0.02, drop: crouch ? 22 : 0,
      look: [1, 0.05], mouth: shock ? 0.9 : 0, brow: shock ? 1.8 : 0, elbowPref: [-0.6, 1], spear: shock ? -0.12 : 0 };
  } else { const f = o => gait(t, bX, T.bRun, BRUN_P, o, -20, 54); const fN = f(0), fF = f(0.5), ph = (t - T.bRun) / BRUN_P * Math.PI * 2;
    P = { fN: toLocal(fN[0], GY + fN[1], x, GY, -1), fF: toLocal(fF[0], GY + fF[1], x, GY, -1), heelN: fN[1] < 0 ? 0.4 : 0, heelF: fF[1] < 0 ? 0.4 : 0,
      hN: [62, -226], hF: [-50 - 34 * Math.sin(ph), -190], lean: 0.22, drop: 14 + 8 * Math.abs(Math.sin(ph)), look: [1, 0], mouth: 0.8 + 0.2 * Math.sin(t * 20), brow: -1.4, elbowPref: [-0.5, 1], spear: 0.28 };
    oy = -10 * Math.abs(Math.sin(ph)); }
  return { x, dir, P, S, sx, sy, oy };
}

// ---------- 桶的摆动：按 M 手的世界坐标做阻尼摆（预先积分） ----------
const SWING = (() => { const dt = 1 / 480, N = Math.ceil(DUR / dt) + 2, out = new Float32Array(N); let th = 0, w = 0, px = null, pvx = 0;
  for (let i = 0; i < N; i++) { const t = i * dt; if (t < T.grab) { out[i] = 0; continue; }
    const m = mPose(t), fig = buildMan(m.P, m.S), hx = m.x + m.dir * SC * m.sx * fig.joints.hN[0];
    const vx = px == null ? 0 : (hx - px) / dt, ax = (vx - pvx) / dt; px = hx; pvx = vx;
    const L = 130, acc = -(9.8 * 520 / L) * Math.sin(th) - clamp(ax, -40000, 40000) / L * Math.cos(th) * 0.9 - 3.2 * w; w += acc * dt; th += w * dt; out[i] = th; }
  return t => out[Math.min(out.length - 1, Math.max(0, Math.round(t / dt)))]; })();

// ---------- 特效 ----------
function burst(ctx, x, y, t, t0, { n = 8, r0 = 70, len = 46, dur = 0.4, w = 6 } = {}) { const k = (t - t0) / dur; if (k <= 0 || k >= 1) return;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.36, r = r0 + 60 * eo(k), l = len * (1 - k); ctx.strokeStyle = INK; ctx.lineWidth = w * (1 - k * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * (r + l), y + Math.sin(a) * (r + l)); ctx.stroke(); } }
function bang(ctx, x, y, t, t0, t1) { if (t < t0 || t > t1) return; const s = backOut((t - t0) / 0.25) * (t > t1 - 0.12 ? (t1 - t) / 0.12 : 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(0.12);
  const bar = prep([[-12, -70], [12, -70], [7, 8], [-7, 8]], true); fillP(ctx, bar, '#E8A33D', 5); ink(ctx, bar, 1, { closed: true, seed: 5, w: 5 });
  const dot = prep(ell(0, 32, 12, 12, 0, 18), true); fillP(ctx, dot, '#E8A33D', 6); ink(ctx, dot, 1, { closed: true, seed: 6, w: 5 }); ctx.restore(); }
function puff(ctx, x, y, t, t0, dir = 1, n = 5) { const k = (t - t0) / 0.9; if (k <= 0 || k >= 1) return; const a = 1 - k;
  const list = Array.from({ length: n }, (_, i) => ({ x: x - dir * (i * 26 + 60 * eo(k) * (1 + i * 0.3)), y: y - 18 - i * 6 - 30 * eo(k) * (i % 2 ? 1 : 0.5), r: (16 + i * 5) * (0.6 + 0.8 * eo(k)) * (k > 0.6 ? (1 - k) / 0.4 : 1) }));
  ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = INK; for (const b of list) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r + LW, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#E9DFCC'; for (const b of list) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); } ctx.fillStyle = '#F6F0E4'; for (const b of list) { ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.45, 0, 7); ctx.fill(); } ctx.restore(); }
function sweat(ctx, x, y, t, t0, t1) { if (t < t0 || t > t1) return; const k = (t - t0) / (t1 - t0), yy = y + 30 * k; const P = prep([[x, yy - 18], [x + 10, yy], [x, yy + 10], [x - 10, yy]], true);
  fillP(ctx, chaikin(P, true, 2), '#A9C8DE', 8); ink(ctx, chaikin(P, true, 2), 1, { closed: true, seed: 8, w: 3.5 }); }

// ---------- 一帧 ----------
function drawFigure(ctx, m, extra) { const fig = buildMan(m.P, m.S); if (extra) extra(fig); fig.groundX = m.x; fig.groundY = GY + 6; fig.groundK = clamp(1 + m.oy / 200, 0.5, 1);
  renderFigure(ctx, m.x, GY + m.oy, m.dir, fig, { scale: SC, sx: m.sx, sy: m.sy }); return fig; }
const headW = (m, fig) => [m.x + m.dir * SC * m.sx * fig.joints.hc[0], GY + m.oy + SC * m.sy * fig.joints.hc[1]];
function frame(ctx, t) {
  G.K = Math.floor(t * 12 + 1e-6);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PAPER_TEX, 0, 0);
  for (const o of OBJ) drawObj(ctx, o, t);
  // 井：后沿 + 木架
  const wb = wellBack(), wt = 0.62, lp = clamp((t - wt) / 0.6), fk = clamp((t - T.fill0 - 0.35) / 0.5);
  const solid = (P, col, sh, seed, closed = true) => { if (fk > 0) { ctx.save(); ctx.globalAlpha = fk; fillP(ctx, P, col, seed); if (sh) { ctx.save(); path(ctx, P); ctx.clip(); fillP(ctx, P, sh, seed); fillP(ctx, P, col, seed, 9, -4); ctx.restore(); } ctx.restore(); } ink(ctx, P, lp, { closed, seed }); };
  solid(wb.postL, '#9A7550', '#77583A', 41); solid(wb.postR, '#9A7550', '#77583A', 42); solid(wb.roof, '#B8664A', '#96503A', 43); solid(wb.beam, '#A8825B', '#84643F', 44);
  solid(wb.rim, '#BDB4A6', '#9C9387', 45); if (fk > 0) fillP(ctx, wb.hole, '#3E3838', 46);
  // 滑轮 + 绳子 + 钩子
  const hk = hookPos(t);
  if (lp > 0.5) { const pul = prep(ell(PULLEY[0], PULLEY[1], 24, 24, 0, 24), true); fillP(ctx, pul, '#8A6440', 47); ink(ctx, pul, 1, { closed: true, seed: 47 }); ink(ctx, prep([PULLEY, hk], false), 1, { seed: 48, w: 4, col: '#5A4632' });
    ctx.save(); ctx.translate(hk[0], hk[1]); ctx.strokeStyle = '#4C4A4F'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.arc(-8, 10, 8, 0, Math.PI * 0.9); ctx.stroke(); ctx.restore(); }
  // 钩子上的桶（被偷之前）：弹出来出场
  if (t < T.grab && t >= T.bucketPop) { const s = backOut((t - T.bucketPop) / 0.4); const grip = [0, 0], ang = Math.atan2(hk[0] - PULLEY[0], hk[1] - PULLEY[1]) * -1;
    renderFigure(ctx, hk[0] - 4, hk[1] + 12 + 240, 1, { parts: bucketParts([0, -160], ang) }, { scale: SC, sx: lerp(1.5, 1, s), sy: s, ground: false }); }
  // 井的前壁
  const wf = wellFront(); solid(wf, '#C8BFB0', '#A69D8F', 49);
  if (fk > 0.5) for (let k = 0; k < 3; k++) { const y = WELL.rimY + 60 + k * 62; ink(ctx, prep([[WELL.x - WELL.rx + 8, y], [WELL.x + WELL.rx - 8, y + 4]], false), 1, { seed: 50 + k, w: 3.5, col: '#7E766B' });
    for (let j = 0; j < 4; j++) { const xx = WELL.x - WELL.rx + 40 + j * 72 + (k % 2) * 36; ink(ctx, prep([[xx, y], [xx, y + 58]], false), 1, { seed: 54 + j + k, w: 3, col: '#7E766B' }); } }
  // 人物：B 在后（右），M 在前
  if (t >= T.b0 && t < T.bOut + 0.2) { const b = bPose(t); const fig = drawFigure(ctx, b, fig => insertBefore(fig, 'armN', spearParts(fig.joints.hN, b.P.spear || 0)));
    const hw = headW(b, fig); burst(ctx, hw[0], hw[1] - 20, t, T.jumpUp, 0.42); bang(ctx, hw[0] + 70, hw[1] - 170, t, T.jumpUp, T.bRun + 0.1); }
  if (t >= T.sneak0 - 0.05 && t < T.mOut + 0.2) { const m = mPose(t); const fig = drawFigure(ctx, m, m.holding ? fig => insertBefore(fig, 'armN', bucketParts(add(fig.joints.hN, [0, -6]), SWING(t) * m.dir)) : null);
    const hw = headW(m, fig); sweat(ctx, hw[0] - 60, hw[1] - 40, t, T.mJolt + 0.1, T.run); }
  puff(ctx, 560, GY, t, T.run, -1); puff(ctx, 930, GY, t, T.bRun, -1, 4);
  // 片尾：空钩子还在晃，左右两条落下的尘土
  if (t > T.bOut) puff(ctx, 40, GY, t, T.bOut - 0.6, -1, 3);
}

// ---------- 音效时间点 ----------
function events() {
  const ev = [], E = (t, type, pan = 0, extra = {}) => ev.push(Object.assign({ t: +t.toFixed(3), type, pan: +pan.toFixed(2) }, extra));
  for (let i = 0; i < OBJ.length; i++) E(OBJ[i].t0 + 0.05, 'pencil', 0);
  E(T.bucketPop, 'pop', 0.1);
  for (const t of stepTimes(T.sneak0, T.sneak1, SNEAK_P, [0, 0.5])) E(t, 'tiptoe', clamp((mX(t) - 540) / 540, -1, 1));
  E(T.reach0, 'cloth', 0.1); E(T.grab, 'grab', 0.15); E(T.grab + 0.02, 'creak', 0.15); E(T.proud0 + 0.05, 'tada', 0.1);
  for (const t of stepTimes(T.b0, T.b1, BWALK_P, [0, 0.5])) E(t, 'step', clamp((bX(t) - 540) / 540, -1, 1));
  E(T.see, 'gasp', 0.5); E(T.jumpUp, 'surprise', 0.5); E(T.land, 'land', 0.5); E(T.mJolt, 'jolt', 0.1); E(T.freeze0, 'freeze', 0);
  E(T.run, 'zip', 0); E(T.run, 'puff', 0);
  for (const t of stepTimes(T.run, T.mOut, RUN_P, [0, 0.5])) E(t, 'run', clamp((mX(t) - 540) / 540, -1, 1));
  E(T.bRun, 'shout', 0.5); E(T.bRun, 'puff', 0.5);
  for (const t of stepTimes(T.bRun, T.bOut, BRUN_P, [0, 0.5])) E(t, 'run2', clamp((bX(t) - 540) / 540, -1, 1));
  // 空钩子摆到两端：吱呀
  for (let k = 0; k < 8; k++) { const t = T.grab + (k * 0.5 + 0.2) * 1.25 / 1; if (t > T.bOut && t < DUR - 0.4) E(t, 'creak_small', 0.15, { amp: Math.exp(-(t - T.grab) * 0.5) }); }
  return ev.sort((a, b) => a.t - b.t);
}

// ---------- 输出 ----------
function still(t, out) { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); frame(ctx, t); fs.writeFileSync(out, cv.toBuffer('image/png')); }
function stills(ts, out, tw = 360) { const th = tw * 16 / 9, cols = Math.min(4, ts.length), rows = Math.ceil(ts.length / cols); const sh = createCanvas(tw * cols, th * rows), sx = sh.getContext('2d'), cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ts.forEach((t, i) => { frame(ctx, t); sx.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillStyle = '#c00'; sx.font = '22px YaHeiB'; sx.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26); });
  fs.writeFileSync(out, sh.toBuffer('image/png')); }
function video(fps, out) { const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0; const N = Math.round(DUR * fps), t0 = Date.now();
  return new Promise(res => { const write = () => { while (n < N) { frame(ctx, n / fps); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++;
    if (n % fps === 0) process.stdout.write(`\r  ${fps}fps ${(n / fps).toFixed(0)}s / ${DUR}s`); if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
    ff.on('close', c => { console.log(`\n  done ${((Date.now() - t0) / 1000).toFixed(0)}s`); res(c); }); write(); }); }

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'still') still(+a, b);
else if (cmd === 'stills') stills(a.split(',').map(Number), b);
else if (cmd === 'events') { const ev = events(); fs.writeFileSync(PATH.join(__dirname, 'sfx_events.json'), JSON.stringify(ev, null, 1)); console.log(ev.length, 'events'); }
else if (cmd === 'video') video(+a, b);
