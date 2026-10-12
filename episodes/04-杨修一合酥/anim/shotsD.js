// 布景 D 的分镜：22–24（秋天的院子）
'use strict';
const L = require('./lib');
const { C, NT, W, H, S_, eo, eio, backOut, prep, rectP, ink, fillP, solid, burst, glyph, slipLabel } = L;
const { clamp, lerp, ell } = C;
const D = require('./setD');
const { cue, local, keys, figure, walkPose, camera, shakeAt, ev, slipParts, stepTimes } = require('./stage');
const { YANG, SOLDIER } = require('./cast');
const RED = '#C8372D', GY = 1335;

// ---------- 22：秋天，两名兵士押着杨修走出画面；一片红色令签飘落在地 ----------
function s22(ctx, t) {
  const { u, d, s } = local(t, '22'), tDie = cue('22', '被处死', 'executed', 0.6);
  const nightK = clamp(u / d) * 0.25;
  camera(ctx, { x: 540, y: 980, s: 1.0 });
  D.drawYard(ctx, t, { night: nightK, lamp: 0 });
  D.leaves(ctx, t, 12, nightK);
  // 三个人从院门往左走出画面（不画行刑）
  const t0 = s.start - 0.2, xf = off => tt => lerp(820 + off, -420 + off, clamp((tt - t0) / (d + 0.6)));
  const walk = (spec, off, P, sc = 1.3) => { const w = walkPose(t, xf(off), t0, GY, -1, { period: 0.62, lift: 20 }); figure(ctx, spec, Object.assign(w.P, P), w.x, GY, -1, { scale: sc, oy: w.oy }); return w; };
  walk(SOLDIER, 330, { lean: 0.04, hN: [50, -200], hF: [-20, -180], look: [1, 0], brow: -0.8, smile: -0.2, elbowPref: [-0.5, 1] });
  walk(YANG, 120, { lean: 0.12, hN: [30, -150], hF: [10, -150], look: [0.6, 0.5], brow: 0.4, browAng: -0.4, smile: -0.1, lid: 0.45, elbowPref: [-0.5, 1] });
  walk(SOLDIER, -90, { lean: 0.04, hN: [50, -200], hF: [-20, -180], look: [1, 0], brow: -0.8, elbowPref: [-0.5, 1] });
  // 红色令签从上方飘下，落地
  const fk = clamp((t - (tDie - 1.0)) / 1.0), fx = 560 + 80 * Math.sin(fk * 6), fy = lerp(-80, GY + 40, eio(fk));
  C.renderFigure(ctx, fx, fy, 1, { parts: slipParts([0, 0], fk < 1 ? Math.sin(fk * 9) * 0.9 : Math.PI / 2 - 0.15, { txt: S_('slip_q'), txtCol: RED, seed: 60, w: 36, h: 140 }) }, { scale: 1, ground: false, box: [400, 400, 200, 200] });
  burst(ctx, 560, GY + 40, t, tDie, { n: 7, r0: 50, len: 30, dur: 0.35, w: 4 });
  ctx.setTransform(1, 0, 0, 1, 0, 0); slipLabel(ctx, 70, 250, S_('date_22'), t, s.start + 0.3, { size: 48, col: '#7A4F12' });
  for (const tt of stepTimes(t0, s.end, 0.62)) ev(tt, 'step', -0.3);
  ev(tDie, 'slip_land', 0); ev(tDie + 0.05, 'gong', 0);
}
// ---------- 23：夜，灯笼下杨修平静地苦笑 ----------
function s23(ctx, t) {
  const { u, d } = local(t, '23');
  camera(ctx, { x: lerp(520, 540, eio(u / d)), y: lerp(960, 900, eio(u / d)), s: lerp(1.7, 1.85, eio(u / d)) });
  D.drawYard(ctx, t, { night: 1, lamp: 1 });
  const light = { pos: D.LIGHT, k: 0.8, moon: D.MOON }, close = t > local(t, '23').s.start + 0.7;
  figure(ctx, YANG, { fN: [24, 0], fF: [-24, 0], lean: 0.02, hN: [40, -150], hF: [20, -150], look: [1, -0.1], blink: close ? 1 : 0, brow: 0.3, browAng: -0.5, smile: 0.45, elbowPref: [-0.5, 1] }, 430, GY - 10, 1, { scale: 1.35, light });
  D.leaves(ctx, t, 8, 1, { x0: 200, x1: 900, yTop: 500 });
}
// ---------- 24（互动钩子）：一片竹简"啪"地钉在院门上——杨修死于什么？ ----------
function s24(ctx, t) {
  const { u, s } = local(t, '24'), tNail = s.start + 0.25, tBubble = s.start + 1.4;
  camera(ctx, { x: 630, y: 940, s: lerp(1.15, 1.2, eio(clamp(u / 8))) }, shakeAt(t, tNail + 0.18, 7), t);
  D.drawYard(ctx, t, { night: 1, lamp: 1 });
  D.leaves(ctx, t, 10, 1);
  // 提问卡（屏幕坐标，安全区内：y 400–1300，x 80–900）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const k = clamp((t - tNail) / 0.18), cx = 490, cy = 820, w = 760, h = 640;
  if (k > 0) {
    ctx.save(); ctx.translate(cx, lerp(cy - 500, cy, eo(k))); ctx.rotate(lerp(-0.25, -0.03, eo(k)));
    if (k >= 1) { const sq = backOut(clamp((t - tNail - 0.18) / 0.25)); ctx.scale(lerp(1.08, 1, sq), lerp(0.9, 1, sq)); }
    // 竹简排成的牌子：一条条竹片 + 两道绳
    for (let i = 0; i < 9; i++) { const x = -w / 2 + i * w / 9; solid(ctx, rectP(x, -h / 2, w / 9 - 4, h), i % 2 ? '#DCC891' : '#D8C48A', { sh: '#BCA56C', seed: 2000 + i, lit: [6, -6], noShadow: i > 0 }); }
    for (const y of [-h * 0.34, h * 0.34]) ink(ctx, prep([[-w / 2 - 10, y], [w / 2 + 10, y + 6]], false), 1, { seed: 2010, w: 6, col: '#6B4A36' });
    // 钉子
    for (const x of [-w / 2 + 40, w / 2 - 40]) { ctx.fillStyle = '#4C4A4F'; ctx.beginPath(); ctx.arc(x, -h / 2 + 30, 12, 0, 7); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${L.LANG === 'zh' ? 76 : 62}px WenKai`; ctx.fillStyle = '#2A2440'; ctx.fillText(S_('q_title'), 0, -h * 0.17);
    const opt = (txt, y, col, t0) => { const p = clamp(backOut((t - t0) / 0.3)); if (p <= 0) return; ctx.save(); ctx.translate(0, y); ctx.scale(p, p);
      solid(ctx, rectP(-w * 0.38, -50, w * 0.76, 100), '#2C2A3A', { seed: 2020 + y, ink: '#141830' }); ctx.font = `${L.LANG === 'zh' ? 62 : 54}px ZenHei`; ctx.fillStyle = col; ctx.fillText(txt, 0, 4); ctx.restore(); };
    opt(S_('q_a'), h * 0.07, '#E8B04A', tNail + 0.35); opt(S_('q_b'), h * 0.26, '#9FE3B4', tNail + 0.5);
    ctx.restore();
    burst(ctx, cx, cy - h / 2, t, tNail + 0.18, { n: 9, r0: 60, len: 40, spread: 0.36 });
  }
  // 评论气泡：跳一下，指向右下方的评论按钮
  const bk = t - tBubble;
  if (bk > 0) { const hop = bk < 0.5 ? Math.sin(Math.PI * bk / 0.5) * 40 : 0, sc = clamp(backOut(bk / 0.3)), bx = 820, by = 1220 - hop;
    ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc);
    const P = prep([[-70, -50], [70, -50], [70, 40], [30, 40], [50, 80], [0, 40], [-70, 40]], true); solid(ctx, P, '#F3EBDD', { seed: 2030, ink: '#141830' });
    ctx.fillStyle = '#2A2440'; for (const dx of [-30, 0, 30]) { ctx.beginPath(); ctx.arc(dx, -5, 9, 0, 7); ctx.fill(); } ctx.restore(); }
  ev(tNail + 0.18, 'nail', 0); ev(tNail + 0.35, 'pop', -0.2); ev(tNail + 0.5, 'pop', 0.2); ev(tBubble, 'bubble', 0.6); ev(s.end + 0.2, 'bell_end', 0);
}

module.exports = { '22': s22, '23': s23, '24': s24 };
