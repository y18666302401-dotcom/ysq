// 布景 B · 相国府门（清晨）：远处城墙和屋顶 / 脚手架和工匠 / 新修的高大府门 / 木料、墨斗
// 全片最明亮的布景：晨光从左上来
'use strict';
const L = require('./lib');
const { C, W, prep, rectP, ink, fillP, solid } = L;
const { clamp, lerp, ell, smooth } = C;

const GROUND = 1260;
// 门的几何：w = 两根门柱之间的宽度（第 11 镜会被拆窄）
const GATE = { cx: 540, top: 470, w: 600, post: 70 };
const SUN = [170, 300];

function drawGate(ctx, t, { w = GATE.w, scaffold = 1, leafOpen = 1 } = {}) {
  // 天空：三条暖色色带 + 太阳
  const bands = ['#F4E2BF', '#F1D5A6', '#EBC48E', '#E3B57E'];
  bands.forEach((c, i) => { const y = -40 + i * 280; const P = [[-60, y]]; for (let x = -60; x <= W + 60; x += 60) P.push([x, y + 16 * Math.sin(x / 140 + i)]); P.push([W + 60, GROUND], [-60, GROUND]); fillP(ctx, prep(P, true), c, 800 + i); });
  NTsun(ctx, t);
  // 远处的城墙 + 屋脊
  solid(ctx, prep([[-60, 900], [W + 60, 880], [W + 60, GROUND], [-60, GROUND]], true), '#C9A27A', { sh: '#B08A64', seed: 810, lit: [0, -12], noShadow: true });
  for (let x = -40; x < W + 60; x += 70) solid(ctx, rectP(x, 860 - (x % 140 ? 0 : 6), 40, 44), '#BF9870', { seed: 811 + (x % 9), w: 4, noShadow: true });
  for (const [x, wd] of [[60, 260], [760, 300]]) { solid(ctx, prep([[x - 30, 760], [x + wd / 2, 690], [x + wd + 30, 760]], true), '#5B6470', { sh: '#48505B', seed: 820 + x % 7, noShadow: true }); }
  // 地面
  fillP(ctx, rectP(-60, GROUND, W + 120, 900), '#D9C8A5', 830); ink(ctx, prep([[-60, GROUND], [W + 60, GROUND]], false), 1, { seed: 831 });
  for (let i = 0; i < 6; i++) ink(ctx, prep([[100 + i * 170, GROUND + 60 + (i % 2) * 40], [160 + i * 170, GROUND + 64 + (i % 2) * 40]], false), 1, { seed: 832 + i, w: 3, col: '#A8946E' });
  // 门洞里：院子更亮
  const xl = GATE.cx - w / 2, xr = GATE.cx + w / 2;
  fillP(ctx, rectP(xl, GATE.top + 60, w, GROUND - GATE.top - 60), '#F6E7C4', 840);
  solid(ctx, prep([[xl + 40, 980], [xr - 40, 980], [xr - 40, GROUND], [xl + 40, GROUND]], true), '#E4C79C', { seed: 841, noShadow: true });
  // 两扇门（向里开，窄的透视面）
  for (const [x, d] of [[xl + GATE.post / 2, 1], [xr - GATE.post / 2, -1]]) { const ow = 120 * leafOpen, P = prep([[x, GATE.top + 70], [x + d * ow, GATE.top + 110], [x + d * ow, GROUND - 30], [x, GROUND]], true);
    solid(ctx, P, '#A8825B', { sh: '#8C6A45', seed: 850 + d, lit: [d * 10, 0] }); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) { const px = x + d * ow * (0.3 + j * 0.25), py = GATE.top + 180 + k * 150 + j * 6; ctx.fillStyle = '#C9A14A'; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill(); } }
  // 门柱 + 门楣 + 屋顶
  for (const x of [xl, xr - GATE.post]) solid(ctx, rectP(x, GATE.top, GATE.post, GROUND - GATE.top), '#8C5E3C', { sh: '#704A2E', seed: 860 + x % 5, lit: [16, 0] });
  solid(ctx, rectP(xl - 60, GATE.top - 20, w + 120, 80), '#7A5236', { sh: '#62422B', seed: 865, lit: [0, -14] });
  const roof = prep([[xl - 150, GATE.top - 10], [xl - 40, GATE.top - 150], [xr + 40, GATE.top - 150], [xr + 150, GATE.top - 10], [xr + 60, GATE.top - 30], [xl - 60, GATE.top - 30]], true);
  solid(ctx, roof, '#5B6470', { sh: '#48505B', seed: 866, lit: [0, -16] });
  for (let x = xl - 100; x < xr + 100; x += 34) ink(ctx, prep([[x, GATE.top - 140], [x - 10 * Math.sign(x - GATE.cx), GATE.top - 30]], false), 1, { seed: 867 + (x | 0) % 7, w: 3, col: '#3E454F' });
  solid(ctx, prep([[xl - 60, GATE.top - 160], [xr + 60, GATE.top - 160], [xr + 50, GATE.top - 140], [xl - 50, GATE.top - 140]], true), '#C9A14A', { seed: 868, w: 4 });
  // 脚手架（右侧）
  if (scaffold > 0) { const sx = xr + 30;
    for (const x of [sx, sx + 160]) ink(ctx, prep([[x, GROUND + 10], [x + 6, 520]], false), 1, { seed: 870 + x % 3, w: 9, col: '#7A5640' });
    for (const y of [700, 960]) solid(ctx, rectP(sx - 20, y, 210, 22), '#B08A5E', { seed: 872 + y % 7, w: 4 });
    for (const y of [640, 900, 1150]) ink(ctx, prep([[sx, y], [sx + 160, y - 60]], false), 1, { seed: 874 + y % 5, w: 5, col: '#7A5640' }); }
  // 前景：木料堆 + 墨斗
  for (let i = 0; i < 3; i++) solid(ctx, C.limbPoly([[-40, 1560 - i * 34], [200, 1550 - i * 34], [420, 1540 - i * 34]], [[0, 36], [1, 34]]).poly, '#B08A5E', { sh: '#8C6A45', seed: 880 + i });
  for (let i = 0; i < 3; i++) { const P = prep(ell(400, 1560 - i * 34, 17, 17, 0, 16), true); fillP(ctx, P, '#D9B88A', 884 + i); ink(ctx, P, 1, { seed: 885 + i, closed: true, w: 4 }); }
  solid(ctx, rectP(820, 1480, 110, 70), '#6B4A36', { sh: '#553926', seed: 890 }); const reel = prep(ell(875, 1515, 26, 26, 0, 18), true); fillP(ctx, reel, '#C9A14A', 891); ink(ctx, reel, 1, { seed: 892, closed: true, w: 4 });
  ink(ctx, prep([[930, 1515], [1100, 1500]], false), 1, { seed: 893, w: 2.5 });
}
function NTsun(ctx, t) { const [x, y] = SUN; for (const [r, a] of [[260, 0.18], [180, 0.25]]) { ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  const P = prep(ell(x, y, 92, 92, 0, 36), true); fillP(ctx, P, '#FFE7B0', 899); ink(ctx, P, 1, { seed: 899, closed: true }); }
// 门在给定宽度时，门洞的中心和"门"字框要对齐的位置
const gateRect = w => ({ x0: GATE.cx - w / 2, x1: GATE.cx + w / 2, top: GATE.top, bot: GROUND });

module.exports = { GROUND, GATE, drawGate, gateRect };
