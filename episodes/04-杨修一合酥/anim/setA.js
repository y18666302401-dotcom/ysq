// 布景 A · 汉中军营（夜）
//   外景：层叠山脊（远山上有刘备的火把）/ 木栅、旗 / 主帐（里面亮着灯）、杨修的小帐（门帘掀开）、营火 / 拒马
//   内景：主帐里的沙盘和曹操的案（信息画面画在沙盘上）；杨修小帐里（灯、包袱、竹简）
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const L = require('./lib');
const { C, NT, W, H, prep, rectP, ink, fillP, solid, S_, eo, eio, backOut, slipLabel } = L;
const { clamp, lerp, jit, path, ell, smooth } = C;
const { N, NIGHT_INK: NI, pool, flame, halo, nightSky, moonDisc } = NT;
const INKT = require('./inkText');

const WW = 2400, HOR = 1150;
const MAIN = { x: 640, base: 1190, w: 560, h: 430 };
const YT = { x: 1640, base: 1240, w: 420, h: 340 };          // 杨修小帐
const FIRE = [1150, 1330];
const MOON = [1960, 250];

// 山脊：一组控制点 → 平滑曲线；seed 决定形状
function ridge(y0, amp, n, seed) { const P = [[-300, y0]]; let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < n; i++) { const x = -300 + (WW + 600) * (i + 0.5) / n; P.push([x - 40, y0 - amp * (0.15 + 0.2 * rnd())]); P.push([x + 30 * (rnd() - 0.5), y0 - amp * (0.55 + 0.45 * rnd())]); }
  P.push([WW + 300, y0]); return smooth(P, false, 2); }
const R1 = ridge(900, 620, 7, 3), R2 = ridge(1020, 420, 9, 7), R3 = ridge(1110, 240, 12, 11);
const TORCH = [180, 470, 820, 1130, 1480, 1790, 2120].map(x => R2.reduce((b, p) => Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b));

function tentShape(c, base, w, h) { return prep([[c - w / 2, base], [c - w * 0.36, base - h * 0.62], [c - w * 0.06, base - h], [c + w * 0.06, base - h], [c + w * 0.36, base - h * 0.62], [c + w / 2, base]], true); }

// 杨修小帐的内景（屏幕尺寸绘制；外景里缩小后贴进门帘开口）
const YT_CV = createCanvas(W, H), YT_CTX = YT_CV.getContext('2d');
function drawExterior(ctx, t, { reveal = 1e9, yangTent = null, shadowCao = 0, yangLamp = 1, officers = null } = {}) {
  // reveal：开场"线条画出来"的进度（秒），之前的物件按出场先后画线、再铺色
  const lp = t0 => clamp((reveal - t0) / 0.6), fk = t0 => clamp((reveal - t0 - 0.35) / 0.5);
  ctx.fillStyle = NT.SKY[0]; ctx.fillRect(-2000, -3000, WW + 4000, HOR + 3000);
  ctx.save(); ctx.translate(-300, 0); nightSky(ctx, WW + 600, HOR, t, { stars: 90, seed: 4 }); ctx.restore();
  ctx.fillStyle = N('#8C7A5E', 0.02); ctx.fillRect(-2000, HOR, WW + 4000, 3000);
  if (fk(0) > 0) { ctx.save(); ctx.globalAlpha = fk(0); moonDisc(ctx, MOON[0], MOON[1], 70, NI); ctx.restore(); }
  const layer = (R, col, seed, t0, bottom = HOR + 40) => { const P = R.concat([[WW + 300, bottom], [-300, bottom]]);
    if (fk(t0) > 0) { ctx.save(); ctx.beginPath(); const Y = bottom - (bottom - 200) * eio(fk(t0)); ctx.rect(-400, Y, WW + 800, 2000); ctx.clip(); fillP(ctx, P, col, seed); ctx.restore(); }
    ink(ctx, R, lp(t0), { seed, col: NI }); };
  layer(R1, N('#7E8FA8', 0), 21, 0.0); layer(R2, N('#6E8A78', 0), 22, 0.15); layer(R3, N('#5E7A64', 0), 23, 0.3);
  // 远山上刘备的火把：一串暖色小点
  if (fk(0.3) > 0) for (const [i, p] of TORCH.entries()) { ctx.save(); ctx.globalAlpha = fk(0.3); flame(ctx, p[0], p[1] - 8, 0.35, t + i, i, NI); NT.halo(ctx, p[0], p[1] - 14, 30, 'rgba(255,190,90,A)', [0.2, 0.25]); ctx.restore(); }
  // 地面
  const gnd = prep([[-100, HOR], [WW + 100, HOR], [WW + 100, 2000], [-100, 2000]], true);
  if (fk(0.4) > 0) { fillP(ctx, gnd, N('#8C7A5E', 0.02), 31); pool(ctx, FIRE[0], FIRE[1] + 10, 520, 170, 'rgba(255,160,70,A)', [0.08, 0.1, 0.13], 32); }
  ink(ctx, prep([[-100, HOR], [WW + 100, HOR]], false), lp(0.4), { seed: 31, col: NI });
  // 连营：木栅后面远处的一排小帐篷
  for (let i = 0; i < 16; i++) { const x = -100 + i * 165 + (i % 2) * 40, b = HOR + 4, w = 120 + (i % 3) * 20, h = 90 + (i % 2) * 20; const P = tentShape(x, b, w, h);
    if (fk(0.45) > 0) solid(ctx, P, N('#C2B494', 0.02 + 0.5 * NT.falloff([x, b], FIRE, 700)), { seed: 80 + i, ink: NI, w: 4, noShadow: true }); ink(ctx, P, lp(0.45), { seed: 80 + i, col: NI, w: 4, closed: true }); }
  // 木栅 + 旗
  for (let x = -60; x < WW + 60; x += 46) { const P = prep([[x, HOR + 14], [x, HOR - 70 - (x % 92 ? 0 : 14)], [x + 22, HOR - 82 - (x % 92 ? 0 : 14)], [x + 22, HOR + 14]], true); if (fk(0.5) > 0) fillP(ctx, P, N('#7A5640', 0.02), 40 + x % 7); ink(ctx, P, lp(0.5), { seed: 40 + (x % 13), col: NI, w: 4, closed: true }); }
  for (const fx of [260, 1260, 2150]) { const sway = Math.sin(t * 2.2 + fx) * 10; ink(ctx, prep([[fx, HOR + 10], [fx, HOR - 420]], false), lp(0.6), { seed: fx, col: NI, w: 7 });
    const F = prep([[fx, HOR - 420], [fx + 170 + sway, HOR - 400 + sway * 0.5], [fx + 160 + sway * 1.3, HOR - 300], [fx, HOR - 310]], true);
    if (fk(0.6) > 0) { solid(ctx, F, N('#2C2A3A', 0.05), { seed: fx + 1, ink: NI }); const fq = [[fx + 30, HOR - 405 + sway * 0.12], [fx + 140 + sway * 0.9, HOR - 393 + sway * 0.4], [fx + 134 + sway * 1.1, HOR - 312], [fx + 30, HOR - 318]]; INKT.writeOn(ctx, '曹', fq, { col: N('#C9A14A', 0.3), clip: F, seed: fx, vertical: false, absorb: 0.2 }); } }   // 字随旗面摆动 }
  // 主帐：里面亮灯，帆布透出暖光
  const mt = tentShape(MAIN.x, MAIN.base, MAIN.w, MAIN.h);
  if (fk(0.7) > 0) { solid(ctx, mt, N('#D8C9A8', 0.75), { sh: N('#C2AE86', 0.45), seed: 51, ink: NI, lit: [-30, 0] });
    for (const u of [-0.25, 0, 0.25]) ink(ctx, prep([[MAIN.x + u * MAIN.w * 0.2, MAIN.base - MAIN.h], [MAIN.x + u * MAIN.w, MAIN.base]], false), 1, { seed: 52 + u * 9, col: N('#A08860', 0.4), w: 3 });
    const door = prep([[MAIN.x - 70, MAIN.base], [MAIN.x, MAIN.base - 250], [MAIN.x + 70, MAIN.base]], true); fillP(ctx, door, '#F3C46A', 53); ink(ctx, door, 1, { seed: 53, col: NI, closed: true });
    // 曹操的影子投在帆布上（第 8 镜）
    if (shadowCao > 0) { ctx.save(); path(ctx, mt); ctx.clip(); ctx.globalAlpha = 0.55 * shadowCao; ctx.fillStyle = '#2A1E1C';
      const sx = MAIN.x + 120, sy = MAIN.base - 60, s = 1.0 + 0.25 * shadowCao;
      path(ctx, smooth([[sx - 110 * s, sy], [sx - 90 * s, sy - 200 * s], [sx - 60 * s, sy - 260 * s], [sx - 30 * s, sy - 330 * s], [sx - 50 * s, sy - 380 * s], [sx - 20 * s, sy - 430 * s], [sx + 10 * s, sy - 440 * s], [sx + 30 * s, sy - 520 * s], [sx + 70 * s, sy - 500 * s], [sx + 50 * s, sy - 420 * s], [sx + 60 * s, sy - 380 * s], [sx + 40 * s, sy - 330 * s], [sx + 90 * s, sy - 250 * s], [sx + 120 * s, sy]], true, 2)); ctx.fill(); ctx.restore(); }
  }
  ink(ctx, mt, lp(0.7), { seed: 51, col: NI, closed: true });
  // 杨修小帐：门帘掀开，里面是缩小的内景
  const yt = tentShape(YT.x, YT.base, YT.w, YT.h), op = prep([[YT.x - 120, YT.base], [YT.x - 10, YT.base - YT.h * 0.82], [YT.x + 110, YT.base]], true);
  if (fk(0.8) > 0) {
    solid(ctx, yt, N('#D8C9A8', 0.3 * yangLamp + 0.05), { sh: N('#C2AE86', 0.15), seed: 61, ink: NI, lit: [-24, 0] });
    if (yangTent) { YT_CTX.setTransform(1, 0, 0, 1, 0, 0); YT_CTX.drawImage(L.PAPER_TEX, 0, 0); yangTent(YT_CTX, t); YT_CTX.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); path(ctx, op); ctx.clip(); const sc = OPEN.s; ctx.drawImage(YT_CV, OPEN.x - W / 2 * sc, OPEN.y - H / 2 * sc, W * sc, H * sc); ctx.restore(); }
    else fillP(ctx, op, '#3A2A28', 62);
    ink(ctx, op, 1, { seed: 63, col: NI, closed: true });
    const flapL = prep([[YT.x - 10, YT.base - YT.h * 0.82], [YT.x - 120, YT.base], [YT.x - 170, YT.base - 40], [YT.x - 60, YT.base - YT.h * 0.6]], true);
    solid(ctx, flapL, N('#C2AE86', 0.2), { seed: 64, ink: NI, noShadow: true });
  }
  ink(ctx, yt, lp(0.8), { seed: 61, col: NI, closed: true });
  // 营火 + 坐着的将官（第 4 镜才有）
  if (fk(0.9) > 0) { const logs = [[FIRE[0] - 60, FIRE[1] + 20, FIRE[0] + 60, FIRE[1] - 6], [FIRE[0] - 60, FIRE[1] - 6, FIRE[0] + 60, FIRE[1] + 20]];
    for (const [a, b, c, d] of logs) solid(ctx, C.limbPoly([[a, b], [(a + c) / 2, (b + d) / 2], [c, d]], [[0, 22], [1, 20]]).poly, N('#6B4A36', 0.8), { seed: 70 + a % 5, ink: NI });
    flame(ctx, FIRE[0], FIRE[1] - 10, 1.9, t, 5, NI); flame(ctx, FIRE[0] + 26, FIRE[1] - 2, 1.1, t + 0.4, 6, NI); halo(ctx, FIRE[0], FIRE[1] - 40, 150); }
  if (officers) officers(ctx, t);
  // 前景：拒马
  if (fk(1.0) > 0) for (const bx of [80, 900, 1900]) { for (const a of [-0.6, 0.6]) solid(ctx, C.limbPoly([[bx - 90, 1720 + a * 30], [bx, 1640], [bx + 90 + a * 20, 1560]], [[0, 22], [1, 14]]).poly, N('#5E412F', 0.02), { seed: bx + a * 10, ink: NI }); solid(ctx, rectP(bx - 120, 1650, 240, 26), N('#6B4A36', 0.02), { seed: bx + 3, ink: NI }); }
}
// 杨修小帐门帘开口在外景里的位置：内景画布中心贴到这里，缩放 s
const OPEN = { x: YT.x - 5, y: YT.base - 130, s: 0.13 };

// ---------- 杨修小帐内景（屏幕坐标） ----------
const YLAMP = [300, 1010];
function drawYangTentInterior(ctx, t, { lamp = 1 } = {}) {   // 调用方先设好镜头
  const kk = (x, y) => clamp(0.05 + Math.pow(NT.falloff([x, y], YLAMP, 900), 1.2) * 0.95 * lamp);
  const NC = (c, x, y) => N(c, kk(x, y));
  fillP(ctx, rectP(-600, -600, W + 1200, 3200), NC('#D8C9A8', 540, 700), 401);
  for (let i = -3; i <= 3; i++) ink(ctx, prep([[540 + i * 60, -40], [540 + i * 300, 1250]], false), 1, { seed: 402 + i, col: N('#A08860', 0.4 * lamp), w: 3 });
  if (lamp > 0.05) pool(ctx, YLAMP[0], YLAMP[1], 560, 520, 'rgba(255,170,80,A)', [0.06 * lamp, 0.08 * lamp, 0.1 * lamp], 403);
  fillP(ctx, rectP(-600, 1250, W + 1200, 1400), NC('#8C7A5E', 540, 1300), 404); ink(ctx, prep([[-40, 1250], [W + 40, 1250]], false), 1, { seed: 405, col: NI });
  solid(ctx, prep([[120, 1280], [960, 1280], [1040, 1430], [40, 1430]], true), NC('#C9B07A', 540, 1340), { sh: NC('#AC955F', 540, 1340), seed: 406, ink: NI, noShadow: true });
  // 小木箱 + 灯
  solid(ctx, rectP(170, 1080, 260, 180), NC('#7A5640', 300, 1150), { sh: NC('#5E412F', 300, 1150), seed: 407, ink: NI });
  solid(ctx, rectP(YLAMP[0] - 8, YLAMP[1] + 10, 16, 70), N('#9C8A5A', 0.9 * lamp + 0.05), { seed: 408, ink: NI, noShadow: true });
  solid(ctx, prep([[YLAMP[0] - 40, YLAMP[1]], [YLAMP[0] + 40, YLAMP[1]], [YLAMP[0] + 26, YLAMP[1] + 16], [YLAMP[0] - 26, YLAMP[1] + 16]], true), N('#B09A62', lamp + 0.05), { seed: 409, ink: NI, noShadow: true });
  if (lamp > 0.3) { flame(ctx, YLAMP[0], YLAMP[1] - 4, 1.0 * lamp, t, 9, NI); halo(ctx, YLAMP[0], YLAMP[1] - 26, 100); }
  else if (lamp > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#8E847B'; ctx.lineWidth = 5; ctx.lineCap = 'round'; const k = 1 - lamp / 0.3; ctx.beginPath(); ctx.moveTo(YLAMP[0], YLAMP[1] - 6); ctx.quadraticCurveTo(YLAMP[0] + 30 * k, YLAMP[1] - 60 * k, YLAMP[0] - 10, YLAMP[1] - 120 * k); ctx.stroke(); ctx.restore(); }
}

// ---------- 主帐内景：沙盘（俯视的斜面，信息画在上面） ----------
// 沙盘的局部坐标：u 0..1 横向，v 0..1 纵向（v=0 北/上）；toS 把它映射到屏幕
function sandFrame(cam = { cx: 540, cy: 900, s: 1 }) {
  const tl = [90, 420], tr = [990, 420], br = [1060, 1320], bl = [20, 1320];
  const toS = (u, v) => { const a = [lerp(tl[0], tr[0], u), lerp(tl[1], tr[1], u)], b = [lerp(bl[0], br[0], u), lerp(bl[1], br[1], u)]; const p = [lerp(a[0], b[0], v), lerp(a[1], b[1], v)]; return [cam.cx + (p[0] - 540) * cam.s, cam.cy + (p[1] - 900) * cam.s]; };
  return toS;
}
const HZ = { basin: [[0.18, 0.62], [0.35, 0.5], [0.6, 0.52], [0.84, 0.6], [0.8, 0.74], [0.5, 0.78], [0.22, 0.74]], yangping: [0.3, 0.58], hanzhong: [0.62, 0.66], changan: [0.55, 0.06] };
const ROUTE = [[0.3, 0.55], [0.36, 0.42], [0.4, 0.3], [0.48, 0.18], [0.55, 0.08]];
function drawSandTable(ctx, t, { cam, flags = 1, blocks = 0, route = 0, rib = 0, labels = 1, t0 = 0 } = {}) {
  const S = sandFrame(cam), mp = pts => prep(pts.map(([u, v]) => S(u, v)), true), K = 0.7;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.PAPER_TEX, 0, 0);
  fillP(ctx, rectP(-40, -40, W + 80, 2000), N('#C2AE86', 0.55), 501);
  pool(ctx, 540, 860, 760, 700, 'rgba(255,170,80,A)', [0.06, 0.08, 0.1], 502);
  // 沙盘外框 + 沙面
  const frame = mp([[-0.04, -0.04], [1.04, -0.04], [1.04, 1.04], [-0.04, 1.04]]);
  solid(ctx, frame, N('#6B4A36', K), { sh: N('#553926', K), seed: 503, ink: NI });
  fillP(ctx, mp([[0, 0], [1, 0], [1, 1], [0, 1]]), N('#D9C8A5', K), 504);
  // 山（一圈圈的小山包），汉中盆地在中间偏下
  const hill = (u, v, r, seed) => { const P = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + Math.PI * i / 10; P.push([u + Math.cos(a) * r, v + Math.sin(a) * r * 0.7]); } const Q = mp(P); solid(ctx, Q, N('#7E9A7E', K), { sh: N('#62806A', K), seed, ink: NI, w: 4, lit: [10, -4] }); };
  const HILLS = []; for (let i = 0; i < 26; i++) { const u = (i * 0.137 + 0.03) % 1, v = 0.12 + ((i * 0.293) % 0.42); if (Math.hypot(u - 0.55, v - 0.18) < 0.07) continue; HILLS.push([u, v, 0.05 + (i % 3) * 0.012]); }
  for (let i = 0; i < 9; i++) HILLS.push([0.06 + i * 0.11, 0.9 + (i % 2) * 0.03, 0.05]);
  HILLS.sort((a, b) => a[1] - b[1]).forEach(([u, v, r], i) => hill(u, v, r, 510 + i));
  solid(ctx, mp(HZ.basin), N('#E4D3A8', K), { seed: 540, ink: NI, w: 4, noShadow: true });
  // 刘备的小旗插在南边山上（雾蓝）
  const flagAt = (u, v, i, k) => { if (k <= 0) return; const [x, y] = S(u, v), h = 90 * backOut(k); ink(ctx, prep([[x, y], [x, y - h]], false), 1, { seed: 550 + i, col: NI, w: 4 }); const F = prep([[x, y - h], [x + 50, y - h + 12], [x, y - h + 30]], true); solid(ctx, F, N('#5B7FA8', K), { seed: 560 + i, ink: NI, w: 3.5, noShadow: true }); };
  [[0.2, 0.86], [0.36, 0.88], [0.52, 0.86], [0.68, 0.88], [0.84, 0.85], [0.44, 0.72], [0.74, 0.7]].forEach(([u, v], i) => flagAt(u, v, i, (flags - i * 0.12) / 0.4));
  // 回长安的山路（虚线）
  if (route > 0) { const R = prep(ROUTE.map(([u, v]) => S(u, v)), false), n = Math.floor(R.length * clamp(route)); ctx.save(); ctx.setLineDash([22, 18]); ink(ctx, R.slice(0, Math.max(2, n)), 1, { seed: 570, col: NI, w: 5 }); ctx.restore(); }
  // 曹军木块：被挡在阳平；撤军时沿山路往北退
  const B = clamp(blocks); const along = k => { const i = Math.min(ROUTE.length - 2, Math.floor(k * (ROUTE.length - 1))), f = k * (ROUTE.length - 1) - i; return [lerp(ROUTE[i][0], ROUTE[i + 1][0], f), lerp(ROUTE[i][1], ROUTE[i + 1][1], f)]; };
  for (let i = 0; i < 4; i++) { const k = clamp(B * 1.15 - i * 0.05), p = k > 0 ? along(k) : [HZ.yangping[0] + (i - 1.5) * 0.04, HZ.yangping[1] + (i % 2) * 0.03 - 0.02]; const [x, y] = S(p[0] + (k > 0 ? (i - 1.5) * 0.015 : 0), p[1] + (k > 0 ? i * 0.02 : 0));
    solid(ctx, prep([[x - 26, y - 20], [x + 26, y - 20], [x + 26, y + 14], [x - 26, y + 14]], true), N('#C9A14A', K), { sh: N('#A8823F', K), seed: 580 + i, ink: NI, w: 4 }); }
  // 鸡肋骨压在汉中盆地上（第 16 镜）
  if (rib > 0) drawRib(ctx, ...S(0.52, 0.64), 1.5 * backOut(rib), -0.12, N('#F1E6CC', K), 'rgba(8,10,28,0.3)');
  // 地名牌
  if (labels > 0) { const lab = (key, u, v, d) => { const [x, y] = S(u, v); slipLabel(ctx, x, y - 70, S_(key), t, t0 + d, { size: 40, col: '#3A6E9A', anchor: 'center' }); };
    lab('map_yangping', ...HZ.yangping, 0.2); lab('map_hanzhong', ...HZ.hanzhong, 0.35); if (route > 0.5) lab('map_changan', ...HZ.changan, 0.3 + (route > 0.5 ? 0 : 99)); }
}
// 一根鸡肋：骨干 + 几根肋，几乎没肉
function drawRib(ctx, x, y, s, ang = 0, col = '#F1E6CC', shadow = 'rgba(70,50,30,0.16)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  const spine = C.limbPoly([[-110, 0], [0, -14], [110, 0]], [[0, 22], [0.5, 16], [1, 22]]);
  const ribs = [-60, -20, 20, 60].map(dx => C.limbPoly([[dx, -6], [dx + 10, 40], [dx + 4, 80]], [[0, 12], [1, 8]]));
  for (const P of [spine.poly, ...ribs.map(r => r.poly)]) fillP(ctx, P, shadow, 600, 8, 10);
  for (const P of [...ribs.map(r => r.poly), spine.poly]) { fillP(ctx, P, col, 601); ink(ctx, P, 1, { closed: true, seed: 602, col: NI, w: 5 }); }
  for (const dx of [-110, 110]) { const K = prep(ell(dx, 0, 20, 18, 0, 16), true); fillP(ctx, K, col, 603); ink(ctx, K, 1, { closed: true, seed: 604, col: NI, w: 5 }); }
  ctx.restore();
}

// 主帐里曹操的案（第 3 镜）：沙盘在后面虚着，近处是案、灯、令签
const CLAMP = [790, 1010];
function drawCaoTent(ctx, t) {   // 调用方先设好镜头
  const kk = (x, y) => clamp(0.06 + Math.pow(NT.falloff([x, y], CLAMP, 900), 1.2) * 0.95), NC = (c, x, y) => N(c, kk(x, y));
  fillP(ctx, rectP(-600, -600, W + 1200, 3200), NC('#D8C9A8', 540, 700), 701);
  for (let i = -3; i <= 3; i++) ink(ctx, prep([[540 + i * 40, -40], [540 + i * 260, 1260]], false), 1, { seed: 702 + i, col: N('#A08860', 0.5), w: 3 });
  pool(ctx, CLAMP[0], CLAMP[1], 620, 560, 'rgba(255,170,80,A)', [0.06, 0.08, 0.1], 703);
  solid(ctx, rectP(500, -40, 40, 1300), NC('#7A5640', 520, 600), { sh: NC('#5E412F', 520, 600), seed: 704, ink: NI });     // 帐中柱
  fillP(ctx, rectP(-600, 1260, W + 1200, 1400), NC('#8C7A5E', 540, 1300), 705); ink(ctx, prep([[-40, 1260], [W + 40, 1260]], false), 1, { seed: 706, col: NI });
  // 后面的沙盘一角 + 兵器架
  solid(ctx, prep([[-40, 1150], [380, 1120], [420, 1250], [-40, 1290]], true), NC('#6B4A36', 200, 1200), { seed: 707, ink: NI });
  for (let i = 0; i < 3; i++) { const x = 80 + i * 90; ink(ctx, prep([[x, 1150], [x + 20, 620]], false), 1, { seed: 708 + i, col: NI, w: 8 }); solid(ctx, prep([[x + 20, 620], [x + 6, 560], [x + 34, 560]], true), N('#B6BEC2', 0.2), { seed: 711 + i, ink: NI, w: 4, noShadow: true }); }
}
const CT = { x0: 330, x1: 1000, top: 1170, front: 1210, bot: 1350 };
function drawCaoDesk(ctx, t) {
  const kk = (x, y) => clamp(0.06 + Math.pow(NT.falloff([x, y], CLAMP, 900), 1.2) * 0.95);
  solid(ctx, prep([[CT.x0 - 16, CT.front], [CT.x1 + 16, CT.front], [CT.x1 + 8, CT.bot], [CT.x0 - 8, CT.bot]], true), N('#3A2C2A', kk(660, 1260)), { sh: N('#2A1F1E', kk(660, 1260)), seed: 720, ink: NI, lit: [0, -30] });
  ink(ctx, prep([[CT.x0 - 6, CT.front + 26], [CT.x1 + 6, CT.front + 26]], false), 1, { seed: 721, col: N('#C9A14A', 0.5), w: 5 });
  solid(ctx, prep([[CT.x0, CT.top], [CT.x1, CT.top], [CT.x1 + 16, CT.front], [CT.x0 - 16, CT.front]], true), N('#4A3834', kk(660, 1180)), { sh: N('#3A2C2A', kk(660, 1180)), seed: 722, ink: NI, noShadow: true });
  const x = CLAMP[0];
  solid(ctx, prep(ell(x, CT.top + 4, 40, 12, 0, 24), true), N('#9C8A5A', 0.9), { seed: 723, ink: NI, noShadow: true });
  solid(ctx, rectP(x - 7, CLAMP[1] + 10, 14, CT.top - CLAMP[1] - 10), N('#9C8A5A', 0.9), { seed: 724, ink: NI, w: 4, noShadow: true });
  solid(ctx, prep([[x - 46, CLAMP[1]], [x + 46, CLAMP[1]], [x + 30, CLAMP[1] + 18], [x - 30, CLAMP[1] + 18]], true), N('#B09A62', 1), { seed: 725, ink: NI, noShadow: true });
  flame(ctx, x, CLAMP[1] - 4, 1.15, t, 3, NI); halo(ctx, x, CLAMP[1] - 30, 110);
}

module.exports = { WW, HOR, MAIN, YT, FIRE, OPEN, YLAMP, CLAMP, CT, drawExterior, drawYangTentInterior, drawSandTable, sandFrame, HZ, drawRib, drawCaoTent, drawCaoDesk };
