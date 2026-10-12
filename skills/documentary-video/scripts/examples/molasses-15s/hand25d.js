// 手绘 + 电影化 2.5D：画面仍是一拍二的手绘，但拆成远景/中景/主体/前景四层，镜头平滑运动产生视差；
// 景深（前景和远景虚化、开场对焦转移）、侧光光束、空气透视、漏光、胶片颗粒、冷暖分离调色。
'use strict';
const S = require('./story');
const Cm = require('./common');
const { W, H, G, T, TANK, EL, clamp, lerp, prog, easeIO, easeOut, easeIn, wobble, rng } = S;

const C = {
  ink: '#1B1511', paper: '#e9dcc0', sky: '#9db2bf', sky2: '#c2d0d4', far: '#7d8a94', brick: '#b04e36', brickL: '#c06a47', win: '#2c2522', lit: '#e3b04b',
  steel: '#8a929a', steelL: '#a9b0b4', el: '#56606a', mol: '#4a2410', molL: '#8e4f1f', ground: '#4f463e', road: '#5a5048', cream: '#efe4c8', red: '#c8402c', mustard: '#d9a43a', coat: '#3b3532',
};
const SUB = { font: 'YaHeiB', size: 66, y: 1415, stroke: C.ink, strokeW: 12, colors: { date: '#E8B04A', place: '#8EC5E8', num: '#E5483A', text: '#F3EBDD' } };
const PAPER = Cm.noiseCanvas(17, { grain: 46, blobs: 260, blobCol: 'rgba(120,90,50,1)', blobAlpha: 0.07, base: '#ffffff' });
const VIG = Cm.vignetteCanvas(0.58, 0.4);

// ---------- 手绘工具（K = 当前是第几张画，Z = 镜头缩放，用来把像素级的抖动换算成世界坐标） ----------
let K = 0, Z = 1;
function subdiv(pts, step, closed) {
  const out = [], P = closed ? pts.concat([pts[0]]) : pts;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); }
  if (!closed) out.push(P[P.length - 1]);
  return out;
}
// 线条颤动：同一张画内固定，换一张画就重新抖（line boil）
function boil(pts, seed, amp = 2) { const r = rng(seed * 131 + K * 7919 + 1), a = amp / Z; return pts.map(p => [p[0] + (r() - 0.5) * 2 * a, p[1] + (r() - 0.5) * 2 * a]); }
// 墨线：分段粗细变化 ±25%，开放线两端收尖
function ink(ctx, pts, { w = 4, closed = false, seed = 1, step = 40, col = C.ink, amp = 2, smooth = false } = {}) {
  const p = boil(subdiv(pts, step / Math.max(Z, 0.5), closed), seed, amp), r = rng(seed * 7 + K * 31 + 3), n = p.length;
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = closed ? p.concat([p[0]]) : p;
  for (let i = 0; i < P.length - 1; i++) {
    let ww = w * (0.75 + 0.5 * r());
    if (!closed) ww *= Math.min(1, (i + 0.6) / 2.5, (P.length - 1 - i + 0.2) / 2.5);
    ctx.lineWidth = ww / Z; ctx.beginPath();
    if (smooth && i > 0) { const m0 = [(P[i - 1][0] + P[i][0]) / 2, (P[i - 1][1] + P[i][1]) / 2], m1 = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(P[i][0], P[i][1], m1[0], m1[1]); }
    else { ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[i + 1][0], P[i + 1][1]); }
    ctx.stroke();
  }
}
function path(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
// 平涂色块，和线条故意错位 2–3 像素（像手工上色）
function fill(ctx, pts, col, seed = 1) { const r = rng(seed * 17 + K), dx = (2 + r()) / Z, dy = (1.5 + r()) / Z; ctx.save(); ctx.translate(dx, dy); path(ctx, pts); ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
function shape(ctx, pts, col, { w = 4, seed = 1, step = 40, smooth = false } = {}) { fill(ctx, pts, col, seed); ink(ctx, pts, { w, closed: true, seed, step, smooth }); }
// 排线：暗部用平行斜线，不用渐变
function hatch(ctx, pts, { sp = 14, ang = -0.9, w = 1.6, seed = 1, col = C.ink, alpha = 0.75 } = {}) {
  ctx.save(); path(ctx, pts); ctx.clip();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 20, c = Math.cos(ang), s = Math.sin(ang), r = rng(seed * 3 + K * 13);
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let d = -R; d < R; d += sp / Math.max(Z, 0.6)) {
    const j = (r() - 0.5) * 3 / Z, ox = cx - s * (d + j), oy = cy + c * (d + j);
    ctx.lineWidth = w * (0.7 + 0.6 * r()) / Z; ctx.beginPath(); ctx.moveTo(ox - c * R, oy - s * R); ctx.lineTo(ox + c * R, oy + s * R); ctx.stroke();
  }
  ctx.restore();
}
const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const circP = (x, y, r, n = 16) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * 6.283) * r, y + Math.sin(i / n * 6.283) * r]);
const rot = (p, o, a) => { const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; };

// ---------- 背景 ----------
function sky(ctx, t, cam) {
  ctx.fillStyle = C.sky; ctx.fillRect(-4000, -3000, 8000, G + 3000);
  // 手画的平涂云带，边缘起伏
  const r = rng(4);
  for (let i = 0; i < 6; i++) {
    const y = -500 + i * 150 + r() * 60, pts = [];
    for (let x = -3200; x <= 3200; x += 160) pts.push([x + t * 5, y + 18 * Math.sin(x * 0.004 + i)]);
    for (let x = 3200; x >= -3200; x -= 160) pts.push([x + t * 5, y + 60 + 14 * Math.sin(x * 0.006 + i * 2)]);
    if (i % 2) { fill(ctx, pts, C.sky2, 40 + i); ink(ctx, pts.slice(0, pts.length / 2), { w: 1.6, seed: 50 + i, col: '#6f7472', step: 80 }); }
  }
}
function farCity(ctx, cam) {
  ctx.save(); ctx.translate(cam.cx * 0.45, (cam.cy - 880) * 0.2);
  const r = rng(5); let x = -3200; const sil = [[x, G + 300]];
  while (x < 2600) { const w = 90 + r() * 160, h = 380 + r() * 360; sil.push([x, G - h], [x + w, G - h]); x += w; }
  sil.push([x, G + 300]);
  fill(ctx, sil, C.far, 6); ink(ctx, sil, { w: 1.8, seed: 7, col: '#3d4a5c', step: 60 });   // 远景用有色细线
  ctx.restore();
}
function rowhouses(ctx, t) {
  const r = rng(9); let x = -2300, i = 0;
  while (x < 230) {
    const w = 170 + r() * 90, h = 520 + r() * 200, top = G - h, sd = 34; i++;
    const front = rectP(x, top, w, h + 300), side = [[x + w, top], [x + w + sd, top + 26], [x + w + sd, G + 300], [x + w, G + 300]];
    shape(ctx, front, C.brick, { w: 5, seed: 100 + i }); shape(ctx, side, C.brick, { w: 3.5, seed: 200 + i }); hatch(ctx, side, { sp: 11, seed: 300 + i });
    ink(ctx, [[x - 6, top - 12], [x + w + 8, top - 12]], { w: 5, seed: 400 + i });
    for (let fy = top + 50; fy < G - 120; fy += 105) for (let fx = x + 22; fx < x + w - 40; fx += 56) {
      const lit = r() < 0.12, wp = rectP(fx, fy, 30, 56); shape(ctx, wp, lit ? C.lit : C.win, { w: 2.2, seed: fx * 3 + fy, step: 30 });
    }
    shape(ctx, rectP(x + w * 0.5 - 24, G - 110, 48, 110), C.win, { w: 3, seed: 500 + i });
    if (r() < 0.55) {
      const cx = x + w * (0.25 + r() * 0.5); shape(ctx, rectP(cx, top - 70, 34, 70), C.brick, { w: 3, seed: 600 + i });
      for (let k = 0; k < 4; k++) { const u = ((t * 0.32 + k / 4 + cx * 0.001) % 1), rr = 16 + u * 46; const pts = circP(cx + 17 - u * 120, top - 80 - u * 260, rr, 14); fill(ctx, pts, C.cream, 700 + k); ink(ctx, pts, { w: 2, closed: true, seed: 800 + k + i * 9, step: 18, smooth: true }); }
    }
    x += w + sd;
  }
}
function ground(ctx) {
  ctx.fillStyle = C.road; ctx.fillRect(-4000, G, 8000, 3000);
  ink(ctx, [[-4000, G], [4000, G]], { w: 5, seed: 900, step: 80 });
  ink(ctx, [[-4000, G + 120], [4000, G + 120]], { w: 2.2, seed: 901, step: 90 }); ink(ctx, [[-4000, G + 170], [4000, G + 170]], { w: 2.2, seed: 902, step: 90 });
  const r = rng(21); for (let i = 0; i < 120; i++) { const x = -3000 + r() * 6000, y = G + 30 + r() * 900; ink(ctx, [[x, y], [x + 30 + r() * 40, y + (r() - 0.5) * 6]], { w: 2, seed: 1000 + i, step: 40 }); }
}

// ---------- 高架铁路 ----------
function elevated(ctx, t) {
  const tops = S.COLS.map(c => S.colTop(c, t));
  const pts = [[EL.x0, EL.deck], ...tops, [EL.x1, EL.deck]].sort((a, b) => a[0] - b[0]);
  S.COLS.forEach((c, i) => {
    const a = S.colAngle(c, t), base = [c.x, G], L = G - EL.deck;
    const q = [[-18, 0], [18, 0], [14, -L], [-14, -L]].map(p => rot([c.x + p[0], G + p[1]], base, -a));
    shape(ctx, q, C.el, { w: 4, seed: 1100 + i }); hatch(ctx, [q[1], q[2], [lerp(q[2][0], q[3][0], 0.5), q[2][1]], [lerp(q[1][0], q[0][0], 0.5), q[1][1]]], { sp: 9, seed: 1150 + i });
  });
  const top = pts.map(p => [p[0], p[1] - 56]), bot = pts.map(p => [p[0], p[1]]);
  shape(ctx, top.concat(bot.slice().reverse()), C.el, { w: 5, seed: 1200, step: 50 });
  // 桁架斜撑
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.round((b[0] - a[0]) / 60));
    for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n; ink(ctx, [[lerp(a[0], b[0], u0), lerp(a[1], b[1], u0) - 50], [lerp(a[0], b[0], (u0 + u1) / 2), lerp(a[1], b[1], (u0 + u1) / 2) - 6], [lerp(a[0], b[0], u1), lerp(a[1], b[1], u1) - 50]], { w: 2, seed: 1300 + i * 40 + k, step: 30 }); }
  }
  hatch(ctx, bot.map(p => [p[0], p[1] - 14]).concat(bot.slice().reverse()), { sp: 7, seed: 1400 });
  for (const p of S.PIGEONS) {
    const s = S.pigeonAt(p, t); if (s.y < -900) continue;
    ctx.save(); ctx.translate(s.x, s.y);
    const body = circP(0, 0, 14, 10).map(q => [q[0] * 1.2, q[1] * 0.75]); shape(ctx, body, C.steel, { w: 2.4, seed: 1500 + p.ph * 100, step: 10 });
    if (!s.sit) { const f = s.flap * 22; ink(ctx, [[-6, -4], [4, -26 - f], [12, -4]], { w: 2.4, seed: 1600 + p.ph * 50, step: 12 }); }
    ctx.restore();
  }
}

// ---------- 罐 ----------
function tankBody(ctx, t, { x0 = TANK.x0, x1 = TANK.x1, ragged = false, seed = 2000 } = {}) {
  const lit = TANK.x0 + (TANK.x1 - TANK.x0) * 0.6;
  let outline = rectP(x0, TANK.top, x1 - x0, G - TANK.top);
  if (ragged) { const r = rng(33); outline = [[x0 + 8, TANK.top], [x1, TANK.top], [x1, G], [x0, G]]; for (let y = G - 60; y > TANK.top; y -= 70) outline.push([x0 + (r() - 0.5) * 34, y]); }
  fill(ctx, outline, C.steelL, seed);
  ctx.save(); path(ctx, outline); ctx.clip();
  const shadow = rectP(Math.max(x0, lit), TANK.top, x1 - Math.max(x0, lit), G - TANK.top); fill(ctx, shadow, C.steel, seed + 1);
  hatch(ctx, shadow, { sp: 12, seed: seed + 2 });
  for (let y = TANK.top + 100; y < G; y += 110) { ink(ctx, [[x0, y], [x1, y]], { w: 2.4, seed: seed + y, step: 50 }); for (let x = x0 + 10; x < x1; x += 34) { ctx.beginPath(); ctx.arc(x + (rng(x + y + K)() - 0.5) * 2, y + 13, 3.6 / Math.max(Z, 0.7), 0, 7); ctx.fillStyle = C.ink; ctx.fill(); } }
  ctx.font = '52px Kai'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText('PURITY', 610 + (rng(K)() - 0.5) * 2, 560);
  ctx.restore();
  ink(ctx, outline, { w: 6, closed: true, seed, step: 45 });
}
function roof(ctx, t) {
  const tilt = t > T.crack ? 0.10 * easeOut(prog(t, T.crack + 0.1, T.crack + 0.7)) + 0.03 * wobble(t - T.crack - 0.7, 12, 4) : 0;
  const o = [TANK.x1 + 10, TANK.top], R = p => rot(p, o, tilt);
  const cone = [[TANK.x0 - 12, TANK.top], [560, TANK.roof], [TANK.x1 + 12, TANK.top]].map(R);
  shape(ctx, cone, C.steelL, { w: 5, seed: 2100 }); hatch(ctx, [[560, TANK.roof], [TANK.x1 + 12, TANK.top], [700, TANK.top]].map(R), { sp: 10, seed: 2101 });
  shape(ctx, [[540, TANK.roof - 4], [580, TANK.roof - 4], [575, TANK.roof - 40], [545, TANK.roof - 40]].map(R), C.steel, { w: 3, seed: 2102, step: 20 });
}
function drips(ctx, t) {
  [[700, 0.0], [905, 0.35], [1085, 0.7]].forEach(([y, d], i) => {
    if (t < T.strain + 0.4 + d) return;
    const u = easeOut(prog(t, T.strain + 0.4 + d, T.crack)), len = 20 + u * 150;
    shape(ctx, [[TANK.seam - 7, y], [TANK.seam + 7, y], [TANK.seam + 5, y + len], [TANK.seam, y + len + 12], [TANK.seam - 5, y + len]], C.mol, { w: 2.5, seed: 2200 + i, step: 20 });
  });
}
function tankIntact(ctx, t) {
  const u = easeIn(prog(t, T.strain, T.crack)), b = 1 + 0.035 * u, tr = 2.5 * u * Math.sin(t * 63), cx = (TANK.x0 + TANK.x1) / 2;
  const sh = [[TANK.x1, G], [TANK.x1 + 320, G + 60], [TANK.x0 + 320, G + 60], [TANK.x0, G]]; hatch(ctx, sh, { sp: 8, seed: 2300, alpha: 0.9 });
  ctx.save(); ctx.translate(cx + tr, G); ctx.scale(b, 1 - 0.006 * u); ctx.translate(-cx, -G);
  tankBody(ctx, t); roof(ctx, t);
  ink(ctx, [[TANK.seam, 470], [TANK.seam, G]], { w: 2.5, seed: 2400, step: 30 });
  drips(ctx, t);
  // 硬撑的颤动：接缝两侧画几道受力短线
  if (u > 0.3) for (let k = 0; k < 6; k++) { const y = 520 + k * 120; ink(ctx, [[TANK.seam - 30, y], [TANK.seam - 12, y + 8]], { w: 2, seed: 2500 + k, step: 10, amp: 3 }); ink(ctx, [[TANK.seam + 12, y + 8], [TANK.seam + 30, y]], { w: 2, seed: 2550 + k, step: 10, amp: 3 }); }
  ctx.restore();
}

// ---------- 糖蜜 ----------
function burstOut(ctx, t) {                      // 7.0–8.2：从裂缝里喷涌，形状向浪过渡
  const u = easeOut(prog(t, T.crack + 0.05, T.morphEnd)), w = S.wavePoly(T.morphEnd), crack = S.crackPoly();
  // 用裂缝的包络向 8.2 秒的浪形插值（手绘版不需要逐点液体变形，直接按张画）
  const n = 60, A = resample(crack, n), B = resample(w, n);
  const pts = A.map((p, i) => [lerp(p[0], B[i][0], u), lerp(p[1], B[i][1], u)]);
  shape(ctx, pts, C.mol, { w: 6, seed: 3000, step: 30, smooth: true });
  hatch(ctx, pts, { sp: 12, seed: 3001, alpha: 0.5 });
}
function resample(pts, N) {
  const P = pts.concat([pts[0]]); let L = 0; const seg = []; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
  const out = []; let k = 0, acc = 0; for (let n = 0; n < N; n++) { const tg = L * n / N; while (k < seg.length - 1 && acc + seg[k] < tg) { acc += seg[k]; k++; } const u = seg[k] ? (tg - acc) / seg[k] : 0; out.push([lerp(P[k][0], P[k + 1][0], u), lerp(P[k][1], P[k + 1][1], u)]); }
  // 起点对齐到最上方的点，减少扭转
  let best = 0; out.forEach((p, i) => { if (p[1] < out[best][1]) best = i; }); return out.slice(best).concat(out.slice(0, best));
}
function flood(ctx, t) {
  if (t < 7.9) return;
  const a = S.xf(t), xs = []; for (let x = a; x <= TANK.x1 + 200; x += 25) xs.push(x);
  const bot = xs.map(x => [x, G + S.floodDepth(x, t) + 10 * Math.sin(x * 0.02 + t * 3)]);
  const pts = [[a, G - 2], [TANK.x1 + 200, G - 2]].concat(bot.slice().reverse());
  fill(ctx, pts, C.mol, 3100); ink(ctx, bot, { w: 4, seed: 3101, step: 40, smooth: true }); hatch(ctx, pts, { sp: 16, ang: 0.02, seed: 3102, alpha: 0.35, col: C.molL });
}
function wave(ctx, t) {
  if (t < T.morphEnd) return;
  const wp = S.wavePoly(t, 80), a = S.xf(t), hm = S.Hm(t), k = hm / 410;
  fill(ctx, wp, C.mol, 3200);
  // 暗部排线：浪身下半部
  const top = S.waveTopPts(t, 80);
  const lower = top.map(p => [p[0], lerp(p[1], G, 0.45)]).concat([[a, G], [TANK.x1, G]].reverse());
  hatch(ctx, lower, { sp: 10, ang: -0.6, seed: 3201, alpha: 0.55 });
  // 亮色笔触：浪顶下方一笔一笔的高光线，随流动滑动
  const fl = Math.floor(t * 12) % 3;                  // 笔触随张数向前错位，表现流动
  for (let row = 0; row < 3; row++) for (let i = 3 + fl + row * 2; i < top.length - 4; i += 5) {
    const p = top[i], q = top[Math.min(top.length - 1, i + 2)], dd = 20 + row * 46; if (G - p[1] < dd + 40) continue;
    ink(ctx, [[p[0], p[1] + dd], [q[0], q[1] + dd + 4]], { w: 6 - row * 1.4, seed: 3300 + i + row * 100, step: 20, col: C.molL });
  }
  for (let i = 5 + fl; i < top.length - 4; i += 8) { const p = top[i]; ink(ctx, [[p[0] - 14, p[1] + 13], [p[0] + 18, p[1] + 10]], { w: 3.6, seed: 3400 + i, step: 10, col: C.cream }); }
  ink(ctx, wp, { w: 6.5, closed: true, seed: 3500, step: 34, smooth: true });
  // 浪头卷边 + 锯齿浪花
  if (hm > 80) {
    const cx = S.crestX(t) - 70 * k, cy = S.waveTop(S.crestX(t), t);
    const lip = [[cx + 60 * k, cy - 4], [cx - 40 * k, cy - 30 * k], [cx - 125 * k, cy + 8 * k], [cx - 155 * k, cy + 72 * k], [cx - 112 * k, cy + 42 * k], [cx - 60 * k, cy + 24 * k], [cx + 20 * k, cy + 26 * k]];
    shape(ctx, lip, C.molL, { w: 4, seed: 3600, step: 20, smooth: true });
    ink(ctx, circP(cx - 72 * k, cy + 50 * k, 26 * k, 12), { w: 3.5, closed: true, seed: 3601, step: 12, smooth: true });
    const r = rng(K * 5 + 9), spray = [];
    for (let i = 0; i < 9; i++) { const ang = -2.6 + i * 0.22, rr = (50 + r() * 50) * k; spray.push([cx - 40 * k + Math.cos(ang) * rr, cy - 10 + Math.sin(ang) * rr], [cx - 40 * k + Math.cos(ang + 0.11) * rr * 0.55, cy - 10 + Math.sin(ang + 0.11) * rr * 0.55]); }
    ink(ctx, spray, { w: 2.6, seed: 3602, step: 14 });
  }
  // 浪头前的速度线（手绘弧线）
  for (let i = 0; i < 4; i++) { const y = G - hm * (0.25 + i * 0.17), x = a - 40 - i * 18; ink(ctx, [[x, y], [x - 60 - i * 15, y + 6], [x - 120 - i * 25, y + 4]], { w: 2.4, seed: 3700 + i, step: 20 }); }
  // 液滴：带描边的小形状，按抛物线飞
  for (let j = 0; j < 9; j++) {
    const ph = ((t * 1.6 + j * 0.137) % 1), x = a - 30 - ph * (90 + j * 9), y = G - hm * 0.85 + (-140 + ph * 260) * ph * 2;
    if (hm > 60) shape(ctx, circP(x, y, 7 + (j % 3) * 4, 8), C.mol, { w: 2.2, seed: 3800 + j, step: 8 });
  }
  // 被卷走的木桶
  [[150, 0], [600, 3.1]].forEach(([off, ph], i) => {
    const x = a + off + 40 * Math.sin(t * 1.3 + ph); if (x > TANK.x0 - 20) return;
    const y = S.waveTop(x, t) + 18; ctx.save(); ctx.translate(x, y); ctx.rotate(t * -2.2 + ph);
    shape(ctx, rectP(-26, -34, 52, 68), '#7a4a2a', { w: 3, seed: 3900 + i, step: 20 }); ink(ctx, [[-26, -14], [26, -14]], { w: 3, seed: 3910 + i }); ink(ctx, [[-26, 14], [26, 14]], { w: 3, seed: 3920 + i });
    ctx.restore();
  });
}

// ---------- 罐裂开后 ----------
function tankBroken(ctx, t) {
  S.PLATES.forEach((p, i) => {
    const a = S.plateAngle(p, t), o = [p.x0, G];
    const q = rectP(p.x0, TANK.top, p.x1 - p.x0, G - TANK.top).map(v => rot(v, o, a));
    shape(ctx, q, C.steelL, { w: 5, seed: 4000 + i }); hatch(ctx, q, { sp: 16, seed: 4010 + i, alpha: 0.4 });
    // 倒下时画 1–2 张拖影弧线
    const sp = Math.abs(S.plateAngle(p, t) - S.plateAngle(p, t - 1 / 12));
    if (sp > 0.12) for (let k = 1; k <= 2; k++) { const b = rot(rot([p.x1, TANK.top], o, a), o, 0.12 * k); ink(ctx, [rot([p.x1, TANK.top], o, a), b], { w: 2, seed: 4020 + k + i * 5 }); }
  });
}
function tankRemnant(ctx, t) { tankBody(ctx, t, { x0: TANK.seam, x1: TANK.x1, ragged: true, seed: 2600 }); roof(ctx, t); }
function rivets(ctx, t) {
  S.RIVETS.forEach((rv, i) => {
    const s = S.rivetAt(rv, t); if (!s) return; const s0 = S.rivetAt(rv, t - 1 / 12) || s;
    if (Math.hypot(s[0] - s0[0], s[1] - s0[1]) > 25) ink(ctx, [s0, [lerp(s0[0], s[0], 0.5), lerp(s0[1], s[1], 0.5) - 6], s], { w: 2, seed: 4100 + i, step: 20 });
    ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(s[2]); shape(ctx, circP(0, 0, rv.size, 8), C.steel, { w: 2.6, seed: 4200 + i, step: 8 }); ctx.restore();
  });
}
// 冲击：锯齿状的手绘爆点 + 放射速度线，只持续两张画
function burst(ctx, x, y, size, seed) {
  const r = rng(seed + K), star = []; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rr = (i % 2 ? 0.45 : 1) * size * (0.8 + r() * 0.4); star.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  shape(ctx, star, C.cream, { w: 5, seed, step: 30 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + r() * 0.2, r0 = size * 1.15, r1 = size * (1.6 + r() * 0.6); ink(ctx, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], { w: 3.5, seed: seed + 10 + i }); }
}
function impacts(ctx, t) {
  if (t >= T.crack && t < T.crack + 2 / 12) burst(ctx, TANK.seam, 820, 150, 4300);
  S.COLS.forEach((c, i) => { if (c.hit && t >= c.hit && t < c.hit + 2 / 12 && i < 3) { const tp = S.colTop(c, c.hit); burst(ctx, c.x, G - 230, 70 - i * 15, 4400 + i * 20); } });
}

// ---------- 人物、路灯 ----------
function person(ctx, p, t, i) {
  const s = S.personAt(p, t), k = p.s * 0.95;
  ctx.save(); ctx.translate(s.x, G); ctx.scale(s.dir * k, k);
  const sw = Math.sin(s.phase * 6.283) * (s.run ? 0.75 : 0.3), lean = s.run ? 0.2 : 0;
  const leg = (ang, sd) => { const a = rot([0, 0], [0, -45], ang), b = rot([0, -45], [0, -45], ang), f = rot([0, 2], [0, -45], ang); ink(ctx, [[0, -45], f], { w: 9, seed: sd, step: 20 }); };
  leg(sw, 5000 + i * 10); leg(-sw, 5001 + i * 10);
  ctx.rotate(lean);
  shape(ctx, [[-18, -46], [18, -46], [13, -100], [-13, -100]], C.coat, { w: 3, seed: 5002 + i * 10, step: 16 });
  shape(ctx, circP(0, -112, 12, 10), '#c79a7a', { w: 2.6, seed: 5003 + i * 10, step: 10 });
  shape(ctx, [[-15, -122], [15, -122], [10, -138], [-10, -138]], C.coat, { w: 2.6, seed: 5004 + i * 10, step: 10 });
  ctx.save(); ctx.translate(4, -92); ctx.rotate(-sw * 1.1 + (s.run ? -0.7 : 0)); ink(ctx, [[0, 0], [0, 40]], { w: 7, seed: 5005 + i * 10, step: 20 }); ctx.restore();
  if (s.run && (K % 2 === 0)) { ink(ctx, [[22, -80], [50, -82]], { w: 2, seed: 5006 }); ink(ctx, [[22, -60], [44, -61]], { w: 2, seed: 5007 }); }
  ctx.restore();
}
function lamp(ctx, t) {
  shape(ctx, rectP(S.LAMP.x - 6, G - 230, 12, 230), C.coat, { w: 3, seed: 5100, step: 40 });
  shape(ctx, rectP(S.LAMP.x - 22, G - 268, 44, 38), C.coat, { w: 3, seed: 5101, step: 20 }); fill(ctx, rectP(S.LAMP.x - 14, G - 260, 28, 22), C.lit, 5102);
  const sw = t > T.crack ? 0.25 * wobble(t - T.crack, 9, 1.6) : 0.02 * Math.sin(t * 2);
  ctx.save(); ctx.translate(S.LAMP.x + 6, G - 200); ctx.rotate(sw); ink(ctx, [[2, 0], [2, 30]], { w: 2.5, seed: 5103 }); shape(ctx, rectP(-30, 30, 64, 40), C.cream, { w: 3, seed: 5104, step: 20 }); ctx.restore();
}

// ---------- 信息标注 ----------
function label(ctx, x, y, w, h, txt, col, seed, size = 66) {
  shape(ctx, rectP(x, y, w, h), C.cream, { w: 4, seed, step: 30 });
  ctx.font = `${size}px Kai`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3 / Z; ctx.strokeStyle = col; ctx.fillStyle = col;
  const r = rng(seed + K); ctx.save(); ctx.translate(x + w / 2 + (r() - 0.5) * 2, y + h / 2 + 4); ctx.rotate((r() - 0.5) * 0.02); ctx.fillText(txt, 0, 0); ctx.strokeText(txt, 0, 0); ctx.restore();
}
function tag(ctx, t) {
  if (t < T.tag) return;
  const u = easeOut(prog(t, T.tag, T.tag + 0.3)), sw = 0.12 * wobble(t - T.tag - 0.3, 10, 2.5), nx = 690, ny = 600 - (1 - u) * 260;
  ctx.save(); ctx.translate(nx, ny); ctx.rotate(sw); label(ctx, -170, 10, 340, 130, '870 万升', C.red, 6000, 74); ctx.restore();
  shape(ctx, circP(nx, ny + 8, 9, 8), C.ink, { w: 2, seed: 6001, step: 8 });
}
function ruler(ctx, t) {
  if (t < T.ruler || t > 11.3) return;
  const u = easeOut(prog(t, T.ruler, T.ruler + 0.45)), x = S.crestX(t) + 40, h = (G - S.waveTop(S.crestX(t), t)) * u;
  ink(ctx, [[x, G], [x, G - h]], { w: 6, seed: 6100, col: C.red, step: 40 });
  for (let k = 1; k <= 7; k++) if (k * 55 < h) ink(ctx, [[x - 20, G - k * 55], [x + 8, G - k * 55]], { w: 3.5, seed: 6110 + k, col: C.red });
  ink(ctx, [[x - 22, G - h + 26], [x, G - h], [x + 22, G - h + 26]], { w: 5, seed: 6120, col: C.red });
  if (u > 0.8) label(ctx, x + 30, G - h - 40, 220, 96, '7.5 米', C.red, 6130, 66);
}
function speedTag(ctx, t) {
  if (t < T.speed) return;
  const u = easeOut(prog(t, T.speed, T.speed + 0.35)), x = S.xf(t) - 30, y = G - S.Hm(t) - 170;
  ctx.save(); ctx.translate(x + 60, y); ctx.scale(u, u); label(ctx, -10, -60, 440, 104, '56 公里/小时', C.red, 6200, 62); ctx.restore();
}
function dateCard(ctx, t) {
  if (t < T.card) return;
  let y = 250 - 420 * (1 - easeIn(prog(t, T.card, T.card + 0.35))), a = 0.04 * wobble(t - T.card - 0.35, 12, 3);
  if (t > T.crack) { const u = t - T.crack; a += 0.6 * easeIn(clamp(u / 0.8)); y += 1400 * u * u; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); const z0 = Z; Z = 1;
  ctx.save(); ctx.translate(80, y); ctx.rotate(a);
  shape(ctx, rectP(0, 0, 400, 150), C.cream, { w: 5, seed: 6300, step: 30 }); hatch(ctx, rectP(0, 0, 400, 24), { sp: 6, seed: 6301 });
  ctx.font = '76px Kai'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  ctx.strokeText('1919.1.15', 26, 118); ctx.fillStyle = '#E8B04A'; ctx.fillText('1919.1.15', 26, 118);
  ctx.restore(); Z = z0;
}

// ======================= 电影化 2.5D =======================
const { createCanvas } = Cm;
const LAYER = { bg: createCanvas(W, H), mid: createCanvas(W, H), main: createCanvas(W, H), fg: createCanvas(W, H), rays: createCanvas(W, H) };
const GRAINS = [0, 1, 2].map(i => Cm.noiseCanvas(70 + i, { grain: 60 }));
const C2 = { haze: '#9fb6c4', fg: '#1f1a17', fgL: '#3a2f29', ray: '#fff1cf', teal: '#1d3a48', warm: '#ffb36b' };

// 镜头：开场改成一段从右往左的横移（让前景柱子从镜头前滑过），再叠一点手持晃动
function camera25(t) {
  const c = S.camera(t);
  if (t < T.strain) { const u = easeOut(prog(t, 0, T.strain)); c.cx = lerp(250, 407, u); c.z = lerp(0.9, 1, u); }
  c.cx += 5 * Math.sin(t * 0.9) + 3 * Math.sin(t * 2.3); c.cy += 4 * Math.sin(t * 1.1 + 1); c.rot = 0.004 * Math.sin(t * 0.7);
  return c;
}
// 每一层的镜头：p < 1 更远（移动和缩放都更少），p > 1 是前景（更快、更大）
function layerCam(ctx, cam, p) {
  const z = p >= 1 ? cam.z * p : 1 + (cam.z - 1) * p;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot * p); ctx.scale(z, z); ctx.translate(-cam.cx * p, -cam.cy);
  Z = z; return z;
}
// 焦点：0–1.2 秒对在前景，1.2–2.4 秒转到主体（对焦转移），之后主体清晰
function focus(t) {
  const u = easeIO(prog(t, 1.2, 2.4));
  return { fg: lerp(0, 14, u), main: lerp(7, 0, u), mid: lerp(9, 1.2, u), bg: lerp(12, 4, u) };
}

// ---------- 前景层（p = 1.6）：砖柱、电线、木箱，虚化的暗色剪影负责“框住”画面 ----------
function foreground(ctx, t) {
  const pil = [[40, 170]];   // 只留一根：开场在左边缘，浪冲出来时从镜头前一扫而过
  pil.forEach(([x, w], i) => {
    shape(ctx, rectP(x, -1400, w, 4000), C2.fg, { w: 6, seed: 7000 + i, step: 60 });
    fill(ctx, rectP(x + w * 0.62, -1400, w * 0.38, 4000), C2.fgL, 7010 + i);
    for (let y = -1300; y < 2600; y += 46) ink(ctx, [[x, y], [x + w, y]], { w: 2, seed: 7020 + i * 50 + y, step: 60, col: '#0d0a08' });
    ink(ctx, [[x + 3, -1400], [x + 3, 2600]], { w: 4, seed: 7030 + i, step: 90, col: '#c98a4a' });   // 受光一侧的暖色边光
  });
  // 电线：悬链线，罐裂开时被震得晃动
  const swing = t > T.crack ? 30 * wobble(t - T.crack, 7, 1.2) : 4 * Math.sin(t * 1.4);
  const anchors = [[-1500, 300], [125, 330], [1500, 300]];
  for (let k = 0; k < 3; k++) for (let i = 0; i < anchors.length - 1; i++) {
    const a = [anchors[i][0], anchors[i][1] + k * 34], b = [anchors[i + 1][0], anchors[i + 1][1] + k * 34], pts = [];
    for (let j = 0; j <= 16; j++) { const u = j / 16; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * (90 + swing * (1 + k * 0.3))]); }
    ink(ctx, pts, { w: 3.2, seed: 7100 + i * 7 + k, step: 30, smooth: true, col: '#0d0a08' });
  }
  // 底部的木箱
  [[560, 1560], [-420, 1580]].forEach(([x, y], i) => { const b = rectP(x, y, 230, 200); shape(ctx, b, '#4a3526', { w: 6, seed: 7200 + i }); hatch(ctx, b, { sp: 12, seed: 7210 + i }); ink(ctx, [[x, y], [x + 230, y + 200]], { w: 5, seed: 7220 + i }); });
}
// 漂浮的灰尘：主体层里小而清晰，前景层里大而虚（散景）
function dust(ctx, t, big, seed) {
  const r = rng(seed), n = big ? 14 : 40;
  for (let i = 0; i < n; i++) {
    const x0 = -2200 + r() * 3600, y0 = -300 + r() * 1800, sp = 8 + r() * 20, ph = r() * 6, rad = big ? 10 + r() * 14 : 2 + r() * 2.5;
    const x = x0 + Math.sin(t * 0.4 + ph) * 40 - t * sp, y = y0 + t * sp * 0.6 + Math.sin(t * 0.7 + ph) * 20;
    ctx.globalAlpha = big ? 0.35 : 0.6; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// 侧光光束（屏幕空间，从左上方斜射进来）
function rays(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  [[-200, 140, 0.16], [80, 90, 0.11], [330, 170, 0.14], [640, 70, 0.08]].forEach(([x, w, a], i) => {
    const flick = 1 + 0.15 * Math.sin(t * 0.8 + i * 1.7), dx = t * 6;
    ctx.globalAlpha = a * flick; ctx.fillStyle = C2.ray;
    ctx.beginPath(); ctx.moveTo(x + dx, -50); ctx.lineTo(x + w + dx, -50); ctx.lineTo(x + w + dx + 900, H * 0.75); ctx.lineTo(x + dx + 900 - w * 0.2, H * 0.75); ctx.closePath(); ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function blurDraw(ctx, src, px, alpha = 1) { ctx.globalAlpha = alpha; ctx.filter = px > 0.3 ? `blur(${px.toFixed(1)}px)` : 'none'; ctx.drawImage(src, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; }
function radial(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

function frame(ctx, tRaw) {
  K = Math.floor(tRaw * 12 + 1e-6); const t = K / 12;     // 画面内容一拍二
  const cam = camera25(tRaw), f = focus(tRaw);           // 镜头每帧平滑运动

  let c = LAYER.bg.getContext('2d'); layerCam(c, cam, 0.35); sky(c, t, cam); farCity(c, { cx: 0, cy: 880 });
  c = LAYER.mid.getContext('2d'); layerCam(c, cam, 0.8); rowhouses(c, t);
  c = LAYER.main.getContext('2d'); layerCam(c, cam, 1);
  ground(c); elevated(c, t); lamp(c, t); S.PEOPLE.forEach((p, i) => person(c, p, t, i));
  if (t < T.crack) { tankIntact(c, t); ink(c, [[TANK.x0 + 4, TANK.top + 4], [TANK.x0 + 4, G - 4]], { w: 5, seed: 7300, step: 60, col: '#f0c58a' }); }
  else {
    hatch(c, [[TANK.x1, G], [TANK.x1 + 320, G + 60], [TANK.seam + 320, G + 60], [TANK.seam, G]], { sp: 8, seed: 2300, alpha: 0.9 });
    const back = rectP(TANK.x0, TANK.top, TANK.seam - TANK.x0, G - TANK.top); shape(c, back, C.steel, { w: 4, seed: 2700 }); hatch(c, back, { sp: 9, seed: 2701 });
    tankBroken(c, t); flood(c, t); if (t < T.morphEnd) burstOut(c, t); else wave(c, t); tankRemnant(c, t);
  }
  rivets(c, t); impacts(c, t); tag(c, t); ruler(c, t); speedTag(c, t); dust(c, tRaw, false, 7400);
  c = LAYER.fg.getContext('2d'); layerCam(c, cam, 1.6); foreground(c, t); dust(c, tRaw, true, 7500);
  rays(LAYER.rays.getContext('2d'), tRaw);

  // 合成：由远到近，每层按焦点虚化，远处叠空气透视
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  blurDraw(ctx, LAYER.bg, f.bg);
  ctx.globalAlpha = 0.22; ctx.fillStyle = C2.haze; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'screen'; blurDraw(ctx, LAYER.rays, 18, 0.9); ctx.globalCompositeOperation = 'source-over';
  blurDraw(ctx, LAYER.mid, f.mid);
  ctx.globalAlpha = 0.08; ctx.fillStyle = C2.haze; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  blurDraw(ctx, LAYER.main, f.main);
  ctx.globalCompositeOperation = 'screen'; blurDraw(ctx, LAYER.rays, 30, 0.35); ctx.globalCompositeOperation = 'source-over';
  blurDraw(ctx, LAYER.fg, f.fg);

  // 罐裂开的闪光
  const fl = tRaw > T.crack ? Math.exp(-(tRaw - T.crack) * 9) : 0;
  if (fl > 0.02) { ctx.globalCompositeOperation = 'screen'; radial(ctx, (TANK.seam - cam.cx) * cam.z + W / 2, (820 - cam.cy) * cam.z + H / 2, 900, '255,240,210', 0.85 * fl); ctx.globalCompositeOperation = 'source-over'; }

  // 调色：暗部偏冷、亮部偏暖；漏光；纸纹 + 每张画换一次的胶片颗粒；暗角
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.32; ctx.fillStyle = C2.teal; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.6; radial(ctx, 0, 0, 1500, '255,179,107', 1);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen'; radial(ctx, -80, 300 + 200 * Math.sin(tRaw * 0.25), 700, '255,154,74', 0.18 + 0.08 * Math.sin(tRaw * 0.6));
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.45; ctx.drawImage(PAPER, 0, 0);
  ctx.globalAlpha = 0.35; ctx.drawImage(GRAINS[K % 3], 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(VIG, 0, 0);

  dateCard(ctx, t);
  const r = rng(K * 3 + 1);
  Cm.drawSubs(ctx, tRaw, { ...SUB, jitter: i => [(r() - 0.5) * 1.5, (r() - 0.5) * 1.5, 0] });
}

module.exports = { frame };
if (require.main === module) Cm.cli(frame, { fps: 24, hold: 1 });
