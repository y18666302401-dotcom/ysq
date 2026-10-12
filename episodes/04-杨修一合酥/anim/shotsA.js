// 布景 A 的分镜：1–8、15–17
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const L = require('./lib');
const { C, NT, W, H, S_, eo, eio, backOut, prep, rectP, ink, fillP, solid, burst, slipLabel, nameCard, glyph } = L;
const { clamp, lerp, add } = C;
const A = require('./setA');
const ST = require('./stage');
const { cue, local, keys, figure, holdBefore, handW, headW, toLocal, walkPose, camera, shakeAt, ev, slipParts } = ST;
const { CAO, YANG, OFFICERS } = require('./cast');
const NI = NT.NIGHT_INK, RED = '#C8372D';
const EXT_LIGHT = (x, y) => ({ pos: A.FIRE, k: clamp(NT.falloff([x, y - 300], A.FIRE, 900) * 0.9 + 0.05), moon: [1960, 250] });

// ---------- 杨修小帐里（屏幕坐标；第 5–8、15 镜） ----------
// mode: 'pack'（叠衣服）| 'turn'（转身）| 'tie'（系包袱）| 'rib'（举鸡肋）
const BUNDLE = [700, 1300];
function yangInside(ctx, t, { mode = 'pack', u = 0, turnAt = 1e9, lamp = 1, ribAt = 1e9, officer = 0, d = 4 } = {}) {
  A.drawYangTentInterior(ctx, t, { lamp });
  const light = { pos: A.YLAMP, k: 0.85 * lamp + 0.05, moon: null };
  // 包袱（布包，系好前是摊开的布 + 一摞衣服）
  const tied = mode === 'tie' ? clamp((u - 0.5) / 1.2) : mode === 'rib' ? 1 : mode === 'turn' ? 0.3 : 0;
  const bx = BUNDLE[0], by = BUNDLE[1], NC = c => NT.N(c, 0.5 * lamp + 0.05);
  solid(ctx, prep([[bx - 170 + 80 * tied, by + 40], [bx + 170 - 80 * tied, by + 40], [bx + 120 - 40 * tied, by - 30 - 90 * tied], [bx - 120 + 40 * tied, by - 30 - 90 * tied]], true), NC('#5B7FA8'), { sh: NC('#476A90'), seed: 1001, ink: NI });
  if (tied > 0.6) { solid(ctx, prep([[bx - 30, by - 120], [bx, by - 170], [bx + 30, by - 120]], true), NC('#5B7FA8'), { seed: 1002, ink: NI }); }
  if (tied < 0.5) for (let i = 0; i < 3; i++) solid(ctx, rectP(bx - 90 + i * 6, by - 50 - i * 22, 180, 24), NC(['#E8DDC6', '#7C93A8', '#C9B48A'][i]), { seed: 1003 + i, ink: NI });
  // 竹简：墨字"归"（写好的、准备带走的）
  C.renderFigure(ctx, 420, 1255, 1, { parts: slipParts([0, 0], Math.PI / 2 - 0.1, { txt: S_('slip_home'), seed: 30 }) }, Object.assign({ scale: 1.2, ground: false, box: [400, 400, 200, 200] }, NT.nightOpts({ x: 420, gy: 1255, dir: 1, light: A.YLAMP, k: 0.7 * lamp })));
  // 杨修
  let dir = 1, sx = 1, sy = 1, P;
  const X = 470, GY = 1400;
  if (mode === 'pack') { const ph = Math.sin(u * 4); P = { fN: [30, 0], fF: [-26, 0], lean: 0.32 + 0.04 * ph, drop: 18, hN: [120, -150 + 10 * ph], hF: [96, -140 - 10 * ph], look: [0.6, 0.8], brow: 0.2, smile: 0.4, elbowPref: [-0.5, 1] }; dir = 1; }
  else if (mode === 'turn') { const k = clamp((t - turnAt) / 0.3); dir = k < 0.5 ? 1 : -1; dir = 1;
    if (t < turnAt) P = { fN: [30, 0], fF: [-26, 0], lean: 0.3, drop: 16, hN: [120, -150], hF: [96, -140], look: [0.6, 0.8], brow: 0.2, smile: 0.4, elbowPref: [-0.5, 1] };
    else { const b = backOut(k); sx = lerp(0.8, 1, b); sy = lerp(1.1, 1, b); P = { fN: [24, 0], fF: [-24, 0], lean: lerp(0.3, -0.04, eio(k)), drop: lerp(16, 0, k), hN: [70, -230], hF: [40, -200], look: [-0.6, 0.05], brow: 0.6, smile: 0.9, lid: 0.35, elbowPref: [-0.5, 1] }; } }
  else if (mode === 'tie') { const k = clamp((u - 0.4) / 1.2), pull = Math.sin(Math.min(1, k) * Math.PI * 3); P = { fN: [30, 0], fF: [-26, 0], lean: 0.26, drop: 14, hN: [130 + 14 * pull, -150 - 20 * pull], hF: [110 - 14 * pull, -160 - 10 * pull], look: k < 1 ? [0.7, 0.7] : [-0.3, 0.05], brow: 0.6, smile: 0.9, lid: 0.35, elbowPref: [-0.5, 1] }; }
  else { const k = backOut((t - ribAt) / 0.4); P = { fN: [24, 0], fF: [-24, 0], lean: -0.04, hN: [lerp(70, 110, clamp(k)), lerp(-200, -330, clamp(k))], hF: [30, -190], look: [-0.5, -0.6], brow: 0.8, smile: 0.7, lid: 0.3, elbowPref: [-0.6, 1] }; }
  const fig = figure(ctx, YANG, P, X, GY, dir, { scale: 1.5, sx, sy, light });
  if (mode === 'rib' && t > ribAt) { const h = handW(fig, X, GY, dir, 1.5); A.drawRib(ctx, h[0] + 10, h[1] - 70, 0.75 * clamp(backOut((t - ribAt) / 0.35)), -1.2, NT.N('#F1E6CC', 0.9), 'rgba(8,10,28,0.3)'); }
  // 将官从帐门探头进来（第 15 镜）
  if (officer > 0) { const ox = lerp(1250, 900, eo(officer)); figure(ctx, OFFICERS[1], { fN: [24, 0], fF: [-24, 0], lean: 0.24, hN: [60, -200], hF: [40, -180], look: [1, -0.2], brow: 1.2, mouth: 0.3, elbowPref: [-0.5, 1] }, ox, GY + 20, -1, { scale: 1.5, light }); }
  return fig;
}

// ---------- 1：线条画出山谷夜营 ----------
function s01(ctx, t) {
  const { u, d } = local(t, '01');
  camera(ctx, { x: lerp(1150, 1000, eio(u / d)), y: 1000, s: lerp(0.72, 0.8, eio(u / d)) });
  A.drawExterior(ctx, t, { reveal: u * 1.25, yangTent: g => { camera(g, { x: 540, y: 960, s: 1 }); yangInside(g, t, { mode: 'pack', u: u + 20 }); } });
  ctx.setTransform(1, 0, 0, 1, 0, 0); slipLabel(ctx, 70, 250, S_('date_01'), t, local(t, '01').s.start + 0.45, { size: 48, col: '#7A4F12' });
}
// ---------- 2：沙盘——南边插满刘备的旗，北边是回长安的山路 ----------
function s02(ctx, t) {
  const { u, d, s } = local(t, '02');
  const flags = clamp((t - cue('02', '刘备', 'Liu Bei', 0.4) + 0.3) / 0.8) * 2;
  A.drawSandTable(ctx, t, { cam: { cx: 540, cy: 900, s: lerp(1.14, 1.0, eo(u / 0.6)) }, flags, blocks: 0, route: clamp((t - cue('02', '进退两难', 'trapped', 0.7)) / 0.8), labels: 1, t0: s.start });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const S = A.sandFrame({ cx: 540, cy: 900, s: lerp(1.14, 1.0, eo(u / 0.6)) });
  const [lx, ly] = S(0.5, 0.97); slipLabel(ctx, lx, ly + 30, S_('map_liu'), t, cue('02', '刘备', 'Liu Bei', 0.4) + 0.2, { size: 40, col: '#3A6E9A', anchor: 'center' });
  const [cx, cy] = S(0.2, 0.5); slipLabel(ctx, cx, cy - 40, S_('map_cao'), t, s.start + 0.5, { size: 38, col: '#7A4F12', anchor: 'center' });
}
// ---------- 3：主帐里，曹操在令签上写下红字"鸡肋"，拍在案上 ----------
function s03(ctx, t) {
  const { u, d, s } = local(t, '03');
  const tW = cue('03', '鸡肋', 'Chicken', 0.8), slam = tW + 0.35;
  camera(ctx, { x: lerp(600, 640, eio(u / d)), y: 1060, s: lerp(1.45, 1.6, eio(u / d)) }, shakeAt(t, slam, 9), t);
  A.drawCaoTent(ctx, t);
  const light = { pos: A.CLAMP, k: 0.8, moon: null };
  // 曹操：近手拿着令签，写字时笔在动；念到"鸡肋"后把令签"啪"地拍到案上
  const lift = keys([[tW - 0.1, 0], [slam - 0.12, 1, 'out'], [slam, -0.3, 'lin'], [slam + 0.4, 0]])(t);
  const P = { fN: [30, 0], fF: [-24, 0], lean: 0.04 - 0.05 * lift, hN: [lerp(120, 150, lift), lerp(-210, -280, lift) + (lift < 0 ? 40 : 0)], hF: [70 + 8 * Math.sin(t * 9) * (t < tW ? 1 : 0), -200], look: [0.4, 0.7], brow: t > slam ? -0.8 : 0.2, smile: t > slam ? -0.3 : 0, elbowPref: [-0.5, 1] };
  const X = 520, GY = 1395;
  const fig = figure(ctx, CAO, P, X, GY, 1, { light, clipY: A.CT.front + 10, props: f => holdBefore(f, slipParts(add(f.joints.hN, [10, -40]), 0.08, { seed: 40, w: 46, h: 190 })) });
  // 红字一笔一笔出现在令签上（贴纸弹出）
  const h = handW(fig, X, GY, 1, 1.35), ch = ['鸡', '肋'];
  ch.forEach((c, i) => { const ti = tW - 0.5 + i * 0.25; glyph(ctx, c, h[0] + 14, h[1] - 108 + i * 64, 58, RED, { s: clamp(backOut((t - ti) / 0.25)), stroke: '#E3D19A', gloss: L.LANG === 'en' && i === 1 && t > tW ? 'chicken rib' : '' }); });
  A.drawCaoDesk(ctx, t);
  burst(ctx, h[0] + 20, h[1] - 40, t, slam, { n: 9, r0: 80, len: 50, col: NI });
  ev(slam, 'slap', 0); ev(tW - 0.5, 'brush', 0); ev(tW - 0.25, 'brush', 0);
}
// ---------- 4：营火边，令签在将官手里传来传去，人人一头问号 ----------
const OFF_X = [800, 970, 1330, 1500], OFF_DIR = [1, 1, -1, -1], OFF_GY = 1400;
function s04(ctx, t) {
  const { u, d, s } = local(t, '04');
  camera(ctx, { x: lerp(1120, 1180, eio(u / d)), y: 1120, s: 1.2 });
  const hop = clamp((u - 0.15) / Math.max(1.2, d - 0.8)) * 3;            // 令签从 0 号传到 3 号
  A.drawExterior(ctx, t, { yangTent: null, officers: (g, tt) => {
    for (let i = 0; i < 4; i++) { const x = OFF_X[i], dir = OFF_DIR[i], holder = Math.min(3, Math.floor(hop + 0.5)) === i;
      const seen = hop > i - 0.4, k = clamp((hop - i + 0.4) / 0.5);
      const P = { fN: [24, 0], fF: [-24, 0], lean: 0.04, hN: holder ? [70, -230] : [50, -150], hF: seen ? [40, -300 + 20 * Math.sin(tt * 6 + i)] : [30, -160], look: holder ? [0.4, -0.3] : [1, -0.1], brow: seen ? (i % 2 ? 1.6 : 0.6) : 0, browAng: seen && i % 2 === 0 ? -0.8 : 0, mouth: seen && i % 2 ? 0.5 : 0, smile: seen ? -0.5 : 0, elbowPref: [-0.5, 1] };
      const fig = figure(g, OFFICERS[i], P, x, OFF_GY, dir, { scale: 1.2, light: EXT_LIGHT(x, OFF_GY), props: holder ? f => holdBefore(f, slipParts(add(f.joints.hN, [8, -40]), 0.2, { txt: '鸡肋', txtCol: RED, seed: 41, w: 40, h: 150 })) : null });
      if (seen) { const hd = headW(fig, x, OFF_GY, dir, 1.2); glyph(g, '?', hd[0] + dir * 20, hd[1] - 120 - 10 * Math.sin(tt * 5 + i), 90, NT.N('#F3EBDD', 0.6), { s: clamp(backOut(k)), stroke: NI, font: 'ZenHei' }); } } } });
}
// ---------- 5：镜头横移过营帐，停在亮着灯的小帐：只有他在打包 ----------
function s05(ctx, t) {
  const { u, d } = local(t, '05'), k = eio(clamp(u / (d * 0.9)));
  camera(ctx, { x: lerp(1180, 1640, k), y: lerp(1150, 1120, k), s: lerp(1.3, 2.2, k * k) });
  A.drawExterior(ctx, t, { yangTent: g => { camera(g, { x: 540, y: 960, s: 1 }); yangInside(g, t, { mode: 'pack', u }); } });
}
// ---------- 6：杨修转过身来（名牌） ----------
function s06(ctx, t) {
  const { u, d, s } = local(t, '06'), turnAt = cue('06', '杨修', 'Yang', 0.1) - 0.15;
  camera(ctx, { x: 560, y: 1000, s: lerp(1.0, 1.08, eio(u / d)) });
  yangInside(ctx, t, { mode: 'turn', u, turnAt });
  ctx.setTransform(1, 0, 0, 1, 0, 0); nameCard(ctx, 640, 330, S_('name_yang'), S_('sub_yang'), t, turnAt + 0.2);
  ev(turnAt, 'whoosh_small', 0);
}
// ---------- 7：系紧包袱，挑眉一笑 ----------
function s07(ctx, t) {
  const { u, d } = local(t, '07');
  camera(ctx, { x: 600, y: 1080, s: lerp(1.25, 1.35, eio(u / d)) });
  yangInside(ctx, t, { mode: 'tie', u });
  ev(local(t, '07').s.start + 1.6, 'pop', 0.1);
}
// ---------- 8：拉远到帐外：主帐里曹操的影子越来越大，小帐里的灯被风吹灭 ----------
function s08(ctx, t) {
  const { u, d } = local(t, '08'), tOut = cue('08', '几个月', 'months', 0.7);
  const k = eio(clamp(u / (d * 0.7)));
  camera(ctx, { x: lerp(1640, 1140, k), y: lerp(1120, 1000, k), s: lerp(2.2, 0.8, k) });
  const lamp = t < tOut ? 1 : Math.max(0, 1 - (t - tOut) / 0.35);
  A.drawExterior(ctx, t, { yangLamp: lamp, shadowCao: clamp((u - 0.3) / 1.6), yangTent: g => { camera(g, { x: 540, y: 960, s: 1 }); yangInside(g, t, { mode: 'tie', u: 9, lamp }); } });
  ev(tOut, 'silence', 0); ev(tOut + 0.3, 'bell_low', 0);
}
// ---------- 15：回到汉中——杨修举起一根没肉的鸡肋 ----------
function s15(ctx, t) {
  const { u, d } = local(t, '15'), ribAt = cue('15', '鸡肋', 'chicken', 0.3) - 0.1;
  camera(ctx, { x: 600, y: 1000, s: lerp(1.0, 1.1, eio(u / d)) });
  yangInside(ctx, t, { mode: 'rib', u, ribAt, officer: clamp((u - 0.3) / 0.8) });
  ev(ribAt, 'pop', -0.1);
}
// ---------- 16：鸡肋压在沙盘上和汉中重合；五月，曹军木块沿山路撤回长安 ----------
function s16(ctx, t) {
  const { u, d, s } = local(t, '16'), tHz = cue('16', '汉中', 'Hanzhong', 0.2), tMay = cue('16', '五月', 'May', 0.6), tOut = cue('16', '撤军', 'pulled', 0.85);
  const cam = { cx: 540, cy: 900, s: lerp(1.05, 1.0, eio(u / d)) };
  A.drawSandTable(ctx, t, { cam, flags: 2, rib: clamp((t - (tHz - 0.45)) / 0.4), route: clamp((t - (tMay - 0.3)) / 0.6), blocks: clamp((t - (tOut - 0.5)) / 1.2), labels: 1, t0: s.start - 1 });
  ctx.setTransform(1, 0, 0, 1, 0, 0); slipLabel(ctx, 80, 250, S_('date_16'), t, tMay, { size: 52, col: '#7A4F12' });
  ev(tHz - 0.45, 'thud', 0); ev(tMay, 'pop', -0.3); for (let i = 0; i < 4; i++) ev(tOut - 0.5 + i * 0.25, 'block', 0);
  return cam;
}
// ---------- 17：镜头后退——原来是一本《三国演义》里的插图，书"啪"地合上 ----------
const PAGE_CV = createCanvas(W, H), PAGE_CTX = PAGE_CV.getContext('2d');
function s17(ctx, t) {
  const { u, d, s } = local(t, '17'), tClose = cue('17', '演义', 'novel', 0.7) + 0.1;
  // 书页上的插图：第 16 镜结束时的画面
  const t16 = local(t, '16').s.end - 0.01; PAGE_CTX.setTransform(1, 0, 0, 1, 0, 0); s16(PAGE_CTX, t16); PAGE_CTX.setTransform(1, 0, 0, 1, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.PAPER_TEX, 0, 0);
  const cool = clamp((t - tClose) / 0.6);
  fillP(ctx, rectP(-40, -40, W + 80, H + 80), NT.N('#6B4A36', 0.25 - 0.2 * cool), 1101);           // 书桌
  for (let i = 0; i < 8; i++) ink(ctx, prep([[-40, 200 + i * 230], [W + 40, 210 + i * 230]], false), 1, { seed: 1102 + i, col: NT.N('#4A3222', 0.1), w: 3 });
  const k = eio(clamp(u / 1.1)), pw = lerp(W, 470, k), ph = lerp(H, 840, k), cx = lerp(W / 2, 540 + 235, k), cy = lerp(H / 2, 880, k);
  const spine = 540, top = 880 - 420;
  // 左页：竖排的字行（不写具体文字，只画行）
  if (k > 0.05) { const lp = prep([[spine - 470, top], [spine, top + 10], [spine, top + 850], [spine - 470, top + 840]], true);
    solid(ctx, lp, '#EFE3C4', { sh: '#D9CBA6', seed: 1110, lit: [-20, 0] }); for (let i = 0; i < 9; i++) ink(ctx, prep([[spine - 60 - i * 46, top + 80], [spine - 60 - i * 46, top + 760]], false), 1, { seed: 1111 + i, w: 4, col: '#8C8577' });
    ink(ctx, prep([[spine - 440, top + 40], [spine - 440, top + 800]], false), 1, { seed: 1120, w: 3, col: '#B8664A' }); }
  // 右页（插图）：合上时以书脊为轴翻到左边
  const close = clamp((t - (tClose - 0.35)) / 0.35), flip = Math.cos(Math.PI * close);   // 1 → -1
  ctx.save(); ctx.translate(spine, 0); ctx.scale(Math.abs(flip) < 0.02 ? 0.02 : flip, 1); ctx.translate(-spine, 0);
  if (flip > 0) { ctx.drawImage(PAGE_CV, cx - pw / 2, cy - ph / 2, pw, ph); if (k > 0.05) ink(ctx, rectP(cx - pw / 2, cy - ph / 2, pw, ph), 1, { closed: true, seed: 1121 }); }
  else { solid(ctx, rectP(spine, top - 10, 480, 870), '#3E5A7A', { sh: '#2F4862', seed: 1122, lit: [20, 0] }); }
  ctx.restore();
  // 合上后的封面：书名签
  if (close >= 1) { const cv = prep([[spine - 480, top - 10], [spine, top - 10], [spine, top + 860], [spine - 480, top + 860]], true);
    solid(ctx, cv, NT.N('#3E5A7A', 0.6 - 0.4 * cool), { sh: NT.N('#2F4862', 0.5), seed: 1123 });
    for (let i = 0; i < 4; i++) ink(ctx, prep([[spine - 30, top + 60 + i * 230], [spine + 4, top + 60 + i * 230]], false), 1, { seed: 1124 + i, w: 5, col: '#E8DDC6' });
    const title = S_('book_title'); ctx.save(); ctx.translate(spine - 380, top + 60); solid(ctx, rectP(0, 0, 90, 560), '#EFE3C4', { seed: 1130, noShadow: true });
    ctx.fillStyle = '#2A2440'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (L.LANG === 'zh') { ctx.font = '66px WenKai'; [...title].forEach((c, i) => ctx.fillText(c, 45, 80 + i * 110)); } else { ctx.save(); ctx.translate(45, 280); ctx.rotate(Math.PI / 2); ctx.font = '34px WenKai'; ctx.fillText(title, 0, 0); ctx.restore(); }
    ctx.restore(); burst(ctx, spine - 240, top + 430, t, tClose, { n: 11, r0: 300, len: 70, dur: 0.45, spread: 0.55, col: '#2A2440' }); }
  // 冷下来：从这里开始一路变冷变暗
  if (cool > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,160,190,${0.35 * cool})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  ev(tClose, 'book_slam', 0); ev(tClose - 0.35, 'page', 0.2);
}

module.exports = { '01': s01, '02': s02, '03': s03, '04': s04, '05': s05, '06': s06, '07': s07, '08': s08, '15': s15, '16': s16, '17': s17 };
