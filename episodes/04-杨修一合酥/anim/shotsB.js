// 布景 B 的分镜：9–11（相国府门，清晨）
'use strict';
const L = require('./lib');
const { C, NT, W, H, S_, eo, eio, backOut, prep, rectP, ink, fillP, solid, burst, glyph } = L;
const { clamp, lerp, add } = C;
const B = require('./setB');
const { cue, local, keys, figure, holdBefore, handW, headW, walkPose, camera, shakeAt, ev, stepTimes } = require('./stage');
const { CAO, YANG, WORKER } = require('./cast');
const RED = '#C8372D';
const GY = 1335;

// 工匠：一个在脚手架上敲，一个在地上扶木头
function workers(ctx, t, { hammer = 1, pull = 0, w = B.GATE.w } = {}) {
  const xr = B.GATE.cx + w / 2;
  const hk = Math.sin(t * 9) > 0.6 ? 1 : 0;
  figure(ctx, WORKER, { fN: [24, 0], fF: [-24, 0], lean: 0.04, hN: [80, -300 + 50 * hk * hammer], hF: [60, -220], look: [1, -0.4], brow: 0.4, elbowPref: [-0.5, 1] }, xr + 120, 960 + 10, -1, { scale: 1.0 });
  if (pull > 0) { // 两个工匠拉绳，把门柱往里拽
    for (const [x, dir] of [[90, 1], [990, -1]]) figure(ctx, WORKER, { fN: [36, 0], fF: [-40, 0], lean: -0.3 - 0.06 * Math.sin(t * 6), drop: 16, hN: [70, -200], hF: [50, -190], look: [1, 0], brow: -0.8, mouth: 0.4, elbowPref: [-0.5, 1] }, x, GY + 30, dir, { scale: 1.1 });
    for (const [x0, x1] of [[150, B.GATE.cx - w / 2 + 30], [930, xr - 30]]) ink(ctx, prep([[x0, GY - 230], [x1, B.GATE.top + 260]], false), 1, { seed: 1500 + x0, w: 5, col: '#8C6A45' });
  }
}

// ---------- 9：门帘掀开，变成一扇新修的大门（晨光） ----------
function s09(ctx, t) {
  const { u, d } = local(t, '09');
  camera(ctx, { x: 540, y: lerp(1000, 960, eio(u / d)), s: lerp(1.05, 1.0, eio(u / d)) });
  B.drawGate(ctx, t, {});
  workers(ctx, t, { hammer: 1 });
  // 帐篷门帘向两边掀开（承接上一镜的帐篷）
  const k = eio(clamp(u / 0.6));
  if (k < 1) { ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of [-1, 1]) { const ex = 540 + s * (540 * k + 10), P = prep([[540 + s * 2, -40], [ex + s * 600, -40], [ex + s * 600, H + 40], [ex, H + 40], [ex - s * 60, 960]], true);
      solid(ctx, P, NT.N('#D8C9A8', 0.3), { sh: NT.N('#C2AE86', 0.2), seed: 1510 + s, ink: NT.NIGHT_INK, lit: [-s * 20, 0] }); } }
  for (let i = 0; i < 4; i++) ev(local(t, '09').s.start + 0.4 + i * 0.7, 'hammer', 0.6);
  ev(local(t, '09').s.start, 'cloth', 0);
}
// ---------- 10：曹操在门上写了个红"活"，转身就走 ----------
function s10(ctx, t) {
  const { u, d, s } = local(t, '10'), tW = cue('10', '活', 'alive', 0.75), leave = tW + 0.35;
  camera(ctx, { x: lerp(560, 620, eio(u / d)), y: 1000, s: lerp(1.15, 1.25, eio(u / d)) });
  B.drawGate(ctx, t, {});
  workers(ctx, t, { hammer: 0.3 });
  // 红"活"写在右扇门上
  const xr = B.GATE.cx + B.GATE.w / 2 - B.GATE.post / 2;
  glyph(ctx, S_('huo'), xr - 62, 860, 110, RED, { s: clamp(backOut((t - (tW - 0.25)) / 0.3)), stroke: '#A8825B', gloss: L.LANG === 'en' && t > tW ? S_('gloss_huo') : '' });
  // 曹操：抬手写字（手到门上）→ 一甩袖子转身离开
  const X = 610, wr = keys([[tW - 0.9, 0], [tW - 0.3, 1], [tW + 0.05, 1], [leave, 0]])(t);
  let x = X, dir = 1, P, sx = 1, sy = 1;
  if (t < leave) P = { fN: [30, 0], fF: [-30, 0], lean: -0.04 * wr, hN: [lerp(60, 150, wr), lerp(-210, -330, wr) + 10 * Math.sin(t * 14) * wr], hF: [30, -180], look: [1, -0.5 * wr], brow: 0.3, smile: 0.1, elbowPref: [-0.5, 1] };
  else { const xf = tt => tt < leave ? X : X - 300 * Math.pow(clamp((tt - leave) / 1.6), 1.2); const w = walkPose(t, xf, leave, GY, -1, { period: 0.55, lift: 22 }); x = w.x; dir = -1;
    const k = clamp((t - leave) / 0.25); sx = lerp(0.8, 1, backOut(k)); P = Object.assign(w.P, { lean: 0.06, hN: [40, -170], hF: [-40, -190 + 30 * Math.sin(w.ph)], look: [1, 0], brow: 0, smile: 0.2, elbowPref: [-0.5, 1] }); }
  figure(ctx, CAO, P, x, GY, dir, { sx, sy, props: t < leave ? f => holdBefore(f, brush(add(f.joints.hN, [30, -24]), -0.9)) : null });
  ev(tW - 0.25, 'brush', 0.3); ev(leave, 'whoosh_small', -0.2);
}
// 毛笔（道具部件）
function brush(c, ang) { const T = v => add(c, C.rot(v, ang)); return [{ name: 'brush', P: C.limbPoly([T([0, 60]), T([0, 0]), T([0, -70])], [[0, 9], [0.8, 8], [1, 16]]).poly, col: '#8C6A45', seed: 1520, after: g => { g.fillStyle = '#232845'; g.beginPath(); const p = T([0, -80]); g.arc(p[0], p[1], 11, 0, 7); g.fill(); } }]; }

// ---------- 11（招牌镜头 1）：门框描成"门"字框，"活"被框进去 → "阔"；工匠把门拆窄 ----------
function s11(ctx, t) {
  const { u, d, s } = local(t, '11'), tKuo = cue('11', '阔', 'wide', 0.6), tPull = tKuo + 0.25;
  const w = lerp(B.GATE.w, 420, eio(clamp((t - tPull) / 1.4)));
  camera(ctx, { x: 540, y: 980, s: lerp(1.0, 1.04, eio(u / d)) }, shakeAt(t, tKuo, 6), t);
  B.drawGate(ctx, t, { w, scaffold: 0 });
  workers(ctx, t, { hammer: 0, pull: t > tPull ? 1 : 0, w });
  // 杨修在左边指着门（得意）
  const yk = backOut(clamp((u - 0.1) / 0.4));
  figure(ctx, YANG, { fN: [26, 0], fF: [-26, 0], lean: -0.06, hN: [lerp(60, 150, yk), lerp(-200, -330, yk)], hF: [30, -180], look: [1, -0.3], brow: 0.7, smile: 0.95, lid: 0.35, elbowPref: [-0.5, 1] }, 200, GY + 20, 1, { scale: 1.25 });
  // 拆字：门框（墨线）→"门"字；里面的"活"；合成"阔"
  const r = B.gateRect(w), cx = (r.x0 + r.x1) / 2;
  const mk = clamp((u - 0.3) / 0.6), merge = clamp((t - tKuo + 0.15) / 0.3);
  if (mk > 0 && merge < 1) { const a = 1 - merge;
    glyph(ctx, S_('men'), cx, 860, 700 * (0.8 + 0.2 * eo(mk)), '#2A2440', { alpha: 0.85 * mk * a, stroke: '#EFE6D6', gloss: L.LANG === 'en' ? S_('gloss_men') : '' });
    glyph(ctx, S_('huo'), cx + 30, 900 + (1 - eo(mk)) * -120, 260, RED, { s: 1, alpha: a, stroke: '#EFE6D6', gloss: L.LANG === 'en' ? S_('gloss_huo') : '' }); }
  if (merge > 0) glyph(ctx, S_('kuo'), cx, 870, 640 * lerp(1.15, 1, backOut(merge)), '#2A2440', { s: 1, alpha: Math.min(1, merge * 2) * (1 - clamp((t - tPull - 0.8) / 0.5) * 0.85), stroke: '#EFE6D6', gloss: L.LANG === 'en' ? S_('gloss_kuo') : '' });
  burst(ctx, cx, 860, t, tKuo, { n: 11, r0: 330, len: 60, spread: 0.57, col: '#2A2440' });
  ev(tKuo, 'ding', 0); ev(tPull, 'creak', 0); ev(tPull + 0.5, 'creak', 0.2); ev(tPull + 1.2, 'thud', 0);
}

module.exports = { '09': s09, '10': s10, '11': s11 };
Object.defineProperty(module.exports, 'brush', { value: brush, enumerable: false });
