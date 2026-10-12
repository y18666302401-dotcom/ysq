// 布景 C 的分镜：12–14（白天）、18、20、21（夜里）；19 在 shot19.js
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const L = require('./lib');
const { C, NT, W, H, S_, eo, eio, backOut, prep, rectP, ink, fillP, solid, burst, glyph, nameCard, slipLabel } = L;
const { clamp, lerp, add, ell } = C;
const SC = require('./setC');
const { cue, local, keys, figure, holdBefore, handW, headW, walkPose, camera, shakeAt, ev, slipParts } = require('./stage');
const { CAO, YANG, GUESTS, ZHI, PI, RUNNER } = require('./cast');
const RED = '#C8372D';
const CAO_X = 420, CAO_GY = 1372, CUP = [545, 1146];

const night = () => ({ pos: SC.LIGHT, k: 0.75, moon: SC.MOON });
const lightAt = (x, y) => ({ pos: SC.LIGHT, k: clamp(NT.falloff([x, y - 300], SC.LIGHT, 900) * 0.85), moon: SC.MOON });
// 跪坐在案后的曹操（只画案面以上）
function cao(ctx, t, P, { day = false, props = null } = {}) {
  return figure(ctx, CAO, Object.assign({ fN: [30, 0], fF: [-24, 0], hF: [40, -168], hN: [78, -170], elbowPref: [-0.5, 1] }, P), CAO_X, CAO_GY, 1, { light: day ? null : night(), clipY: SC.TABLE.front + 20, ground: false, props });
}
// 小案后跪坐的人（宾客 / 杨修 / 曹植）
function seated(ctx, spec, P, x, { day = true, dir = -1, table = true, scale = 1.25 } = {}) {
  const gy = 1440, top = 1280;
  const fig = figure(ctx, spec, Object.assign({ fN: [26, 0], fF: [-24, 0], hN: [60, -170], hF: [40, -175], elbowPref: [-0.5, 1] }, P), x, gy, dir, { scale, light: day ? null : lightAt(x, gy), clipY: top + 40, ground: false });
  if (table) { const c = day ? '#4A3834' : NT.N('#4A3834', 0.2); solid(ctx, prep([[x - 110, top], [x + 110, top], [x + 120, top + 24], [x - 120, top + 24]], true), c, { seed: 1600 + x % 9 }); solid(ctx, rectP(x - 112, top + 24, 224, 70), day ? '#3A2C2A' : NT.N('#3A2C2A', 0.15), { seed: 1601 + x % 9, lit: [0, -12] }); }
  return fig;
}
// 带盖的漆杯（酪）：lid = 盖子相对杯身的偏移；morph 0..1 = 变成一盒酥
function cup(ctx, x, y, { lid = [0, 0], lidRot = 0, morph = 0, day = true, label = '' } = {}) {
  const dc = c => day ? c : NT.N(c, 0.6);
  if (morph > 0) { const k = backOut(morph), sx = lerp(1, 1.6, k), sy = lerp(1, 0.75, k);
    ctx.save(); ctx.translate(x, y); ctx.scale(lerp(1.3, 1, clamp(morph * 2)) * (morph < 0.5 ? 1 : 1), 1);
    const P = rectP(-70 * sx, -90 * sy, 140 * sx, 90 * sy); solid(ctx, P, dc('#B8664A'), { sh: dc('#96503A'), seed: 1610, lit: [10, -6] });
    solid(ctx, rectP(-78 * sx, -100 * sy, 156 * sx, 22), dc('#8C4A34'), { seed: 1611 });
    for (const fx of [-0.3, 0.3]) ink(ctx, prep([[fx * 140 * sx, -100 * sy], [fx * 140 * sx, 0]], false), 1, { seed: 1612, w: 4, col: '#6B4A36' });
    if (label) { ctx.fillStyle = '#EFE3C4'; ctx.fillRect(-60, -70 * sy, 120, 46); ctx.strokeStyle = '#232845'; ctx.lineWidth = 3; ctx.strokeRect(-60, -70 * sy, 120, 46); ctx.fillStyle = '#2A2440'; ctx.font = '34px WenKai'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -70 * sy + 24); }
    ctx.restore(); return; }
  const body = prep([[x - 52, y - 70], [x + 52, y - 70], [x + 40, y - 6], [x + 26, y], [x - 26, y], [x - 40, y - 6]], true);
  solid(ctx, body, dc('#3A2C2A'), { sh: dc('#2A1F1E'), seed: 1615, lit: [12, -4] }); ink(ctx, prep([[x - 48, y - 52], [x + 48, y - 52]], false), 1, { seed: 1616, w: 4, col: dc('#C9A14A') });
  fillP(ctx, prep(ell(x, y - 70, 52, 12, 0, 24), true), '#F6F0E4', 1617);
  const lx = x + lid[0], ly = y - 76 + lid[1]; ctx.save(); ctx.translate(lx, ly); ctx.rotate(lidRot);
  solid(ctx, prep([[-58, 0], [58, 0], [44, -26], [-44, -26]], true), dc('#3A2C2A'), { seed: 1618, lit: [8, -4] }); solid(ctx, prep(ell(0, -30, 12, 8, 0, 14), true), dc('#C9A14A'), { seed: 1619, noShadow: true }); ctx.restore();
}
const LID_HE = (x, y) => [x, y - 96];

// ---------- 12：一杯酪送上来，曹操尝了一点，在盖上写了个红"合" ----------
function s12(ctx, t) {
  const { u, d, s } = local(t, '12'), tHe = cue('12', '合', 'together', 0.8);
  SC.setMode('day');
  camera(ctx, { x: lerp(620, 600, eio(u / d)), y: 1100, s: lerp(1.25, 1.32, eio(u / d)) });
  SC.drawRoom(ctx, t);
  seated(ctx, GUESTS[0], { look: [1, 0.2], brow: 0.2 }, 860, { dir: -1 }); seated(ctx, GUESTS[1], { look: [1, 0.1] }, 1030, { dir: -1 });
  // 仆人捧杯进来 → 放下 → 退出
  const put = s.start + 0.9;
  const xf = tt => tt < put ? lerp(1100, 680, eo(clamp((tt - s.start) / 0.9))) : lerp(680, 1150, eio(clamp((tt - put - 0.3) / 1.0)));
  if (t < put + 1.3) { const dir = t < put + 0.3 ? -1 : 1, w = walkPose(t, xf, s.start, 1440, dir, { period: 0.45, lift: 20 });
    figure(ctx, RUNNER, Object.assign(w.P, { lean: 0.1, hN: t < put ? [80, -190] : [40, -160], hF: t < put ? [70, -186] : [-20, -170], look: [1, 0.3], brow: 0.3, smile: 0.4, elbowPref: [-0.5, 1] }), w.x, 1440, dir, { scale: 1.3 }); }
  const cupX = t < put ? xf(t) - 110 : CUP[0], cupY = t < put ? 1190 : CUP[1];
  // 曹操：拿起盖子 → 舀一口尝 → 在盖上写字
  const taste = keys([[put + 0.4, 0], [put + 0.8, 1], [put + 1.4, 1], [put + 1.7, 0]])(t), write = keys([[tHe - 0.6, 0], [tHe - 0.3, 1], [tHe + 0.1, 1], [tHe + 0.4, 0]])(t);
  cao(ctx, t, { hN: [lerp(lerp(78, 110, write), 60, taste), lerp(lerp(-170, -160, write), -250, taste) + 8 * Math.sin(t * 14) * write], look: taste > 0.5 ? [0.3, -0.1] : [0.6, 0.6], brow: 0.3, mouth: taste > 0.5 ? 0.3 : 0, smile: taste > 0.9 ? 0.5 : 0.1, lid: taste > 0.5 ? 0.6 : 0.2 }, { day: true });
  SC.drawTable(ctx, t); SC.drawLamp(ctx, t);
  const lidOff = t > put + 0.3 ? [-130, 70] : [0, 0];
  cup(ctx, cupX, cupY, { lid: lidOff });
  const [hx, hy] = LID_HE(CUP[0] - 130, CUP[1] + 70); glyph(ctx, S_('he'), hx, hy + 40, 80, RED, { s: clamp(backOut((t - (tHe - 0.2)) / 0.3)), stroke: '#EFE6D6', gloss: L.LANG === 'en' && t > tHe ? S_('gloss_he') : '' });
  ev(put, 'thud_soft', 0.2); ev(put + 0.8, 'sip', -0.1); ev(tHe - 0.2, 'brush', -0.1);
}
// ---------- 13（招牌镜头 2）："合"弹起来拆成"人""一""口"；众人愣住，杨修一口吃下 ----------
function s13(ctx, t) {
  const { u, d, s } = local(t, '13'), tBite = cue('13', '人一口', 'one bite', 0.55), tSplit = tBite - 0.25;
  SC.setMode('day');
  camera(ctx, { x: 600, y: 1060, s: lerp(1.3, 1.38, eio(u / d)) }, shakeAt(t, tSplit, 5), t);
  SC.drawRoom(ctx, t);
  const puzzled = u > 0.3;
  seated(ctx, GUESTS[0], { look: [1, 0.3], brow: puzzled ? 1.4 : 0.2, mouth: puzzled ? 0.3 : 0, smile: -0.3 }, 880, { dir: -1 }); seated(ctx, GUESTS[1], { look: [1, 0.2], brow: puzzled ? -0.6 : 0, browAng: -0.8, smile: -0.4 }, 1050, { dir: -1 });
  cao(ctx, t, { look: [0.8, 0.4], brow: t > tBite + 0.3 ? -0.5 : 0.4, lid: t > tBite + 0.3 ? 0.45 : 0.2, smile: t > tBite + 0.3 ? -0.2 : 0.2 }, { day: true });
  SC.drawTable(ctx, t); SC.drawLamp(ctx, t);
  cup(ctx, CUP[0], CUP[1], { lid: [-130, 70] });
  // 杨修：从右边凑过来，舀一口吃下（得意）
  const reach = keys([[tBite - 0.7, 0], [tBite - 0.3, 1, 'out'], [tBite, 1], [tBite + 0.35, 0]])(t), chew = t > tBite ? Math.abs(Math.sin((t - tBite) * 14)) * Math.exp(-(t - tBite) * 2) : 0;
  figure(ctx, YANG, { fN: [26, 0], fF: [-26, 0], lean: lerp(0.08, 0.36, reach), drop: lerp(30, 50, reach), hN: [lerp(60, 150, reach), lerp(-200, -150, reach)], hF: [30, -180], look: [1, 0.4], brow: 0.6, smile: t > tBite ? 0.9 : 0.5, lid: 0.35, mouth: chew * 0.4, elbowPref: [-0.5, 1] }, 720, 1440, -1, { scale: 1.3 });
  // "合"弹起 → 拆成三块贴纸
  const [hx0, hy] = LID_HE(CUP[0] - 130, CUP[1] + 70), k = clamp((t - tSplit) / 0.45), up = eo(clamp((u - 0.1) / 0.5)), hx = lerp(hx0, 600, up);
  if (k <= 0) glyph(ctx, S_('he'), hx, hy + 52 - 200 * up, lerp(54, 150, up), RED, { stroke: '#EFE6D6', gloss: L.LANG === 'en' ? S_('gloss_he') : '' });
  else { const cx = hx, cy = hy + 52 - 200; [['ren', -150, -20], ['yi', 0, 30], ['kou', 150, -20]].forEach(([key, dx, dy], i) => glyph(ctx, S_(key), cx + dx * eo(k), cy + dy * eo(k) - 30 * Math.sin(Math.PI * k), 130, RED, { s: lerp(0.8, 1, backOut(k)), rot: (i - 1) * 0.12 * (1 - k), stroke: '#EFE6D6' }));
    if (L.LANG === 'en') { ctx.save(); ctx.font = '40px ZenHei'; ctx.textAlign = 'center'; ctx.lineWidth = 9; ctx.strokeStyle = '#14121c'; ctx.strokeText(S_('gloss_split'), cx, cy + 130); ctx.fillStyle = '#F3EBDD'; ctx.fillText(S_('gloss_split'), cx, cy + 130); ctx.restore(); }
    burst(ctx, cx, cy, t, tSplit, { n: 9, r0: 110, len: 46, spread: 0.7 }); }
  ev(tSplit, 'ding', 0); ev(tBite, 'gulp', 0.3);
}
// ---------- 14：杯子挤一挤，变成一盒"一合酥"；角上翻起一页小说 ----------
function s14(ctx, t) {
  const { u, d, s } = local(t, '14'), tBox = cue('14', '一合酥', 'pastry', 0.7) - 0.25;
  SC.setMode('day');
  camera(ctx, { x: 560, y: 1120, s: lerp(1.6, 1.75, eio(u / d)) });
  SC.drawRoom(ctx, t);
  cao(ctx, t, { look: [0.6, 0.6], brow: 0.2 }, { day: true });
  SC.drawTable(ctx, t); SC.drawLamp(ctx, t);
  const m = clamp((t - tBox) / 0.45);
  if (m <= 0) cup(ctx, CUP[0], CUP[1], { lid: [-130, 70] }); else cup(ctx, CUP[0], CUP[1], { morph: m, label: m > 0.6 ? S_('box') : '' });
  if (L.LANG === 'en' && m > 0.6) { ctx.save(); ctx.font = '34px ZenHei'; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#14121c'; ctx.strokeText(S_('gloss_box'), CUP[0], CUP[1] - 150); ctx.fillStyle = '#F3EBDD'; ctx.fillText(S_('gloss_box'), CUP[0], CUP[1] - 150); ctx.restore(); }
  burst(ctx, CUP[0], CUP[1] - 60, t, tBox + 0.1, { n: 8, r0: 100, len: 40, spread: 0.7 });
  // 屏幕右上角：一页线装书翻起，标签"小说"
  ctx.setTransform(1, 0, 0, 1, 0, 0); const pk = clamp((u - 0.2) / 0.5);
  if (pk > 0) { ctx.save(); ctx.translate(W, 180); ctx.rotate(-0.25 * (1 - eo(pk))); const pw = 300 * eo(pk);
    solid(ctx, prep([[0, 0], [-pw, 30], [-pw, 380], [0, 400]], true), '#EFE3C4', { sh: '#D9CBA6', seed: 1620, lit: [20, 0] });
    for (let i = 0; i < 5; i++) ink(ctx, prep([[-40 - i * 46, 70], [-40 - i * 46, 340]], false), 1, { seed: 1621 + i, w: 3, col: '#8C8577' }); ctx.restore();
    slipLabel(ctx, W - 260, 140, S_('novel_tag'), t, s.start + 0.55, { size: 44, col: '#7A4F12' }); }
  ev(tBox, 'squish', 0); ev(s.start + 0.2, 'page', 0.7);
}

// ---------- 18：夜里，杨修替曹植提前写好十几条答案 ----------
function stackOfSlips(ctx, x, y, n, lightK = 0.6) { for (let i = 0; i < n; i++) { const P = rectP(x - 70 + (i % 2) * 6, y - 14 - i * 9, 140, 12); fillP(ctx, P, NT.N('#D8C48A', lightK), 1700 + i); ink(ctx, P, 1, { seed: 1720 + i, closed: true, w: 2.5, col: NT.NIGHT_INK }); } }
function s18(ctx, t) {
  const { u, d, s } = local(t, '18'), tZhi = cue('18', '曹植', 'Cao Zhi', 0.5);
  SC.setMode('night');
  camera(ctx, { x: lerp(520, 560, eio(u / d)), y: 1060, s: 1.4 });
  SC.drawRoom(ctx, t);
  // 曹植站在旁边看
  figure(ctx, ZHI, { fN: [24, 0], fF: [-24, 0], lean: 0.12, hN: [40, -190], hF: [20, -200], look: [-1, 0.6], brow: 0.4, smile: 0.5, elbowPref: [-0.5, 1] }, 760, 1440, -1, { scale: 1.3, light: lightAt(760, 1440) });
  // 杨修跪坐在案后写（用曹操的位置）
  const wr = Math.sin(t * 12);
  figure(ctx, YANG, { fN: [30, 0], fF: [-24, 0], lean: 0.18, hN: [120 + 6 * wr, -170 + 4 * wr], hF: [70, -168], look: [0.5, 0.8], brow: 0.3, smile: 0.5, lid: 0.35, elbowPref: [-0.5, 1] }, CAO_X, CAO_GY, 1, { light: night(), clipY: SC.TABLE.front + 20, ground: false, props: f => holdBefore(f, require('./shotsB').brush(add(f.joints.hN, [26, -20]), -0.6)) });
  SC.drawTable(ctx, t); SC.drawLamp(ctx, t);
  const n = Math.min(12, Math.floor(clamp((u - 0.2) / Math.max(1.5, d - 0.6)) * 12 + 1));
  stackOfSlips(ctx, 560, 1160, n);
  ctx.setTransform(1, 0, 0, 1, 0, 0); nameCard(ctx, 640, 300, S_('name_zhi'), S_('sub_zhi'), t, tZhi);
  for (let i = 1; i < 12; i++) ev(s.start + 0.2 + i * Math.max(1.5, d - 0.6) / 12, 'slip_tick', -0.1);
}
// ---------- 20：快得反常——曹操眯眼，一把掀开箱子，一摞预写的答案哗啦散一地 ----------
const CHEST = [760, 1330];
function s20(ctx, t) {
  const { u, d, s } = local(t, '20'), tDig = cue('20', '一查', 'dug', 0.4), tOut = cue('20', '全露了', 'came out', 0.8) - 0.15;
  SC.setMode('night');
  camera(ctx, { x: lerp(500, 640, eio(clamp((t - tDig) / 0.6))), y: 1100, s: lerp(1.5, 1.35, eio(clamp((t - tDig) / 0.6))) }, shakeAt(t, tOut, 9), t);
  SC.drawRoom(ctx, t);
  const reach = keys([[tDig, 0], [tOut - 0.1, 1, 'out'], [tOut + 0.4, 0.6]])(t);
  cao(ctx, t, { hN: [lerp(78, 230, reach), lerp(-170, -150, reach)], lean: 0.2 * reach, look: reach > 0.3 ? [1, 0.6] : [0.6, 0.1], brow: -0.8, browAng: 0.9, lid: 0.5, squint: 0.35, smile: -0.3 });
  SC.drawTable(ctx, t); SC.drawLamp(ctx, t);
  // 一只木箱：盖子被掀开，竹简喷出来
  const open = clamp((t - tOut) / 0.2), c = CHEST;
  solid(ctx, rectP(c[0] - 110, c[1] - 120, 220, 120), NT.N('#7A5640', 0.45), { sh: NT.N('#5E412F', 0.35), seed: 1730, ink: NT.NIGHT_INK });
  ctx.save(); ctx.translate(c[0] - 110, c[1] - 120); ctx.rotate(-1.9 * eo(open)); solid(ctx, rectP(0, -26, 220, 26), NT.N('#6B4A36', 0.45), { seed: 1731, ink: NT.NIGHT_INK }); ctx.restore();
  if (t > tOut) for (let i = 0; i < 14; i++) { const k = t - tOut, a = -Math.PI / 2 + (i - 6.5) * 0.17, v = 700 + (i % 4) * 160, x = c[0] + Math.cos(a) * v * k, y = c[1] - 120 + Math.sin(a) * v * k + 1600 * k * k;
    const yy = Math.min(y, 1460 + (i % 5) * 18), rot = yy < 1460 ? k * 9 + i : i * 0.7;
    C.renderFigure(ctx, x, yy, 1, { parts: slipParts([0, 0], rot, { seed: 50 + i, txt: S_('slip_a'), w: 26, h: 104 }) }, Object.assign({ scale: 1, ground: false, box: [300, 300, 150, 150] }, NT.nightOpts({ x, gy: yy, dir: 1, light: SC.LIGHT, k: 0.4 }))); }
  burst(ctx, c[0], c[1] - 160, t, tOut, { n: 11, r0: 90, len: 60, spread: 0.45 });
  ev(tDig, 'hmm', -0.2); ev(tOut, 'crash_wood', 0.3); ev(tOut + 0.05, 'slips_scatter', 0.3);
}
// ---------- 21：屏风上墨线画出继承之争：曹操 → 曹丕 / 曹植；杨修连在曹植一边 ----------
function bust(ctx, spec, x, y, s, dir, P = {}) { // 圆框里的半身像（贴纸）
  ctx.save(); const r = 120 * s; fillP(ctx, prep(ell(x, y, r, r, 0, 36), true), NT.N('#E8DCC0', 0.4), 1740); ctx.save(); C.path(ctx, prep(ell(x, y, r, r, 0, 36), true)); ctx.clip();
  figure(ctx, spec, Object.assign({ fN: [24, 0], fF: [-24, 0], hN: [40, -180], hF: [20, -180], elbowPref: [-0.5, 1] }, P), x, y + 470 * s, dir, { scale: 1.6 * s, light: lightAt(x, y), ground: false }); ctx.restore();
  ink(ctx, prep(ell(x, y, r, r, 0, 36), true), 1, { seed: 1741, closed: true, col: NT.NIGHT_INK }); ctx.restore(); }
function s21(ctx, t) {
  const { u, d, s } = local(t, '21'), tZhi = cue('21', '曹植', 'Cao Zhi', 0.3), tPi = cue('21', '曹丕', 'Cao Pi', 0.6), tHeir = cue('21', '继承人', 'heir', 0.9);
  SC.setMode('night');
  camera(ctx, { x: 380, y: 860, s: lerp(1.85, 1.95, eio(u / d)) });
  SC.drawRoom(ctx, t);
  const NI = NT.NIGHT_INK, top = [380, 630], L_ = [250, 840], R_ = [510, 840];
  const line = (a, b, k, seed) => k > 0 && ink(ctx, prep([a, [a[0], (a[1] + b[1]) / 2], [b[0], (a[1] + b[1]) / 2], b], false), clamp(k), { seed, w: 6, col: NI });
  slipLabel(ctx, top[0], top[1] - 40, S_('name_cao'), t, s.start + 0.1, { size: 34, col: '#2A2440', anchor: 'center', drop: 40 });
  line([top[0], top[1] + 20], [L_[0], L_[1] - 120], (u - 0.3) / 0.5, 1750); line([top[0], top[1] + 20], [R_[0], R_[1] - 120], (u - 0.3) / 0.5, 1751);
  if (t > tZhi - 0.2) bust(ctx, ZHI, R_[0], R_[1], 0.5 * clamp(backOut((t - tZhi + 0.2) / 0.35)), -1, { look: [1, 0], brow: 0.3, smile: 0.4 });
  if (t > tPi - 0.2) bust(ctx, PI, L_[0], L_[1], 0.5 * clamp(backOut((t - tPi + 0.2) / 0.35)), 1, { look: [1, 0], brow: -0.7, smile: -0.2 });
  // 两兄弟中间：继承人（问号）
  if (t > tHeir - 0.3) { glyph(ctx, '?', top[0], 830, 90, NT.N('#E5483A', 0.6), { s: clamp(backOut((t - tHeir + 0.3) / 0.3)), stroke: '#EFE6D6', font: 'ZenHei' }); slipLabel(ctx, top[0], 890, S_('heir'), t, tHeir - 0.2, { size: 30, col: '#7A2A20', anchor: 'center', drop: 40 }); }
  // 杨修：一条墨线把他连到曹植一边
  const yk = clamp((t - (tZhi + 0.4)) / 0.4);
  if (yk > 0) { bust(ctx, YANG, R_[0] + 20, R_[1] + 170, 0.36 * backOut(yk), -1, { look: [1, -0.5], brow: 0.6, smile: 0.7 }); ink(ctx, prep([[R_[0] + 20, R_[1] + 125], [R_[0], R_[1] + 60]], false), yk, { seed: 1752, w: 5, col: NI }); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); nameCard(ctx, 90, 260, S_('name_pi'), S_('sub_pi'), t, tPi);
  ev(tZhi - 0.2, 'pop', 0.3); ev(tPi - 0.2, 'pop', -0.3); ev(tHeir - 0.3, 'ding_low', 0);
}

module.exports = { '12': s12, '13': s13, '14': s14, '18': s18, '20': s20, '21': s21 };
