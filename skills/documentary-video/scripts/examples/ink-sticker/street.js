// 庞贝 · 面包房门口：带人物和动物的 10 秒镜头（墨线 + 贴纸色块 + 挤压拉伸，纯 Canvas 2D）
// 面包师、孩子、狗、拉磨的驴、鸽子、猫：日常 → 地震 → 远处喷发 → 人和动物逃离 → 空街、落灰、掉在地上的面包
// 人物/动物：两节 IK + 步态（支撑脚钉在地上不滑），姿势按一拍二（12 张/秒）取样，镜头平滑
// 用法：node street.js stills 1.5,2.4,3.7,4.5,5.6,6.6,8.2,9.6 sheet.png | strip 5.0 7.4 0.15 strip.png | events | video raw.mp4
'use strict';
const PATH = require('path'), fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
GlobalFonts.registerFromPath('C:/Windows/Fonts/simkai.ttf', 'Kai');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');

const W = 1080, H = 1920, FPS = 30, DUR = 10;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const ei = t => { t = clamp(t); return t * t * t; };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = k => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function vn(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const s = Math.sin((k + seed * 13.37) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), u); }
// 分段关键帧：[[t, v, ease], ...]
function keys(ks) { return t => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t < ks[i][0]) { const [t0, a] = ks[i - 1], [t1, b, e] = ks[i]; const u = (t - t0) / (t1 - t0); const f = e === 'lin' ? u : e === 'in' ? ei(u) : e === 'out' ? eo(u) : e === 'back' ? backOut(u) : eio(u); return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], f)) : lerp(a, b, f); } return ks[ks.length - 1][1]; }; }

const PAPER = '#EFE6D6', INK = '#232845', SHADOW = 'rgba(70,50,30,0.16)', LW = 5.5;
const C = { red: '#B5503C', ochre: '#E2B66E', wall: '#E7D6B4', tile: '#D9734E', dark: '#4A3A36', oven: '#C97B54', glow: '#F2A65A', side: '#D8CBB4', road: '#BDB2A2', stone: '#CFC5B5',
  mtn: '#A7BE9F', plume: '#BDB3A8', plumeL: '#D3CAC0', ash: '#5E5650', bread: '#C98A45', breadD: '#9E6430', skin: '#E8B48A', skinD: '#C9926A', hair: '#3A2B26',
  tunic: '#EDE3CF', tunicD: '#CFC1A6', apron: '#F8F3E8', kid: '#7FA6C9', kidD: '#5F86A8', dog: '#C98E5A', dogD: '#A06C40', donkey: '#9A938C', donkeyD: '#7C756E', cat: '#4A4450', bird: '#A9A7B3', lava: '#E4573D' };
const T = { tremor: 3.4, boom: 4.3, ash: 5.0, run: 5.15, zoom: 8.0, text: 8.1 };
let K = 0, TIME = 0;

// ---------- 线条工具（同 pompeii.js） ----------
function chaikin(p, closed, n = 3) { for (let k = 0; k < n; k++) { const o = [], m = closed ? p.length : p.length - 1; if (!closed) o.push(p[0]); for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]); } if (!closed) o.push(p[p.length - 1]); p = o; } return p; }
function resample(pts, step, closed) { const P = closed ? pts.concat([pts[0]]) : pts, out = [P[0]]; let acc = 0; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let pos = step - acc; while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; } acc = d - (pos - step); } if (!closed) out.push(P[P.length - 1]); return out; }
const prep = (pts, closed = false, smooth = 0) => resample(smooth ? chaikin(pts, closed, smooth) : pts, 5, closed);
function jit(P, seed, amp = 1.3) { return P.map((p, i) => [p[0] + (vn(i * 0.05 + seed * 7.1, K * 3.7 + seed) - .5) * 2 * amp, p[1] + (vn(i * 0.05 + seed * 3.3 + 50, K * 3.7 + seed + 9) - .5) * 2 * amp]); }
function path(ctx, Q, closed) { ctx.beginPath(); Q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (closed) ctx.closePath(); }
function ink(ctx, P, prog = 1, { w = LW, col = INK, closed = false, seed = 0, pen = true } = {}) {
  if (prog <= 0) return; const Q = jit(P, seed); const n = Math.max(2, Math.floor(Q.length * clamp(prog)));
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; path(ctx, Q.slice(0, n), closed && prog >= 1); ctx.stroke();
  if (pen && prog < 1) { const e = Q[n - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e[0], e[1], w, 0, Math.PI * 2); ctx.fill(); }
}
function fillP(ctx, P, col, seed = 0, dx = 0, dy = 0) { const Q = jit(P, seed + 101, 1.6).map(p => [p[0] + dx, p[1] + dy]); ctx.fillStyle = col; path(ctx, Q, true); ctx.fill(); }
function shape(ctx, P, col, seed, { shadow = true, w = LW } = {}) { if (shadow) fillP(ctx, P, SHADOW, seed, 8, 10); fillP(ctx, P, col, seed); ink(ctx, P, 1, { closed: true, seed, w }); }
const rect = (x, y, w, h) => prep([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
const ellP = (x, y, rx, ry, rot = 0, n = 30) => { const c = Math.cos(rot), s = Math.sin(rot); return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; return [x + ex * c - ey * s, y + ex * s + ey * c]; }); };
// 粗线条肢体：先画加粗的墨线，再画颜色 → 有墨边的"面条"
function limb(ctx, pts, w, col) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = w + LW * 2; path(ctx, pts, false); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; path(ctx, pts, false); ctx.stroke(); }
function blob(ctx, x, y, r, col) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + LW, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function popS(t, t0, d = 0.42) { const k = (t - t0) / d; if (k <= 0) return null; const sy = backOut(k); return [1 + (1 - sy) * 0.6, sy]; }
function withScale(ctx, s, ax, ay, fn) { ctx.save(); ctx.translate(ax, ay); ctx.scale(s[0], s[1]); ctx.translate(-ax, -ay); fn(); ctx.restore(); }
function eye(ctx, x, y, r, look, { lid = 0, wide = 1 } = {}) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, r * wide + 3.5, r * 1.15 * wide + 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(x, y, r * wide, r * 1.15 * wide, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + look[0] * r * 0.42, y + look[1] * r * 0.42, r * 0.5, 0, Math.PI * 2); ctx.fill();
  if (lid > 0) { ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(x, y - r * 1.15 * (1 - lid), r * wide + 2, r * 1.15 * wide * lid + 1, 0, 0, Math.PI * 2); ctx.fill(); }
}

// ---------- 两节 IK 与步态 ----------
function ik(p, q, a, b, pref) {
  const dx = q[0] - p[0], dy = q[1] - p[1], d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), end = [p[0] + Math.cos(base) * d, p[1] + Math.sin(base) * d];
  const j1 = [p[0] + Math.cos(base + A) * a, p[1] + Math.sin(base + A) * a], j2 = [p[0] + Math.cos(base - A) * a, p[1] + Math.sin(base - A) * a];
  const m = [(p[0] + end[0]) / 2, (p[1] + end[1]) / 2], s = j => (j[0] - m[0]) * pref[0] + (j[1] - m[1]) * pref[1];
  return [s(j1) >= s(j2) ? j1 : j2, end];
}
// 步态：支撑期脚钉在落脚点（世界坐标不动），摆动期抬脚划弧迈到下一个落脚点 → 不滑步
function gait(t, xFn, t0, period, offset, lead, lift, gy) {
  const u0 = (t - t0) / period + offset, n = Math.floor(u0), u = u0 - n;
  const plant = m => { const tm = t0 + (m - offset + 0.25) * period; return xFn(Math.max(t0, tm)) + lead; };
  if (u < 0.5) return [plant(n), gy];
  const s = (u - 0.5) / 0.5, a = plant(n), b = plant(n + 1); return [lerp(a, b, eio(s)), gy - lift * Math.sin(Math.PI * s)];
}

// ---------- 人物 ----------
const BAKER = { thigh: 66, shin: 64, upper: 52, fore: 50, torso: 118, tw: 92, head: 46, tunic: C.tunic, tunicD: C.tunicD, apron: true, hair: 'short', beard: true };
const KID = { thigh: 42, shin: 42, upper: 36, fore: 34, torso: 78, tw: 68, head: 40, tunic: C.kid, tunicD: C.kidD, apron: false, hair: 'curl' };
const rotv = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
// P: { x, gy, dir, drop(胯下沉), lean, fF, fN(世界坐标的脚), hF, hN(相对肩的局部手位置，面朝右), look:[x,y], mouth:0..1, wide, held(世界坐标的手，覆盖 hN) }
function skeleton(P, S) {
  const hipY = P.gy - (S.thigh + S.shin) * 0.985 + (P.drop || 0), hip = [P.x, hipY];
  const sh = [hip[0] + Math.sin(P.lean || 0) * S.torso * P.dir, hip[1] - Math.cos(P.lean || 0) * S.torso];
  const hc = [sh[0] + Math.sin((P.lean || 0) * 1.3) * (S.head + 4) * P.dir, sh[1] - Math.cos((P.lean || 0) * 1.3) * (S.head + 4)];
  const toW = v => [sh[0] + v[0] * P.dir, sh[1] + v[1]];
  return { hip, sh, hc, handF: toW(P.hF), handN: P.held || toW(P.hN) };
}
function drawHuman(ctx, P, S) {
  const k = skeleton(P, S), d = P.dir, { hip, sh, hc } = k;
  // 地面影子
  ctx.fillStyle = 'rgba(70,50,30,0.18)'; ctx.beginPath(); ctx.ellipse(P.x, P.gy + 4, S.tw * 0.75, 12, 0, 0, Math.PI * 2); ctx.fill();
  const leg = (foot, col) => { const [kn, f] = ik(hip, foot, S.thigh, S.shin, [d, -0.2]); limb(ctx, [hip, kn, f], S.thigh * 0.36, col);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(f[0] + d * 10, f[1] - 2, 17 + S.thigh * 0.06, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7A5A44'; ctx.beginPath(); ctx.ellipse(f[0] + d * 10, f[1] - 3, 12 + S.thigh * 0.06, 5.5, 0, 0, Math.PI * 2); ctx.fill(); };
  const arm = (hand, col) => { const [el, h] = ik(sh, hand, S.upper, S.fore, [-d * 0.6, 1]); limb(ctx, [sh, el, h], S.upper * 0.34, col); blob(ctx, h[0], h[1], S.upper * 0.2, C.skin); };
  leg(P.fF, C.skinD); arm(k.handF, S.tunicD);
  // 身体：从肩到下摆的梯形长袍（随前倾转动）
  const ang = (P.lean || 0) * d, R = v => { const r = rotv(v, ang); return [hip[0] + r[0], hip[1] + r[1]]; }, tw = S.tw;
  const body = prep(chaikin([R([-tw * 0.36, -S.torso]), R([tw * 0.36, -S.torso]), R([tw * 0.5, -S.torso * 0.4]), R([tw * 0.58, S.thigh * 0.55]), R([-tw * 0.58, S.thigh * 0.55]), R([-tw * 0.5, -S.torso * 0.4])], true, 2), true);
  shape(ctx, body, S.tunic, 7, { shadow: false });
  if (S.apron) { const ap = prep(chaikin([R([d * tw * 0.05, -S.torso * 0.55]), R([d * tw * 0.52, -S.torso * 0.5]), R([d * tw * 0.56, S.thigh * 0.45]), R([d * tw * 0.02, S.thigh * 0.45])], true, 1), true); shape(ctx, ap, C.apron, 8, { shadow: false }); }
  ink(ctx, [R([-tw * 0.5, -S.torso * 0.36]), R([tw * 0.5, -S.torso * 0.36])], 1, { w: 4.5, seed: 9 });   // 腰带
  // 头
  const hr = S.head * 0.82; ctx.save(); ctx.translate(hc[0], hc[1]); ctx.scale(d, 1);
  limb(ctx, [[-4, hr * 0.7], [-2, hr * 1.25]], hr * 0.45, C.skin);                                          // 脖子
  fillP(ctx, prep(ellP(0, 0, hr, hr * 1.02), true), C.skin, 11); ink(ctx, prep(ellP(0, 0, hr, hr * 1.02), true), 1, { closed: true, seed: 11 });
  ctx.fillStyle = C.hair;
  if (S.hair === 'short') { ctx.beginPath(); ctx.ellipse(-hr * 0.15, -hr * 0.55, hr * 0.95, hr * 0.55, -0.2, Math.PI * 0.95, Math.PI * 2.1); ctx.fill(); }
  else { for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-hr * 0.7 + i * hr * 0.27, -hr * 0.78 + Math.sin(i * 2) * 4, hr * 0.3, 0, Math.PI * 2); ctx.fill(); } ctx.beginPath(); ctx.arc(-hr * 0.78, -hr * 0.2, hr * 0.32, 0, Math.PI * 2); ctx.fill(); }
  if (S.beard) { ctx.beginPath(); ctx.ellipse(hr * 0.12, hr * 0.62, hr * 0.68, hr * 0.42, 0.15, 0, Math.PI); ctx.fill(); }
  ctx.fillStyle = C.skinD; ctx.beginPath(); ctx.arc(-hr * 0.42, hr * 0.05, hr * 0.2, 0, Math.PI * 2); ctx.fill();                   // 耳朵
  const lk = P.look ? (() => { const g = [(P.look[0] - hc[0]) * d, P.look[1] - hc[1]], l = Math.hypot(g[0], g[1]) || 1; return [g[0] / l, g[1] / l]; })() : [1, 0];
  eye(ctx, hr * 0.42, -hr * 0.12, hr * 0.26, lk, { wide: P.wide || 1, lid: P.blink || 0 });
  ctx.fillStyle = C.skinD; ctx.beginPath(); ctx.arc(hr * 0.95, hr * 0.12, hr * 0.17, 0, Math.PI * 2); ctx.fill();                   // 鼻子
  const m = P.mouth || 0; ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (m > 0.2) { ctx.beginPath(); ctx.ellipse(hr * 0.6, hr * 0.45, hr * 0.13, hr * 0.2 * m, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(hr * 0.55, hr * 0.32, hr * 0.2, 0.3, Math.PI - 0.6); ctx.stroke(); }
  if (P.brow) { ctx.beginPath(); ctx.moveTo(hr * 0.22, -hr * 0.52 - P.brow * 6); ctx.lineTo(hr * 0.62, -hr * 0.6 - P.brow * 8); ctx.stroke(); }
  ctx.restore();
  leg(P.fN, C.skin); arm(k.handN, S.tunic);
  return k;
}

// ---------- 动物 ----------
// 狗：A = { x, gy, dir, jump, sq(挤压), feet[4]（世界坐标：后远、前远、后近、前近）, look, bark, ears(0 垂 1 竖), wag, ball }
function drawDog(ctx, A) {
  const d = A.dir, by = A.gy - 62 - (A.jump || 0), sq = A.sq || 1;
  ctx.fillStyle = 'rgba(70,50,30,0.18)'; ctx.beginPath(); ctx.ellipse(A.x, A.gy + 4, 62 * (1 - (A.jump || 0) / 400), 11, 0, 0, Math.PI * 2); ctx.fill();
  const hipP = [A.x - d * 42, by + 8], shP = [A.x + d * 40, by + 6];
  const leg = (root, f, col, back) => { const [kn, ff] = ik(root, f, 30, 32, [back ? -d : d, 0]); limb(ctx, [root, kn, ff], 15, col); blob(ctx, ff[0] + d * 4, ff[1] - 3, 7, col); };
  leg(hipP, A.feet[0], C.dogD, true); leg(shP, A.feet[1], C.dogD, false);
  // 尾巴
  const wa = (A.wag || 0), tail = [[A.x - d * 56, by - 6], [A.x - d * 78, by - 26 - 10 * Math.sin(wa)], [A.x - d * (86 + 8 * Math.cos(wa)), by - 52 + 6 * Math.sin(wa)]];
  limb(ctx, prep(tail, false, 2), 11, C.dog);
  ctx.save(); ctx.translate(A.x, by); ctx.scale(d * (2 - sq), sq);
  const body = prep(ellP(0, 0, 62, 30), true); shape(ctx, body, C.dog, 31, { shadow: false });
  fillP(ctx, prep(ellP(-18, -10, 20, 13, 0.3), true), C.dogD, 32);                                   // 背上的花斑
  ctx.restore();
  leg(hipP, A.feet[2], C.dog, true); leg(shP, A.feet[3], C.dog, false);
  // 头
  const hx = A.x + d * 70, hy = by - 34 - (A.headUp || 0); ctx.save(); ctx.translate(hx, hy); ctx.scale(d, 1);
  const ear = A.ears || 0; const earP = prep([[-14, -14], [-6 + ear * 2, -14 - 22 * ear - 4], [6 + ear * 4, -20 - 6 * ear], [4, -6 + 18 * (1 - ear)], [-10, 4 + 16 * (1 - ear)]], true, 1);
  shape(ctx, prep(ellP(0, 0, 26, 24), true), C.dog, 33, { shadow: false });
  const ba = A.bark || 0;
  shape(ctx, prep([[12, -8], [44, -4], [46, 6 - ba * 2], [14, 10]], true, 1), C.dog, 34, { shadow: false });              // 上颚
  if (ba > 0.1) { fillP(ctx, prep([[16, 12], [42, 8 + ba * 4], [38, 12 + ba * 16], [14, 18]], true), '#B04A4A', 35); ink(ctx, prep([[16, 12], [42, 8 + ba * 4], [38, 12 + ba * 16], [14, 18]], true), 1, { closed: true, seed: 35, w: 4.5 }); }
  else shape(ctx, prep([[14, 10], [40, 8], [36, 16], [14, 16]], true), C.dog, 36, { shadow: false });
  blob(ctx, 46, -4, 6, INK);
  if (A.ball && ba < 0.1) blob(ctx, 44, 10, 13, C.lava);
  fillP(ctx, earP, C.dogD, 37); ink(ctx, earP, 1, { closed: true, seed: 37, w: 4.5 });
  const lk = A.look ? (() => { const g = [(A.look[0] - hx) * d, A.look[1] - hy], l = Math.hypot(g[0], g[1]) || 1; return [g[0] / l, g[1] / l]; })() : [1, 0];
  eye(ctx, 10, -8, 9, lk, { wide: A.wide || 1 });
  ctx.restore();
  if (ba > 0.1) for (let j = 0; j < 3; j++) { const a = -0.5 + j * 0.45, r0 = 70, r1 = 70 + 24 * ba; ink(ctx, [[hx + d * Math.cos(a) * r0, hy + Math.sin(a) * r0], [hx + d * Math.cos(a) * r1, hy + Math.sin(a) * r1]], 1, { w: 5, pen: false, seed: j + 40 }); }
}
// 驴：A = { x, gy, dir, rear(后腿为轴抬起的角度), feet[4], look, mouth, earsBack }
function drawDonkey(ctx, A) {
  const d = A.dir; ctx.fillStyle = 'rgba(70,50,30,0.18)'; ctx.beginPath(); ctx.ellipse(A.x, A.gy + 4, 110, 13, 0, 0, Math.PI * 2); ctx.fill();
  const pivot = [A.x - d * 60, A.gy], rot = -(A.rear || 0) * d;
  const R = p => { const v = rotv([p[0] - pivot[0], p[1] - pivot[1]], rot); return [pivot[0] + v[0], pivot[1] + v[1]]; };
  const by = A.gy - 150 - (A.bob || 0);
  const hipP = R([A.x - d * 62, by + 22]), shP = R([A.x + d * 58, by + 22]);
  const leg = (root, f, col, back) => { const [kn, ff] = ik(root, f, 58, 62, [back ? -d : d, 0]); limb(ctx, [root, kn, ff], 17, col); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ff[0], ff[1] - 4, 11, 8, 0, 0, Math.PI * 2); ctx.fill(); };
  leg(hipP, A.feet[0], C.donkeyD, true); leg(shP, A.feet[1], C.donkeyD, false);
  const tl = [R([A.x - d * 96, by - 10]), R([A.x - d * 112, by + 30]), R([A.x - d * 108, by + 64 + 6 * Math.sin(TIME * 5)])]; limb(ctx, prep(tl, false, 2), 8, C.donkey); blob(ctx, tl[2][0], tl[2][1], 9, C.donkeyD);
  ctx.save(); ctx.translate(pivot[0], pivot[1]); ctx.rotate(rot); ctx.translate(-pivot[0], -pivot[1]);
  const body = prep(ellP(A.x, by, 100, 50), true); shape(ctx, body, C.donkey, 51, { shadow: false });
  fillP(ctx, prep(ellP(A.x + d * 10, by + 26, 70, 18), true), '#B9B3AC', 52);                                    // 浅色肚子
  // 脖子 + 头
  const nk = [[A.x + d * 70, by - 20], [A.x + d * 112, by - 92]]; limb(ctx, nk, 52, C.donkey);
  ctx.fillStyle = C.hair; for (let i = 0; i < 6; i++) { const u = i / 5; ctx.beginPath(); ctx.arc(lerp(A.x + d * 62, A.x + d * 100, u), lerp(by - 38, by - 118, u), 9, 0, Math.PI * 2); ctx.fill(); }   // 鬃毛
  const hx = A.x + d * 128, hy = by - 108; ctx.save(); ctx.translate(hx, hy); ctx.scale(d, 1); ctx.rotate(0.5 - (A.headUp || 0));
  const eb = A.earsBack || 0; for (const [ox, a] of [[-10, -0.35 - eb], [6, -0.1 - eb]]) { const e = prep(ellP(ox + Math.sin(a) * 34, -24 - Math.cos(a) * 34 * 0.9, 11, 34, a), true); shape(ctx, e, C.donkey, 53 + ox, { shadow: false }); }
  shape(ctx, prep(ellP(16, 0, 46, 24, 0.15), true), C.donkey, 55, { shadow: false });
  fillP(ctx, prep(ellP(48, 8, 18, 16, 0.1), true), '#C9C3BC', 56);
  const m = A.mouth || 0; if (m > 0.1) { fillP(ctx, prep([[40, 18], [64, 14], [62, 18 + 18 * m], [40, 24]], true), '#7A4A4A', 57); }
  blob(ctx, 56, 4, 3.5, INK);
  eye(ctx, 2, -8, 8, [1, -0.2], { wide: A.wide || 1 });
  ctx.restore(); ctx.restore();
  leg(hipP, A.feet[2], C.donkey, true); leg(shP, A.feet[3], C.donkey, false);
  return { harness: R([A.x + d * 40, by - 10]) };
}

// ---------- 场景（静态几何） ----------
const GY = 1300;
const MTN = prep([[420, 820], [560, 700], [700, 590], [770, 560], [830, 564], [900, 600], [1040, 700], [1160, 800]], false, 2);
const MTN_F = prep([[420, 820], [560, 700], [700, 590], [770, 560], [830, 564], [900, 600], [1040, 700], [1160, 800], [1160, 900], [420, 900]], true, 2);
const CRX = 800, CRY = 562;
const R1 = rng(17), PLUME = [];
for (let i = 0; i < 60; i++) { const f = i / 60; PLUME.push({ tb: T.boom + f * 1.1, tx: CRX + (R1() - .5) * 50 * (0.4 + f), ty: lerp(CRY - 20, 340, Math.pow(f, 0.8)), r: 42 + 46 * f + R1() * 16, dur: 0.8 + R1() * 0.3, s: R1() }); }
for (let i = 0; i < 70; i++) { const s = R1() < .5 ? -1 : 1, dd = Math.pow(R1(), 0.7) * 520; PLUME.push({ tb: T.boom + 1.0 + (dd / 520) * 2.2 + R1() * 0.2, tx: CRX + s * dd, ty: 270 + R1() * 80 + dd * 0.1, r: 60 + R1() * 40, dur: 1.1 + R1() * 0.4, s: R1(), from: [CRX + s * 30, 330] }); }
for (let i = 0; i < 40; i++) { const s = R1() < .5 ? -1 : 1, dd = 300 + R1() * 500; PLUME.push({ tb: T.boom + 3.0 + R1() * 2.2, tx: CRX + s * dd - 150, ty: 260 + R1() * 300, r: 70 + R1() * 50, dur: 1.4, s: R1(), from: [CRX + s * 200, 260] }); }
const ASH = Array.from({ length: 300 }, () => ({ x: R1() * 1300 - 110, y0: R1() * 2000, sp: 200 + R1() * 220, st: T.ash + R1() * 1.8, len: 8 + R1() * 14, dot: R1() < 0.35 }));
const PAVE = (() => { const r = rng(4), out = []; for (let row = 0; row < 7; row++) { const y0 = 1335 + row * 90; let x = -60 + r() * 60; while (x < 1140) { const w = 110 + r() * 90; out.push(prep([[x + 6, y0 + 6 + r() * 8], [x + w - 6, y0 + 4 + r() * 8], [x + w - 10, y0 + 82], [x + 8, y0 + 84]], true, 1)); x += w; } } return out; })();
const SIDE_J = Array.from({ length: 11 }, (_, i) => prep([[i * 105 - 20, 1182], [i * 105 - 30, 1318]], false));
const STEPS = [[300, 1452], [450, 1452], [600, 1452]];

// ---------- 表演（关键姿势与时间线） ----------
const looking = t => t > T.tremor + 0.25;
const MT = [CRX, CRY];
// 面包师：在柜台边 → 举起面包给人看 → 放下 → 地震、抬头 → 喷发时吓一跳 → 冲去牵孩子 → 一起往左跑
const bakerX = keys([[0, 440], [T.run, 440], [T.run + 0.55, 620, 'io'], [5.95, 620], [6.35, 570, 'in'], [8.0, -330, 'lin']]);
const kidX = keys([[0, 720], [5.95, 720], [6.35, 672, 'in'], [8.05, -230, 'lin']]);
function bakerPose(t) {
  const x = bakerX(t); let dir = t < 5.85 ? 1 : -1, drop = 0, lean = 0, fF, fN, hF = [-14, 92], hN = [26, 86], mouth = 0, wide = 1, brow = 0;
  if (t < T.run) { fF = [x - 16, GY]; fN = [x + 22, GY]; }
  // 举面包
  const lift = sm((t - 1.9) / 0.35) * (1 - sm((t - 2.55) / 0.35)); hN = [lerp(26, 70, lift), lerp(86, -20, lift)];
  if (t > 2.9 && t < T.run) hN = [62, 70];      // 手搭在柜台上
  // 喷发：先往下一沉（蓄力），再弹起（过冲）
  if (t > T.boom - 0.05 && t < T.run) { const k = t - T.boom; drop = k < 0.08 ? 14 * sm((k + 0.05) / 0.13) : -26 * Math.exp(-(k - 0.08) * 7) * Math.cos((k - 0.08) * 14); hF = [-40, -60]; hN = [50, -70]; mouth = 1; wide = 1.3; brow = 1; }
  if (t > T.boom + 0.6 && t < T.run) { hF = [-20, 80]; hN = [40, 60]; mouth = 0.8; brow = 1; }
  // 跑：先冲向孩子
  if (t >= T.run && t < 5.95) { const xf = s => bakerX(Math.min(5.7, s)); fF = gait(t, xf, T.run, 0.36, 0, 18, 32, GY); fN = gait(t, xf, T.run, 0.36, 0.5, 18, 32, GY); lean = 0.25 * sm((t - T.run) / 0.2) * (1 - sm((t - 5.6) / 0.15)); hF = [-50, 50]; hN = [40, 40]; mouth = 0.6; brow = 1; if (t > 5.6) { hN = [80, 60]; fF = [620 - 20, GY]; fN = [620 + 26, GY]; } }
  if (t >= 5.95) { const ph = (t - 5.95) / 0.32; fF = gait(t, bakerX, 5.95, 0.32, 0, -22, 38, GY); fN = gait(t, bakerX, 5.95, 0.32, 0.5, -22, 38, GY); lean = 0.3 * sm((t - 5.95) / 0.25); drop = 6 * Math.abs(Math.sin(ph * Math.PI * 2)); hF = [40 * Math.cos(ph * Math.PI * 2), 70]; hN = [-70, 50]; mouth = 0.6; brow = 1; }
  if (t < T.run && t > 0) { /* 原地时，地震让身体微晃 */ }
  return { x, gy: GY, dir, drop, lean, fF, fN, hF, hN, look: looking(t) ? MT : (t > 1.9 && t < 2.6 ? [700, 1100] : [700, 1150]), mouth: t > 1.95 && t < 2.6 ? 0.1 : mouth, wide, brow, blink: (t > 1.3 && t < 1.38) ? 1 : 0 };
}
function kidPose(t, bakerHand) {
  const x = kidX(t); let dir = t < T.tremor + 0.3 ? -1 : 1; if (t > 5.75) dir = -1; let drop = 0, lean = 0, fF = [x + 14, GY], fN = [x - 18, GY], hF = [10, 70], hN = [18, 64], mouth = 0, wide = 1, brow = 0, held = null;
  // 扔球给狗（孩子面朝右边的狗）
  dir = t < T.tremor + 0.3 ? 1 : dir;
  const wind = sm((t - 1.6) / 0.25), thr = sm((t - 1.85) / 0.12); hN = [lerp(lerp(18, -50, wind), 60, thr), lerp(lerp(64, -30, wind), -60, thr)];
  if (t > 2.1) hN = [40, 40];
  // 拍手 + 蹦跳
  if (t > 2.75 && t < 3.35) { const c = Math.abs(Math.sin((t - 2.75) * Math.PI * 4)); hN = [44, 20 - c * 10]; hF = [44 - c * 18, 22]; drop = -10 * c; mouth = 0.5; }
  if (t > T.boom - 0.02 && t < T.run + 0.7) { const k = t - T.boom - 0.06; drop = k < 0 ? 0 : (k < 0.1 ? 10 * sm(k / 0.1) : -20 * Math.exp(-(k - 0.1) * 7) * Math.cos((k - 0.1) * 14)); hN = [30, -50]; hF = [20, -40]; mouth = 1; wide = 1.3; brow = 1; }
  if (t > 5.65 && t < 5.95) { held = bakerHand; mouth = 0.6; }
  if (t >= 5.95) { const ph = (t - 5.95) / 0.26; fF = gait(t, kidX, 5.95, 0.26, 0.25, -14, 26, GY); fN = gait(t, kidX, 5.95, 0.26, 0.75, -14, 26, GY); lean = 0.28 * sm((t - 5.95) / 0.25); drop = 5 * Math.abs(Math.sin(ph * Math.PI * 2)); held = bakerHand; hF = [-30 * Math.cos(ph * Math.PI * 2), 50]; mouth = 0.6; brow = 1; }
  return { x, gy: GY, dir, drop, lean, fF, fN, hF, hN, held, look: looking(t) ? MT : [880, 1200], mouth, wide, brow, blink: (t > 1.1 && t < 1.18) ? 1 : 0 };
}
// 球：孩子扔出 → 狗跳起来接住
const CATCH = [786, 1086], T_THROW = 1.95, T_CATCH = 2.42;
// 狗：面朝孩子摇尾巴 → 起跳接球 → 落地 → 地震：球掉了、耳朵竖起、转向火山 → 狂吠 → 转身追着主人跑
const dogX = keys([[0, 900], [6.15, 900], [6.5, 840, 'in'], [7.8, -260, 'lin']]);
function dogPose(t) {
  const x = dogX(t); let dir = -1, jump = 0, sq = 1, ears = 0, bark = 0, wag = Math.sin(t * 18) * (t < T.tremor ? 1 : 0.15), ball = t > T_CATCH && t < T.tremor + 0.1, headUp = 0, wide = 1;
  let feet = [[x + 40, GY], [x - 40, GY], [x + 30, GY], [x - 48, GY]];
  // 起跳接球：蹲（压扁）→ 腾空（拉长）→ 落地（压扁）
  if (t > 2.12 && t < 2.95) { const k = t - 2.12; if (k < 0.12) sq = 1 - 0.18 * sm(k / 0.12); else if (k < 0.62) { const u = (k - 0.12) / 0.5; jump = 130 * Math.sin(Math.PI * u); sq = 1 + 0.18 * Math.cos(Math.PI * u); headUp = 10; } else { const u = (k - 0.62) / 0.21; sq = 1 - 0.2 * Math.sin(Math.PI * u); } }
  if (t > T.tremor + 0.1) { ears = sm((t - T.tremor - 0.1) / 0.2); dir = t < 6.05 ? 1 : -1; wide = 1.2; headUp = 14; feet = dir > 0 ? [[x - 40, GY], [x + 40, GY], [x - 30, GY], [x + 48, GY]] : feet; }
  for (const b of [4.5, 4.78, 5.05, 5.35, 5.62, 5.9]) if (t > b && t < b + 0.2) bark = Math.sin(Math.PI * (t - b) / 0.2);
  if (t >= 6.15) { const xf = dogX; feet = [gait(t, xf, 6.15, 0.24, 0, 30, 22, GY), gait(t, xf, 6.15, 0.24, 0.15, -40, 26, GY), gait(t, xf, 6.15, 0.24, 0.5, 30, 22, GY), gait(t, xf, 6.15, 0.24, 0.65, -40, 26, GY)]; sq = 1 + 0.06 * Math.sin((t - 6.15) / 0.24 * Math.PI * 2); jump = 6 * Math.abs(Math.sin((t - 6.15) / 0.24 * Math.PI * 2)); headUp = 4; }
  return { x, gy: GY, dir, jump, sq, ears, bark, wag, ball, feet, headUp, wide, look: t > T.tremor + 0.1 ? (t < 6.05 ? MT : [-100, 1200]) : [700, 1080] };
}
// 驴：在磨边原地踏步拉磨 → 惊起（后腿为轴人立）→ 挣断缰绳往左狂奔
const donkeyX = keys([[0, 215], [5.45, 215], [5.8, 165, 'in'], [7.0, -360, 'lin']]);
function donkeyPose(t) {
  const x = donkeyX(t); let dir = t < 5.35 ? 1 : -1, rear = 0, bob = 0, mouth = 0, earsBack = 0, headUp = 0, wide = 1;
  let feet = dir > 0 ? [[x - 62, GY], [x + 58, GY], [x - 52, GY], [x + 68, GY]] : [[x + 62, GY], [x - 58, GY], [x + 52, GY], [x - 68, GY]];
  if (t > 1.0 && t < T.tremor) { const ph = (t - 1) / 0.9 * Math.PI * 2; feet = feet.map((f, i) => [f[0] + 10 * Math.sin(ph + i * Math.PI / 2), GY - Math.max(0, 14 * Math.sin(ph + i * Math.PI / 2))]); bob = 3 * Math.sin(ph * 2); headUp = -0.08; }
  const rearAt = (a, d) => t > a && t < a + d ? Math.sin(Math.PI * (t - a) / d) : 0;
  const r = Math.max(rearAt(3.55, 0.75), rearAt(T.boom + 0.05, 0.8)); rear = 0.42 * r;
  if (r > 0) { feet[1] = [feet[1][0] + 20, GY - 70 * r]; feet[3] = [feet[3][0] + 30, GY - 90 * r]; mouth = r; earsBack = 0.4 * r; headUp = 0.4 * r; wide = 1.3; }
  if (t > T.tremor) { earsBack = Math.max(earsBack, 0.5); wide = 1.3; }
  if (t >= 5.45) { const xf = donkeyX, P = 0.34; feet = [gait(t, xf, 5.45, P, 0, 62, 34, GY), gait(t, xf, 5.45, P, 0.1, -58, 40, GY), gait(t, xf, 5.45, P, 0.5, 52, 34, GY), gait(t, xf, 5.45, P, 0.6, -68, 40, GY)]; bob = 10 * Math.abs(Math.sin((t - 5.45) / P * Math.PI)); headUp = 0.2; }
  return { x, gy: GY, dir, rear, bob, mouth, earsBack, headUp, wide, feet };
}
// 面包：在柜台上 → 地震滑落 → 弹两下滚到街上
const LOAF0 = [590, 1158];
const loafPath = (() => { const pts = []; let x = 630, y = 1158, vx = 120, vy = -60, t = 3.62; const g = 2200; let floor = 1300 - 20, rot = 0; while (t < 6) { t += 1 / 240; vy += g / 240; x += vx / 240; y += vy / 240; rot += vx / 240 / 26; if (x > 700 && floor < 1380) floor = 1395; if (y > floor) { y = floor; vy = -Math.abs(vy) * 0.42; vx *= 0.75; if (Math.abs(vy) < 60) vy = 0; } if (y >= floor && vy === 0) vx *= 0.985; pts.push([t, x, y, rot]); } return pts; })();
function loafAt(t) {
  if (t < 1.9) return null;
  if (t < 2.55) { const p = skeleton(bakerPose(t), BAKER).handN; return [p[0] + 18, p[1] - 14, 0]; }
  if (t < 2.9) { const p = skeleton(bakerPose(t), BAKER).handN; const k = sm((t - 2.55) / 0.35); return [lerp(p[0] + 18, LOAF0[0], k), lerp(p[1] - 14, LOAF0[1], k), 0]; }
  if (t < 3.45) return [LOAF0[0], LOAF0[1], 0];
  if (t < 3.62) { const k = (t - 3.45) / 0.17; return [lerp(LOAF0[0], 630, k), LOAF0[1], 0.1 * k]; }
  const i = Math.min(loafPath.length - 1, Math.floor((t - 3.62) * 240)); const p = loafPath[i]; return [p[1], p[2], 0.5 * Math.sin(p[3] * 2.2) * Math.exp(-(t - 3.62) * 1.2)];
}
function drawLoaf(ctx, x, y, rot, s = 1, ash = 0) {
  // 庞贝出土的面包：圆形，表面压成 8 瓣
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const P = prep(ellP(0, 0, 30, 22), true); shape(ctx, P, ash > 0 ? lerpCol(C.bread, '#8E867E', ash) : C.bread, 61);
  ctx.strokeStyle = C.breadD; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 26, -Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 18); ctx.stroke(); }
  ctx.restore();
}
function lerpCol(a, b, t) { const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`; }

// 鸽子：屋檐上啄食 → 地震时飞走
const PIGEONS = [[140, 762], [200, 760], [262, 763], [330, 761]].map(([x, y], i) => ({ x, y, ph: i * 1.3, go: T.tremor + 0.05 + i * 0.07 }));
function drawPigeon(ctx, p, t) {
  const a = Math.max(0, t - p.go), x = p.x - a * (260 + p.ph * 30), y = p.y - a * 380 - a * a * 60; if (y < -60) return;
  if (a <= 0) { const peck = Math.max(0, Math.sin(t * 5 + p.ph * 3)) ; fillP(ctx, prep(ellP(x, y - 16, 22, 14), true), C.bird, 70 + p.ph); ink(ctx, prep(ellP(x, y - 16, 22, 14), true), 1, { closed: true, seed: 70 + p.ph, w: 4.5 }); blob(ctx, x + 18, y - 30 + peck * 12, 9, C.bird); blob(ctx, x + 21, y - 32 + peck * 12, 1.8, INK); ink(ctx, [[x + 27, y - 30 + peck * 12], [x + 33, y - 28 + peck * 12]], 1, { col: '#D99A3A', w: 4, pen: false }); return; }
  const fl = Math.sin(t * 28 + p.ph); ink(ctx, [[x - 26, y - 20 * fl], [x, y + 4], [x + 26, y - 20 * fl]], 1, { w: 5, pen: false, seed: p.ph }); blob(ctx, x, y + 4, 8, C.bird);
}
// 猫：坐在墙头 → 地震时跳走
function drawCat(ctx, t) {
  const go = T.tremor + 0.25, a = Math.max(0, t - go); if (a > 0.8) return; const x = 985 + a * 380, y = 798 - (a > 0 ? 260 * a - 420 * a * a : 0);
  ctx.save(); ctx.translate(x, y); const st = a > 0 ? 1.3 : 1; ctx.scale(1 / Math.sqrt(st), st);
  limb(ctx, prep([[-20, -10], [-40, -30], [-34, -60 + 8 * Math.sin(t * 3)]], false, 2), 7, C.cat);
  shape(ctx, prep(ellP(0, -26, 24, 28), true), C.cat, 81, { shadow: false }); shape(ctx, prep(ellP(6, -64, 19, 17), true), C.cat, 82, { shadow: false });
  fillP(ctx, prep([[-6, -76], [-2, -96], [6, -78]], true), C.cat, 83); fillP(ctx, prep([[8, -78], [18, -96], [20, -74]], true), C.cat, 84);
  ctx.fillStyle = '#E8D36A'; ctx.beginPath(); ctx.arc(2, -66, 4, 0, Math.PI * 2); ctx.arc(14, -66, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- 背景 ----------
const PAPER_TEX = (() => { const c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = PAPER; x.fillRect(0, 0, W, H); const r = rng(5); for (let i = 0; i < 380; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 160; const g = x.createRadialGradient(px, py, 0, px, py, rr); const d = r() < .5; g.addColorStop(0, d ? 'rgba(150,120,90,0.035)' : 'rgba(255,252,240,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); } for (let i = 0; i < 8000; i++) { x.fillStyle = `rgba(110,90,70,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); } return c; })();
function blobs(ctx, list, t, col, colL) {
  const live = []; for (const b of list) { const a = t - b.tb; if (a < 0) continue; const k = eo(a / b.dur); const fx = b.from ? b.from[0] : CRX, fy = b.from ? b.from[1] : CRY - 8; live.push([lerp(fx, b.tx, k), lerp(fy, b.ty, k), Math.max(4, lerp(14, b.r, k) * (1 + 0.04 * Math.sin(K * 1.3 + b.s * 20)))]); }
  if (!live.length) return;
  ctx.fillStyle = SHADOW; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x + 9, y + 11, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = INK; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x, y, r + LW, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = col; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = colL; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.24, r * 0.6, 0, Math.PI * 2); ctx.fill(); }
}
function reveal(ctx, t0, d, fn) { const p = eio((TIME - t0) / d); if (p <= 0) return; if (p >= 1) { fn(); return; } ctx.save(); ctx.beginPath(); const X = -60 + 1300 * p; ctx.moveTo(-60, -60); for (let y = -60; y <= H + 60; y += 40) ctx.lineTo(X + 24 * Math.sin(y / 55 + p * 7), y); ctx.lineTo(-60, H + 60); ctx.closePath(); ctx.clip(); fn(); ctx.restore(); }
function drawBackground(ctx, t) {
  // 远山 + 烟柱
  reveal(ctx, 0.35, 0.6, () => fillP(ctx, MTN_F, C.mtn, 1));
  ink(ctx, MTN, (t - 0.2) / 0.6, { seed: 2 });
  if (t > T.boom - 0.05) { ctx.fillStyle = `rgba(228,87,61,${clamp((t - T.boom + 0.05) / 0.1)})`; ctx.beginPath(); ctx.ellipse(CRX, CRY + 3, 34, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  if (t > T.boom && t < T.boom + 0.4) { const k = (t - T.boom) / 0.4; for (let j = 0; j < 7; j++) { const a = -Math.PI * (0.12 + j * 0.127), r0 = 40 + 70 * eo(k), r1 = r0 + 40 * (1 - k); ink(ctx, [[CRX + Math.cos(a) * r0, CRY + Math.sin(a) * r0], [CRX + Math.cos(a) * r1, CRY + Math.sin(a) * r1]], 1, { w: 6, pen: false, seed: j + 30 }); } }
  if (t > 2.6 && t < T.boom + 0.2) for (let j = 0; j < 3; j++) { const a = ((t - 2.6) * 0.45 + j / 3) % 1; blob(ctx, CRX + 6 + a * 40, CRY - 14 - a * 100, 7 + a * 16, C.plumeL); }
  blobs(ctx, PLUME, t, C.plume, C.plumeL);
  // 面包房（左）：庞贝红的墙裙 + 赭黄的上墙，门里是烤炉
  reveal(ctx, 0.1, 0.9, () => {
    fillP(ctx, rect(-30, 780, 600, 220), C.ochre, 3); fillP(ctx, rect(-30, 1000, 600, 185), C.red, 4);
    fillP(ctx, rect(560, 810, 560, 375), C.wall, 5);
    fillP(ctx, rect(300, 890, 250, 295), C.dark, 6); fillP(ctx, rect(690, 990, 110, 195), C.dark, 7); fillP(ctx, rect(900, 900, 80, 62), C.dark, 8);
    fillP(ctx, prep(ellP(425, 1120, 105, 80), true), C.oven, 9);
  });
  const ov = (t - 0.9) / 0.3; if (ov > 0) { fillP(ctx, prep(ellP(425, 1150, 40, 30), true), t > 0.9 ? C.glow : C.dark, 10); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(425, 1150, 0, 425, 1150, 120); g.addColorStop(0, 'rgba(255,170,80,0.25)'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(305, 1030, 240, 155); ctx.globalCompositeOperation = 'source-over'; }
  const lp = (t - 0.15) / 0.9;
  ink(ctx, prep([[-30, 1000], [300, 1000]]), lp, { seed: 12 }); ink(ctx, rect(300, 890, 250, 295), lp, { seed: 13 }); ink(ctx, prep(ellP(425, 1120, 105, 80, 0, 30), true), lp, { seed: 14 });
  ink(ctx, prep([[560, 810], [560, 1185]]), lp, { seed: 15 }); ink(ctx, rect(690, 990, 110, 195), lp, { seed: 16 }); ink(ctx, rect(900, 900, 80, 62), lp, { seed: 17 });
  // 屋檐瓦
  for (const [x0, x1, y, s0] of [[-30, 580, 780, 0], [560, 1110, 810, 0.3]]) { const k = (t - 0.3 - s0) / 0.5; if (k <= 0) continue; fillP(ctx, rect(x0, y - 22, x1 - x0, 26), C.tile, 18 + s0); const pts = []; for (let x = x0; x <= x1; x += 34) { pts.push([x, y + 4], [x + 17, y + 14]); } ink(ctx, prep(pts), k, { seed: 19 + s0, w: 4.5 }); ink(ctx, prep([[x0, y - 22], [x1, y - 22]]), k, { seed: 20 + s0 }); }
  // 人行道、路沿、街面、垫脚石
  reveal(ctx, 0.2, 0.8, () => { fillP(ctx, rect(-40, 1185, 1160, 140), C.side, 21); fillP(ctx, rect(-40, 1325, 1160, 640), C.road, 22); });
  ink(ctx, prep([[-30, 1185], [1110, 1185]]), (t - 0.1) / 0.6, { seed: 23 }); ink(ctx, prep([[-30, 1325], [1110, 1325]]), (t - 0.25) / 0.6, { seed: 24 });
  for (const j of SIDE_J) ink(ctx, j, (t - 0.6) / 0.3, { w: 3, col: '#8E8270', pen: false, seed: j[0][0] });
  PAVE.forEach((p, i) => { const k = (t - 0.5 - i * 0.008) / 0.3; if (k > 0) ink(ctx, p, k, { w: 3, col: '#8E8270', closed: true, pen: false, seed: i }); });
  STEPS.forEach(([x, y], i) => { const s = popS(t, 1.0 + i * 0.08); if (s) withScale(ctx, s, x, y + 30, () => shape(ctx, prep(ellP(x, y, 56, 30), true), C.stone, 25 + i)); });
  // 磨（驴拉的，沙漏形）
  const ms = popS(t, 0.95, 0.45); if (ms) withScale(ctx, ms, 110, GY, () => {
    shape(ctx, prep([[60, GY], [70, 1180], [150, 1180], [160, GY]], true), '#A39C93', 26);
    shape(ctx, prep([[50, 1060], [170, 1060], [130, 1120], [170, 1180], [50, 1180], [90, 1120]], true), '#B7B0A7', 27);
    const rot = t < T.tremor ? t * 1.7 : T.tremor * 1.7; ctx.save(); ctx.beginPath(); ctx.rect(50, 1060, 120, 120); ctx.clip(); ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const xx = 110 + Math.sin(rot + i * Math.PI / 3) * 60; if (Math.cos(rot + i * Math.PI / 3) > 0) { ctx.beginPath(); ctx.moveTo(xx, 1064); ctx.lineTo(xx * 0.6 + 110 * 0.4, 1120); ctx.lineTo(xx, 1176); ctx.stroke(); } } ctx.restore();
  });
  // 柜台 + 篮子里的面包
  const cs = popS(t, 1.1, 0.45); if (cs) withScale(ctx, cs, 570, GY, () => { shape(ctx, rect(510, 1170, 130, 130), C.wall, 28); shape(ctx, rect(500, 1160, 150, 18), '#C9A27A', 29); drawLoaf(ctx, 535, 1145, 0, 0.8); drawLoaf(ctx, 568, 1140, 0.2, 0.75); });
}

// ---------- 帧 ----------
function shake(t) { const a = 5 * sm((t - T.tremor) / 0.4) * (t < T.boom ? 1 : 0) + (t > T.boom ? 14 * Math.exp(-(t - T.boom) * 2.5) : 0) + (t > T.boom + 0.8 ? 3 : 0); return [(vn(t * 26, 1) - .5) * 2 * a, (vn(t * 29, 2) - .5) * 2 * a]; }
const LOAF_END = loafPath[loafPath.length - 1];
function camera(t) { const k = eio((t - T.zoom) / 1.7); return { s: lerp(1.3, 2.1, k), cx: lerp(560, LOAF_END[1] - 20, k), cy: lerp(1000, LOAF_END[2] - 330, k) }; }
function frame(ctx, t) {
  TIME = t; K = Math.floor(t * 12); const tq = Math.floor(t * 12) / 12;   // 角色姿势按一拍二取样
  ctx.drawImage(PAPER_TEX, 0, 0);
  const cam = camera(t), [sx, sy] = shake(t);
  ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
  drawBackground(ctx, t);
  for (const p of PIGEONS) if (popS(t, 1.3 + p.ph * 0.05)) drawPigeon(ctx, p, t);
  if (t > 1.4) drawCat(ctx, t);
  // 角色：按出场挤压弹出
  const pop = (t0, ax, fn) => { const s = popS(t, t0, 0.45); if (s) withScale(ctx, s, ax, GY, fn); };
  const dk = donkeyPose(tq); pop(1.15, dk.x, () => { const h = drawDonkey(ctx, dk); if (t < 5.4) ink(ctx, [[150, 1090], h.harness], 1, { w: 5, col: '#7A5A44', pen: false }); else if (t < 5.8) { ink(ctx, [[150, 1090], [180, 1120 + (t - 5.4) * 200]], 1, { w: 5, col: '#7A5A44', pen: false }); } });
  const bp = bakerPose(tq), bk = skeleton(bp, BAKER);
  const kp = kidPose(tq, bk.handN);
  const dp = dogPose(tq);
  // 前后顺序：跑起来以后，孩子在面包师身后
  const drawB = () => pop(1.3, bp.x, () => drawHuman(ctx, bp, BAKER)), drawK = () => pop(1.45, kp.x, () => drawHuman(ctx, kp, KID)), drawD = () => pop(1.6, dp.x, () => drawDog(ctx, dp));
  drawK(); drawB(); drawD();
  // 球
  if (t > T_THROW - 0.1 && t < T_CATCH) { const k = clamp((t - T_THROW) / (T_CATCH - T_THROW)); const p0 = skeleton(kidPose(Math.min(t, T_THROW), null), KID).handN; const x = lerp(p0[0], CATCH[0], k), y = lerp(p0[1], CATCH[1], k) - 150 * Math.sin(Math.PI * k); blob(ctx, x, y, 13, C.lava); }
  if (t > T.tremor + 0.1) { const a = t - T.tremor - 0.1; const bx = CATCH[0] - 30 - a * 160, by = Math.min(GY - 14, CATCH[1] + 30 + 900 * a * a); const bb = by >= GY - 14 ? (GY - 14) - Math.abs(Math.sin((a - 0.4) * 9)) * 40 * Math.exp(-(a - 0.4) * 3) : by; if (bx > 690) blob(ctx, bx, bb, 13, C.lava); else blob(ctx, 690, GY - 14, 13, C.lava); }
  const lf = loafAt(tq); if (lf) drawLoaf(ctx, lf[0], lf[1], lf[2], 1.15, clamp((t - 6.2) / 3) * 0.3);
  ctx.restore();
  // 天色变暗 + 落灰
  const dark = 0.45 * sm((t - 4.8) / 2.2);
  if (dark > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,132,120,${dark})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  if (t > T.ash) { ctx.strokeStyle = C.ash; ctx.fillStyle = C.ash; ctx.lineCap = 'round'; for (const a of ASH) { if (t < a.st) continue; const y = (a.y0 + (t - a.st) * a.sp) % 2000 - 60, x = a.x + (y + 60) * 0.16; ctx.globalAlpha = clamp((t - a.st) / 0.4) * 0.7; if (a.dot) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); } else { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a.len * 0.16, y + a.len); ctx.stroke(); } } ctx.globalAlpha = 1; }
  // 结尾文字：逐字写出
  if (t > T.text) {
    const write = (txt, x, y, font, t0, per, fill, strokeW) => { ctx.font = font; const ws = [...txt].map(c => ctx.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0); let cx = x - tot / 2; const fs = parseInt(font);
      [...txt].forEach((ch, i) => { const k = (t - t0 - i * per) / (per * 1.6); if (k > 0) { ctx.save(); ctx.beginPath(); const yy = y - fs + fs * 1.2 * eio(k); ctx.rect(cx - 8, y - fs - 10, ws[i] + 16, yy - (y - fs - 10)); ctx.clip(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#F6EEDF'; ctx.lineWidth = strokeW; ctx.strokeText(ch, cx, y); ctx.fillStyle = fill; ctx.fillText(ch, cx, y); ctx.restore(); } cx += ws[i]; }); };
    write('公元 79 年 · 庞贝', W / 2, 330, '96px Kai', T.text, 0.07, INK, 14);
    write('烤炉里的 81 个面包，留到了今天', W / 2, 425, '46px YaHeiB', T.text + 0.45, 0.03, INK, 10);
  }
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.1; ctx.drawImage(PAPER_TEX, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fade = Math.max(1 - t / 0.2, sm((t - 9.75) / 0.25)); if (fade > 0) { ctx.fillStyle = `rgba(239,230,214,${fade})`; ctx.fillRect(0, 0, W, H); }
}

function events() {
  const steps = []; const addSteps = (t0, t1, period, offsets, who, pan) => { for (const o of offsets) for (let n = 0; ; n++) { const tt = t0 + (n - o + 0.0) * period; if (tt > t1) break; if (tt >= t0) steps.push({ t: +tt.toFixed(3), who, pan }); } };
  addSteps(T.run, 5.7, 0.36, [0, 0.5], 'baker', 0.1); addSteps(5.95, 8.2, 0.32, [0, 0.5], 'baker', -0.3); addSteps(5.95, 8.25, 0.26, [0.25, 0.75], 'kid', -0.2); addSteps(6.15, 7.95, 0.24, [0, 0.15, 0.5, 0.65], 'dog', -0.2); addSteps(5.45, 7.1, 0.34, [0, 0.1, 0.5, 0.6], 'hoof', -0.6);
  const loafHits = []; for (let i = 1; i < loafPath.length - 1; i++) if (loafPath[i][2] >= loafPath[i - 1][2] && loafPath[i][2] > loafPath[i + 1][2] - 0.01 && loafPath[i + 1][2] < loafPath[i][2]) loafHits.push(+loafPath[i][0].toFixed(3));
  fs.writeFileSync(PATH.join(__dirname, 'street_events.json'), JSON.stringify({ ...T, pops: [0.95, 1.0, 1.08, 1.1, 1.15, 1.16, 1.3, 1.45, 1.6], throw: T_THROW, catch: T_CATCH, land: 2.74, claps: [2.875, 3.125], barks: [4.5, 4.78, 5.05, 5.35, 5.62, 5.9], heehaw: [3.6, T.boom + 0.1], pigeons: T.tremor + 0.05, cat: T.tremor + 0.25, loafHits: loafHits.slice(0, 5), steps }, null, 1));
}
const [mode, a1, a2, a3, a4] = process.argv.slice(2);
function sheet(times, out, tw = 360, th = 640, cols = 4) { cols = Math.min(cols, times.length); const sh = createCanvas(tw * cols, th * Math.ceil(times.length / cols)), sx = sh.getContext('2d'), cv = createCanvas(W, H), ctx = cv.getContext('2d');
  times.forEach((t, i) => { ctx.setTransform(1, 0, 0, 1, 0, 0); frame(ctx, t); sx.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillStyle = '#c00'; sx.font = '22px sans-serif'; sx.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26); }); fs.writeFileSync(out, sh.toBuffer('image/png')); }
if (mode === 'events') events();
else if (mode === 'stills') sheet(a1.split(',').map(Number), a2);
else if (mode === 'strip') { const ts = []; for (let t = +a1; t <= +a2 + 1e-6; t += +a3) ts.push(+t.toFixed(3)); sheet(ts, a4, 240, 427, 8); }
else if (mode === 'still') { const cv = createCanvas(W, H); frame(cv.getContext('2d'), +a1); fs.writeFileSync(a2, cv.toBuffer('image/png')); }
else if (mode === 'video') {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', a1], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0; const N = DUR * FPS;
  const write = () => { while (n < N) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; frame(ctx, n / FPS); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++; if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
  ff.on('close', c => console.log('done', c)); write();
}
