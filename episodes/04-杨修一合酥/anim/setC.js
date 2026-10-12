// 布景 C · 府中厅堂（夜）：几案上一盏灯是唯一的暖光源，右侧门外是月光下的院子
// 四层：远（门外院子、月亮）/ 中（墙、帷幔、屏风、柱）/ 主体（几案、灯、人物）/ 前景（帷幔边、地上的竹简堆）
'use strict';
const L = require('./lib');
const { C, NT, W, prep, rectP, ink, fillP, solid } = L;
const { clamp, lerp, jit, path, ell, smooth, chaikin } = C;
// 白天（第 12–14 镜）和夜里（第 18–21 镜）共用一套布景：setMode('day') 时颜色不换夜色、灯不点、门外是白天
let MODE = 'night'; const setMode = m => { MODE = m; };
const N = (c, k) => MODE === 'day' ? c : NT.N(c, k);
const pool = (...a) => { if (MODE !== 'day') NT.pool(...a); };
const halo = (...a) => { if (MODE !== 'day') NT.halo(...a); };
const flame = (...a) => { if (MODE !== 'day') NT.flame(...a); };
const { nightSky, moonDisc } = NT;
const NIi = () => MODE === 'day' ? C.INK : NT.NIGHT_INK;

const FLOOR = 1250;
const LAMP = { x: 318, base: 1158, dish: 1012 };           // 灯：底座在案面上，火苗在 dish 上方
const LIGHT = [LAMP.x, LAMP.dish - 30];
const TABLE = { x0: 220, x1: 650, top: 1150, front: 1190, bot: 1325 };
const DOOR = { x0: 832, x1: 1080, top: 560 };
const MOON = [985, 690];
const k = (x, y, r = 560, base = 0.03) => clamp(base + Math.pow(NT.falloff([x, y], LIGHT, r), 1.4) * 0.9);
const NC = (col, x, y, r, base) => MODE === 'day' ? col : N(col, k(x, y, Math.min(r || 560, 600), base == null ? 0.03 : Math.min(base, 0.05)));

// 门外：夜空色带 + 月亮 + 院墙 + 一枝树影
function drawYard(ctx, t) {
  ctx.save(); path(ctx, [[DOOR.x0, DOOR.top], [W + 10, DOOR.top], [W + 10, FLOOR], [DOOR.x0, FLOOR]]); ctx.clip();
  if (MODE === 'day') { ['#CFE0E4', '#DCE5E2', '#E8E6D6'].forEach((c, i) => fillP(ctx, rectP(DOOR.x0 - 20, DOOR.top - 20 + i * 150, W, 400), c, 60 + i)); }
  else { nightSky(ctx, W, 1000, t, { stars: 10, seed: 7 }); moonDisc(ctx, MOON[0], MOON[1], 46, NIi()); }
  const wall = prep([[DOOR.x0 - 10, 1000], [W + 20, 980], [W + 20, FLOOR + 10], [DOOR.x0 - 10, FLOOR + 10]], true);
  fillP(ctx, wall, N('#C9B79A', 0.02), 61); ink(ctx, prep([[DOOR.x0 - 10, 1000], [W + 20, 980]], false), 1, { seed: 61, col: NIi(), w: 4 });
  fillP(ctx, prep([[DOOR.x0 - 10, 1120], [W + 20, 1110], [W + 20, FLOOR + 10], [DOOR.x0 - 10, FLOOR + 10]], true), N('#A89A80', 0.02), 62);
  // 光秃的枝条（风里轻摆）
  const sway = 0.02 * Math.sin(t * 1.3);
  const br = (pts, w, s) => ink(ctx, prep(pts.map(([x, y]) => [x + (1000 - y) * sway, y]), false), 1, { seed: s, col: NIi(), w });
  br([[1090, 990], [1010, 900], [950, 860], [900, 850]], 9, 63); br([[1010, 900], [990, 820], [1000, 770]], 6, 64); br([[950, 860], [920, 800]], 5, 65);
  ctx.restore();
}

// 墙、梁、帷幔、屏风、柱、门框、地板
function drawRoom(ctx, t) {
  fillP(ctx, rectP(-40, -40, W + 80, FLOOR + 40), NC('#B98E62', 400, 800, 900, 0.1), 1);
  pool(ctx, LIGHT[0], LIGHT[1] + 20, 520, 430, 'rgba(255,170,80,A)', [0.07, 0.09, 0.12], 5);
  // 地板：木板 + 透视线
  const floor = prep([[-40, FLOOR], [W + 40, FLOOR], [W + 40, 1960], [-40, 1960]], true);
  fillP(ctx, floor, NC('#9C7550', 400, 1300, 900, 0.1), 2);
  for (let i = -6; i <= 8; i++) { const x0 = 540 + i * 95, x1 = 540 + i * 250; ink(ctx, prep([[x0, FLOOR], [x1, 1960]], false), 1, { seed: 70 + i, col: N('#6E4E34', 0.2), w: 3 }); }
  pool(ctx, LIGHT[0] + 60, 1330, 470, 150, 'rgba(255,170,80,A)', [0.08, 0.1, 0.12], 6);
  ink(ctx, prep([[-40, FLOOR], [W + 40, FLOOR]], false), 1, { seed: 3, col: NIi() });
  // 席子（几案下）
  const mat = prep([[150, 1268], [720, 1268], [800, 1420], [70, 1420]], true);
  solid(ctx, mat, NC('#C9B07A', 400, 1330, 800, 0.15), { sh: NC('#AC955F', 400, 1330, 800, 0.1), seed: 8, ink: NIi(), noShadow: true });
  for (let i = 1; i < 6; i++) { const y = 1268 + i * 25; ink(ctx, prep([[150 - i * 14, y], [720 + i * 14, y]], false), 1, { seed: 80 + i, col: N('#8E7848', 0.25), w: 2.5 }); }
  // 横梁 + 柱
  solid(ctx, rectP(-40, 440, W + 80, 46), NC('#6B4A36', 400, 460, 900), { sh: NC('#553926', 400, 460, 900), seed: 11, ink: NIi() });
  solid(ctx, rectP(40, 440, 70, FLOOR - 440), NC('#7A5640', 75, 800, 700), { sh: NC('#5E412F', 75, 800, 700), seed: 12, ink: NIi() });
  // 门框 + 一扇半开的门
  drawYard(ctx, t);
  solid(ctx, rectP(DOOR.x0 - 40, DOOR.top - 30, 40, FLOOR - DOOR.top + 30), NC('#6B4A36', 800, 900, 900), { sh: NC('#553926', 800, 900, 900), seed: 13, ink: NIi() });
  solid(ctx, rectP(DOOR.x0 - 40, DOOR.top - 40, W - DOOR.x0 + 80, 40), NC('#6B4A36', 950, 540, 900), { sh: NC('#553926', 950, 540, 900), seed: 14, ink: NIi() });
  const leaf = prep([[DOOR.x0, DOOR.top], [DOOR.x0 + 70, DOOR.top + 40], [DOOR.x0 + 70, FLOOR - 10], [DOOR.x0, FLOOR]], true);
  solid(ctx, leaf, NC('#7A5640', 860, 900, 900), { sh: NC('#5E412F', 860, 900, 900), seed: 15, ink: NIi() });
  for (let i = 1; i < 6; i++) { const y = DOOR.top + 40 + i * 110; ink(ctx, prep([[DOOR.x0 + 6, y - 6], [DOOR.x0 + 64, y + 30]], false), 1, { seed: 90 + i, col: NIi(), w: 3 }); }
  // 门槛
  solid(ctx, rectP(DOOR.x0 - 40, FLOOR - 26, W - DOOR.x0 + 80, 30), NC('#6B4A36', 950, 1240, 900), { seed: 16, ink: NIi() });
  drawScreen(ctx, t);
  drawCurtains(ctx, t);
}

// 屏风：四扇，墨画山水（第 21 镜会在上面画关系图）
const SCREEN = { x0: 150, x1: 610, top: 560, bot: 1175 };
function drawScreen(ctx, t) {
  const n = 4, pw = (SCREEN.x1 - SCREEN.x0) / n;
  for (let i = 0; i < n; i++) { const x = SCREEN.x0 + i * pw, skew = (i % 2 ? -1 : 1) * 8;
    const P = prep([[x, SCREEN.top + (i % 2 ? 0 : skew)], [x + pw, SCREEN.top + (i % 2 ? skew : 0)], [x + pw, SCREEN.bot], [x, SCREEN.bot]], true);
    const cx = x + pw / 2;
    solid(ctx, P, NC('#5A3E2A', cx, 860, 700, 0.15), { seed: 20 + i, ink: NIi(), noShadow: i > 0 });
    const inner = prep([[x + 14, SCREEN.top + 18], [x + pw - 14, SCREEN.top + 18], [x + pw - 14, SCREEN.bot - 40], [x + 14, SCREEN.bot - 40]], true);
    fillP(ctx, inner, NC('#E8DCC0', cx, 860, 700, 0.15), 30 + i);
    ctx.save(); path(ctx, inner); ctx.clip();
    const yb = 880 + i * 18, col = NC('#8C8577', cx, 860, 700, 0.1);
    fillP(ctx, prep([[x - 20, yb + 60], [x + pw * 0.3, yb - 70 - i * 10], [x + pw * 0.6, yb + 10], [x + pw * 0.9, yb - 120 + i * 12], [x + pw + 30, yb + 30], [x + pw + 30, yb + 300], [x - 20, yb + 300]], true), col, 40 + i);
    ink(ctx, prep([[x - 20, yb + 60], [x + pw * 0.3, yb - 70 - i * 10], [x + pw * 0.6, yb + 10], [x + pw * 0.9, yb - 120 + i * 12], [x + pw + 30, yb + 30]], false), 1, { seed: 50 + i, col: NIi(), w: 3.5 });
    ctx.restore();
    solid(ctx, rectP(x + 10, SCREEN.bot - 6, 26, 30), NC('#4A3222', cx, 1180, 700), { seed: 60 + i, ink: NIi(), w: 4, noShadow: true });
  }
}

// 帷幔：顶上三段垂幔，随风轻摆
function drawCurtains(ctx, t) {
  for (let i = 0; i < 4; i++) { const x0 = -60 + i * 300, x1 = x0 + 320, sag = 150 + (i % 2) * 30, ph = Math.sin(t * 0.9 + i) * 8;
    const P = [[x0, -20], [x1, -20]]; for (let s = 0; s <= 12; s++) { const u = s / 12, x = lerp(x1, x0, u); P.push([x, 60 + sag * Math.sin(Math.PI * u) + ph * Math.sin(Math.PI * u)]); }
    const Q = prep(P, true), cx = (x0 + x1) / 2;
    solid(ctx, Q, NC('#A8823F', cx, 150, 900, 0.12), { sh: NC('#86662E', cx, 150, 900, 0.08), seed: 100 + i, ink: NIi(), lit: [0, -18] });
    for (const u of [0.3, 0.55, 0.78]) { const x = lerp(x0, x1, u); ink(ctx, prep([[x, -10], [x + 6, 40 + sag * Math.sin(Math.PI * u) * 0.9]], false), 1, { seed: 110 + i * 3 + u * 10, col: N('#6E5420', 0.15), w: 3 }); }
  }
}

// 几案（盖住人物下半身）+ 灯
function drawTable(ctx, t) {
  const T = TABLE;
  const top = prep([[T.x0, T.top], [T.x1, T.top], [T.x1 + 16, T.front], [T.x0 - 16, T.front]], true);
  const front = prep([[T.x0 - 16, T.front], [T.x1 + 16, T.front], [T.x1 + 8, T.bot], [T.x0 - 8, T.bot]], true);
  solid(ctx, front, NC('#3A2C2A', 430, 1250, 760, 0.12), { sh: NC('#2A1F1E', 430, 1250, 760, 0.08), seed: 140, ink: NIi(), lit: [0, -30] });
  ink(ctx, prep([[T.x0 - 6, T.front + 26], [T.x1 + 6, T.front + 26]], false), 1, { seed: 141, col: N('#C9A14A', 0.5), w: 5 });
  solid(ctx, top, NC('#4A3834', 430, 1170, 760, 0.12), { sh: NC('#3A2C2A', 430, 1170, 760), seed: 142, ink: NIi(), noShadow: true });
}
function drawLamp(ctx, t) {
  const x = LAMP.x;
  pool(ctx, x, LAMP.base, 150, 26, 'rgba(255,200,110,A)', [0.12, 0.14, 0.18], 9);
  solid(ctx, prep(ell(x, LAMP.base - 6, 40, 12, 0, 24), true), N('#9C8A5A', 0.9), { sh: N('#7A6A40', 0.6), seed: 150, ink: NIi(), noShadow: true });
  solid(ctx, rectP(x - 7, LAMP.dish + 10, 14, LAMP.base - LAMP.dish - 16), N('#9C8A5A', 0.9), { seed: 151, ink: NIi(), w: 4, noShadow: true });
  solid(ctx, prep([[x - 46, LAMP.dish], [x + 46, LAMP.dish], [x + 30, LAMP.dish + 18], [x - 30, LAMP.dish + 18]], true), N('#B09A62', 1), { seed: 152, ink: NIi(), noShadow: true });
  flame(ctx, x, LAMP.dish - 4, 1.15, t, 3, NIi());
  halo(ctx, x, LAMP.dish - 30, 110);
}

// 前景（屏幕坐标，比布景动得多）：左侧一根近处的柱子 + 顶上一段垂幔，夜里几乎是剪影
function drawForeground(ctx, t, cam) {
  const ox = -(cam.dx - 40) * 1.6, sway = Math.sin(t * 0.8) * 6;
  ctx.save(); ctx.translate(ox, 0);
  solid(ctx, prep([[-60, -40], [70, -40], [64, 1960], [-60, 1960]], true), N('#5E412F', 0.03), { sh: N('#4A3222', 0.02), seed: 195, ink: NIi(), lit: [-14, 0] });
  solid(ctx, prep([[-60, 520], [120, 500], [120, 560], [-60, 580]], true), N('#8C6A3A', 0.04), { seed: 196, ink: NIi() });
  const P = [[-60, -40], [700, -40]]; for (let s = 0; s <= 14; s++) { const u = s / 14; P.push([lerp(700, -60, u), 40 + (150 + sway) * Math.sin(Math.PI * u)]); }
  solid(ctx, prep(P, true), N('#6E4A2A', 0.04), { sh: N('#553820', 0.02), seed: 190, ink: NIi(), lit: [0, -16] });
  for (const u of [0.25, 0.5, 0.75]) { const x = lerp(-60, 700, u); ink(ctx, prep([[x, -20], [x + 4, 30 + 150 * Math.sin(Math.PI * u)]], false), 1, { seed: 197 + u * 10, col: N('#3E2A18', 0.02), w: 3 }); }
  ctx.restore();
}

module.exports = { setMode, FLOOR, LAMP, LIGHT, TABLE, DOOR, MOON, SCREEN, k, drawRoom, drawTable, drawLamp, drawForeground };
