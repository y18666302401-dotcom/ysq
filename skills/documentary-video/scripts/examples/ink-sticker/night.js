// 墨线贴纸 · 夜景工具（通用，任何题材的夜景都用它；人物配合 char34.js 的 renderFigure 光照参数）
// 原则：不整体压灰。① 每种颜色映射到自己的"夜色"（冷、暗，但保留色相差和明暗差）② 暖光源是画面主角：灯笼 / 火把 / 篝火 / 亮窗，
// 光照在地上和墙上用 2–3 圈阶梯式平涂光池（不用模糊渐变），人物朝光一侧暖色受光 ③ 月光给人物朝月一侧一道细的冷色轮廓光 ④ 纸纹用 overlay 盖在最上层
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const C = require('./char34');
const { clamp, lerp, jit, path, ell, smooth } = C;

const NIGHT_INK = '#141830';                         // 夜里的墨线（比白天更深）
const FIG_SHADOW = 'rgba(8,10,28,0.38)';             // 人物贴纸投影
const GROUND_SHADOW = 'rgba(8,10,28,0.35)';          // 脚下软影子
const SKY = ['#1B2342', '#222C50', '#2B365E', '#36416C'];   // 天空自上而下四条平涂色带

const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const css = a => `rgb(${a.map(v => Math.round(clamp(v, 0, 255))).join(',')})`;
const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const nightRGB = c => { const [r, g, b] = hex(c); return [r * 0.30 + 22, g * 0.33 + 26, b * 0.46 + 56]; };
const warmRGB = c => { const [r, g, b] = hex(c); return [r * 0.86 + 34, g * 0.74 + 26, b * 0.58 + 14]; };
// 白天的颜色 → 夜色；k = 这里受到的暖光强度（0 没有 … 1 贴着光源）
const N = (c, k = 0) => css(mix(nightRGB(c), warmRGB(c), clamp(k)));
// 给 renderFigure 的 recolor：受光面按 k 偏暖，暗面是更暗的夜色
const recolorFor = k => (col, role) => role === 'shade' ? css(nightRGB(col).map(v => v * 0.82)) : N(col, k);
// 从人物指向光源的方向 → 人物局部坐标（局部 x 随 dir 镜像），给 renderFigure 的 litDir
const litLocal = (from, light, dir) => { const v = [light[0] - from[0], light[1] - from[1]], l = Math.hypot(...v) || 1; return [v[0] / l * dir, v[1] / l]; };
// 光源影响随距离线性衰减，r 以外为 0
const falloff = (from, light, r) => clamp(1 - Math.hypot(light[0] - from[0], light[1] - from[1]) / r);
// 月光轮廓光（renderFigure 的 rim）：朝月一侧一道细冷光
const moonRim = (from, moon, dir, { col = 'rgba(160,184,230,0.7)', w = 3 } = {}) => { const v = [moon[0] - from[0], moon[1] - from[1]], l = Math.hypot(...v) || 1; return { dir: [v[0] / l * dir, v[1] / l], col, w }; };
// 一次给齐人物夜景参数：renderFigure(ctx, x, gy, dir, fig, Object.assign({ scale }, nightOpts({ ... })))
function nightOpts({ x, gy, dir, chestH = 330, light, k, moon }) {
  const from = [x, gy - chestH];
  return { recolor: recolorFor(k), litDir: light ? litLocal(from, light, dir) : null, rim: moon ? moonRim(from, moon, dir) : null, inkCol: NIGHT_INK, shadowCol: FIG_SHADOW, groundCol: GROUND_SHADOW };
}

// 阶梯式平涂光池：col 写成 'rgba(255,150,60,A)'，A 依次换成每圈的透明度
function pool(ctx, x, y, rx, ry, col = 'rgba(255,160,70,A)', alphas = [0.10, 0.11, 0.13], seed = 200) {
  ctx.save(); alphas.forEach((a, i) => { const k = 1 - i * 0.3; ctx.fillStyle = col.replace('A', a); path(ctx, jit(ell(x, y, rx * k, ry * k, 0, 48), seed + i, 2), true); ctx.fill(); }); ctx.restore();
}
// 光源本身的一圈平涂光晕（画在人物之上），比如手提灯笼
function halo(ctx, x, y, r = 70, col = 'rgba(255,214,130,A)', alphas = [0.16, 0.2]) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; alphas.forEach((a, i) => { const rr = r * (1 - i * 0.37); ctx.fillStyle = col.replace('A', a); path(ctx, jit(ell(x, y, rr, rr, 0, 30), 400 + i, 2), true); ctx.fill(); }); ctx.restore();
}
// 火苗（会跳动）：外焰橙、内焰黄、墨线描边
function flame(ctx, x, y, s, t, seed = 0, ink = NIGHT_INK) {
  const f = 1 + 0.12 * Math.sin(t * 17 + seed) + 0.08 * Math.sin(t * 29 + seed * 2), lean = 0.12 * Math.sin(t * 7 + seed);
  const P = pts => smooth(pts.map(([a, b]) => [x + (a + b * lean) * s, y + b * s]), true, 2);
  const outer = P([[0, -46 * f], [16, -12], [14, 6], [0, 14], [-14, 6], [-16, -12]]), inner = P([[0, -26 * f], [8, -4], [0, 8], [-8, -4]]);
  ctx.fillStyle = '#F29A3A'; path(ctx, jit(outer, seed + 101, 1.2)); ctx.fill(); ctx.fillStyle = '#FFE38A'; path(ctx, jit(inner, seed + 102, 1.2)); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; path(ctx, jit(outer, seed, 1.2)); ctx.stroke();
}
// 星星：四角星，tw = 闪烁亮度
function sparkle(ctx, x, y, r, tw = 1) { ctx.save(); ctx.globalAlpha = tw; const P = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? r * 0.32 : r; P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } ctx.fillStyle = '#F6E7B8'; path(ctx, P, true); ctx.fill(); ctx.restore(); }
// 天空：四条波浪边平涂色带 + 星星；horizon 以下留给地面
function nightSky(ctx, W, horizon, t, { stars = 46, seed = 3, bands = [0.4, 0.68, 0.86] } = {}) {
  ctx.fillStyle = SKY[0]; ctx.fillRect(0, 0, W, horizon + 60);
  bands.forEach((f, i) => { const y = horizon * f, P = [[-40, y]]; for (let x = -40; x <= W + 40; x += 40) P.push([x, y + 14 * Math.sin(x / 120 + i + 1)]); P.push([W + 40, horizon + 60], [-40, horizon + 60]); ctx.fillStyle = SKY[i + 1]; path(ctx, jit(P, 600 + i, 1.5), true); ctx.fill(); });
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < stars; i++) { const x = r() * W, y = 40 + r() * horizon * 0.8, rr = 3 + r() * 7, sp = 2 + r() * 3; sparkle(ctx, x, y, rr * (y < horizon * 0.5 ? 1 : 0.7), 0.55 + 0.45 * Math.sin(t * sp + i)); }
}
// 月亮：奶油色圆 + 一档阴影 + 环形山 + 两圈平涂月晕
function moonDisc(ctx, x, y, r = 78, ink = NIGHT_INK) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; [[r * 2.45, 0.06], [r * 1.8, 0.08]].forEach(([rr, a], i) => { ctx.fillStyle = `rgba(236,230,200,${a})`; path(ctx, jit(ell(x, y, rr, rr, 0, 48), 300 + i, 2), true); ctx.fill(); }); ctx.restore();
  const P = ell(x, y, r, r, 0, 40); ctx.fillStyle = '#D9CDA6'; path(ctx, jit(P, 31, 1.2)); ctx.fill();
  ctx.save(); path(ctx, P); ctx.clip(); ctx.fillStyle = '#F2E9C9'; path(ctx, P.map(p => [p[0] - r * 0.18, p[1] - r * 0.13])); ctx.fill(); ctx.restore();
  for (const [dx, dy, rr] of [[-0.26, -0.18, 0.15], [0.28, 0.23, 0.12], [-0.08, 0.38, 0.08]]) { ctx.fillStyle = '#E2D6B0'; ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, 7); ctx.fill(); }
  ctx.strokeStyle = ink; ctx.lineWidth = 5.5; path(ctx, jit(P, 31, 1.2)); ctx.stroke();
}
// 亮着的窗：暖黄 + 窗棂 + 一圈平涂窗光
function litWindow(ctx, x, y, w, h, { ink = NIGHT_INK, seed = 0 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,190,90,0.13)'; path(ctx, jit([[x - 26, y - 22], [x + w + 26, y - 22], [x + w + 26, y + h + 22], [x - 26, y + h + 22]], seed + 9, 2), true); ctx.fill(); ctx.restore();
  const P = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; ctx.fillStyle = '#F3C46A'; path(ctx, P, true); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 2); ctx.moveTo(x + 2, y + h / 2); ctx.lineTo(x + w - 2, y + h / 2); ctx.stroke();
  ctx.lineWidth = 4.5; path(ctx, jit(P, seed, 1.2), true); ctx.stroke();
}
// 夜里的纸纹：中性灰底的颗粒，用 overlay 叠在最上层（暗部也看得到纸）
let _tex = null;
function paperOverlay(ctx, W, H, alpha = 0.5) {
  if (!_tex || _tex.width !== W || _tex.height !== H) { _tex = createCanvas(W, H); const x = _tex.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, W, H); let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 380; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 160, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, r() < .5 ? 'rgba(60,60,60,0.10)' : 'rgba(200,200,200,0.10)'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 14000; i++) { const v = r() < .5 ? 40 : 220; x.fillStyle = `rgba(${v},${v},${v},${r() * 0.12})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); } }
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha; ctx.drawImage(_tex, 0, 0); ctx.restore();
}

module.exports = { NIGHT_INK, FIG_SHADOW, GROUND_SHADOW, SKY, N, recolorFor, litLocal, falloff, moonRim, nightOpts, pool, halo, flame, sparkle, nightSky, moonDisc, litWindow, paperOverlay };
