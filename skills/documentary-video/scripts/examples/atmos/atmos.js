// atmos.js：大气景观层（"诗意大气"升级）
// 层层叠叠、越远越亮越淡的山脊（空气透视的明度阶梯）、谷间雾带、平滑渐变天空、星月、
// 带光晕和光芒的太阳、自发光的暖色主角光 + 照到周围表面上的溢光、逆光草边。
// 远景不描边，只靠明度分层；墨线只留给主体层（用 brush.js 画）。
'use strict';
// 用法：const A = require('./atmos')({ S, createCanvas, W, H });   S = { K: 第几张画, Z: 图层缩放 }
module.exports = function makeAtmos({ S, createCanvas, W, H }) {
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function vn(x, seed) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const s = Math.sin((k + seed * 13.37) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), u); }
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(lerp(v, q[i], t)).toString(16).padStart(2, '0')).join(''); };
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

// ---------- 色板：每个布景只用一套，3–4 个色相 ----------
// sky: 天顶→中段→地平线；far/near: 最远、最近山脊；haze: 谷间雾；rim: 受光边；light: 光源；accent: 主角暖光
const PAL = {
  night: { sky: ['#0a1030', '#22336b', '#4d64a3'], far: '#4c609a', near: '#0d1330', haze: '#7086bd', rim: '#9fb3e0', light: '#eef0f8', accent: '#ffa04a' },
  dusk:  { sky: ['#5d5a93', '#c08fae', '#f7cf9c'], far: '#c3a3bd', near: '#2a2036', haze: '#ecc2b4', rim: '#ffd7a0', light: '#fff4d6', accent: '#ffb065' },
  dawn:  { sky: ['#1d2d58', '#7c8fbc', '#f1caa4'], far: '#8e9cc2', near: '#141a30', haze: '#c8c4d6', rim: '#ffe0b8', light: '#fff2da', accent: '#ffb065' },
  storm: { sky: ['#14181f', '#2d3440', '#5b6370'], far: '#4e5664', near: '#0d1015', haze: '#6f7886', rim: '#c7d2e0', light: '#e8f0ff', accent: '#ffb065' },
};

// ---------- 天空：平滑渐变 + 地平线附近一层更亮的余光 ----------
function sky(ctx, pal, { horizon = H * 0.55, glowX = W * 0.5, glow = 0.35 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, pal.sky[0]); g.addColorStop(0.55, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (glow > 0) { const r = ctx.createRadialGradient(glowX, horizon, 0, glowX, horizon, W * 0.9); r.addColorStop(0, rgba(pal.sky[2], glow)); r.addColorStop(1, rgba(pal.sky[2], 0)); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
}

// ---------- 星星：越近地平线越稀，每张画轻微闪烁，少数带十字闪光 ----------
function stars(ctx, { n = 140, maxY = H * 0.5, seed = 5, col = '#f2f4ff' } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = Math.pow(r(), 1.6) * maxY, s = 0.8 + r() * r() * 2.6, ph = r() * 6.28;
    const tw = 0.55 + 0.45 * Math.sin(S.K * 0.9 + ph);
    ctx.globalAlpha = tw * (1 - y / maxY * 0.6); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    if (s > 2.6) { ctx.globalAlpha *= 0.5; ctx.fillRect(x - s * 3, y - 0.5, s * 6, 1); ctx.fillRect(x - 0.5, y - s * 3, 1, s * 6); }
  }
  ctx.globalAlpha = 1;
}

// ---------- 月亮：细弯月 + 柔光晕 ----------
function moon(ctx, x, y, r, pal, { phase = 0.62, halo = 0.22 } = {}) {
  const h = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 9); h.addColorStop(0, rgba(pal.light, halo)); h.addColorStop(1, rgba(pal.light, 0));
  ctx.fillStyle = h; ctx.fillRect(x - r * 9, y - r * 9, r * 18, r * 18);
  const cv = createCanvas(Math.ceil(r * 4), Math.ceil(r * 4)), g = cv.getContext('2d');
  g.fillStyle = pal.light; g.beginPath(); g.arc(r * 2, r * 2, r, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(r * 2 + r * phase, r * 2 - r * 0.25, r * 0.95, 0, 7); g.fill();
  ctx.drawImage(cv, x - r * 2, y - r * 2);
}

// ---------- 太阳：白色核心 + 多层光晕（screen）+ 缓慢转动的光芒 ----------
function sun(ctx, x, y, r, pal, { bloom = 1, rays = 0.18, nRays = 22, t = 0 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [k, a] of [[22, 0.18], [9, 0.32], [4, 0.55], [1.9, 0.9]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * k); g.addColorStop(0, rgba(pal.light, a * bloom)); g.addColorStop(1, rgba(pal.light, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (rays > 0) {
    const cv = createCanvas(W, H), g = cv.getContext('2d'), rr = rng(77);
    for (let i = 0; i < nRays; i++) {
      const a = i / nRays * 6.283 + t * 0.03 + rr() * 0.15, w = 0.012 + rr() * 0.03, L = W * (0.6 + rr() * 0.8);
      const gr = g.createRadialGradient(x, y, r, x, y, L); gr.addColorStop(0, rgba(pal.light, rays * (0.5 + rr()))); gr.addColorStop(1, rgba(pal.light, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - w) * L, y + Math.sin(a - w) * L); g.lineTo(x + Math.cos(a + w) * L, y + Math.sin(a + w) * L); g.closePath(); g.fill();
    }
    ctx.filter = 'blur(6px)'; ctx.drawImage(cv, 0, 0); ctx.filter = 'none';
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}

// ---------- 云：一团团圆鼓的云朵拼成，底部平；先画一层亮色（受光边），再把云身往背光方向错开叠上去 ----------
function clouds(ctx, pal, { y = H * 0.3, n = 3, spread = W, seed = 11, light = null, a = 0.9, scale = 1, t = 0, speed = 4, rimW = 5 } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const cw = (220 + r() * 300) * scale, cx = ((r() * spread + t * speed * (0.5 + r())) % (spread + cw)) - cw * 0.5 + (W - spread) / 2, cy = y + (r() - 0.5) * 220 * scale;
    const puffs = [], m = 6 + Math.floor(r() * 4);
    for (let k = 0; k < m; k++) { const u = k / (m - 1), pr = cw * (0.09 + 0.13 * Math.sin(u * Math.PI)) * (0.75 + r() * 0.5); puffs.push([cx - cw / 2 + u * cw, cy - pr * (0.55 + r() * 0.35), pr]); }
    for (let k = 0; k < 3; k++) { const u = 0.3 + r() * 0.4, pr = cw * (0.12 + r() * 0.08); puffs.push([cx - cw / 2 + u * cw, cy - pr * 1.3, pr]); }
    const lx = light ? light.x - cx : -1, ly = light ? light.y - cy : -1, ll = Math.hypot(lx, ly) || 1, lit = light ? clamp(1.3 - ll / (W * 0.8)) : 0.4;
    const cv = createCanvas(W, H), g = cv.getContext('2d'), blob = (dx, dy, col) => { g.fillStyle = col; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px + dx, py + dy, pr, 0, 7); g.fill(); } };
    blob(0, 0, mix(pal.rim, pal.light, lit * 0.5));                                            // 受光边
    const ox = -lx / ll * rimW * scale, oy = Math.max(0, -ly / ll) * rimW * scale + rimW * 0.6 * scale;
    blob(ox, oy, mix(pal.sky[1], pal.far, 0.45));                                                // 云身
    const sh = g.createLinearGradient(0, cy - cw * 0.3, 0, cy); sh.addColorStop(0, rgba(pal.near, 0)); sh.addColorStop(1, rgba(pal.near, 0.28));
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(0, 0, W, H);       // 底部暗一点
    g.globalCompositeOperation = 'destination-out'; g.fillRect(0, cy + 2, W, H);                  // 底部切平
    ctx.globalAlpha = a; ctx.drawImage(cv, 0, 0); ctx.globalAlpha = 1;
  }
}

// ---------- 山脊叠层：空气透视的明度阶梯 ----------
// 由远到近 n 层，颜色从 far 渐变到 near；每层山脚和下一层之间铺一道谷间雾（越远越浓）；
// 受光一侧山脊一笔细亮边（离光源越近越亮）；可选在几层上长松树剪影。
// 返回每层的轮廓函数 ys[i](x)，方便把房子、树、人放到某一层的山脊上。
function ridges(ctx, pal, { n = 6, top = H * 0.48, bottom = H * 0.72, seed = 3, amp = [40, 150], freq = [1.6, 3.2], ox = [], light = null, trees = [], haze = 0.55, wash = null, maxDark = 0.72, before = null, after = null, X0 = -W * 0.3, X1 = W * 1.3 } = {}) {
  // before(i, d)：画第 i 层之前调用（动画里用来按层设视差变换）；after(i, yAt, d)：画完这一层、盖上谷间雾之前调用（把房子、树、人放到这层山脊上）
  const ys = [];
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 1 : i / (n - 1);                  // 0 = 最远，1 = 最近
    if (before) before(i, d);
    const base = lerp(top, bottom, Math.pow(d, 1.25)), A = lerp(amp[0], amp[1], d), F = lerp(freq[0], freq[1], 1 - d) / W, sh = ox[i] || 0, sd = seed * 31 + i * 7;
    const rd = u => 1 - Math.abs(2 * vn(u, sd + 5) - 1);   // 山脊噪声：尖的峰、圆的谷
    const yAt = x => { const u = (x + sh) * F; return base - A * (0.45 * vn(u, sd) + 0.35 * rd(u * 1.7) + 0.14 * vn(u * 4.3, sd + 1) + 0.06 * vn(u * 11, sd + 2)); };
    ys.push(yAt);
    const pts = []; for (let x = X0; x <= X1; x += 8) pts.push([x, yAt(x)]); pts.push([X1, H * 1.3], [X0, H * 1.3]);
    const col = mix(pal.far, pal.near, maxDark * Math.pow(d, 0.85));   // 最近一层也只到 maxDark，避免底部一条死黑
    if (wash) wash(ctx, pts, col, { seed: sd, edge: mix(col, pal.near, 0.35), edgeA: 0.12, blot: 0, gran: 0.1 + d * 0.08, offset: false });
    else { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.fill(); }
    if (trees.includes(i)) pines(ctx, yAt, col, { seed: sd, size: lerp(10, 60, d), x0: X0, x1: X1 });
    if (light) {                                          // 受光边：一笔细亮线，离光源越近越亮
      ctx.lineWidth = lerp(1.2, 3, d); ctx.lineJoin = 'round';
      for (let x = X0; x < X1; x += 8) { const k = Math.exp(-Math.pow((x - light.x) / (W * 0.45), 2)) * (light.a ?? 0.7) * Math.pow(1 - d, 1.5); if (k < 0.02) continue; ctx.strokeStyle = rgba(pal.rim, k); ctx.beginPath(); ctx.moveTo(x, yAt(x) + 1); ctx.lineTo(x + 8, yAt(x + 8) + 1); ctx.stroke(); }
    }
    if (after) after(i, yAt, d);
    if (i < n - 1 && haze > 0) {                          // 谷间雾：从本层山脊下方到下一层之间，越往下越浓
      const nb = lerp(top, bottom, Math.pow((i + 1) / (n - 1), 1.25)), y0 = base - A * 0.2, a = haze * (1 - d * 0.7);
      const g = ctx.createLinearGradient(0, y0, 0, nb + 20); g.addColorStop(0, rgba(pal.haze, 0)); g.addColorStop(1, rgba(pal.haze, a));
      ctx.fillStyle = g; ctx.fillRect(X0, y0, X1 - X0, nb + 20 - y0 + 200);
    }
  }
  return ys;
}

// 松树剪影：沿山脊成片生长，层层叠的三角树冠，颜色与所在山层相同
function pines(ctx, yAt, col, { seed = 1, size = 30, dens = 0.5, x0 = -20, x1 = W + 20 } = {}) {
  const r = rng(seed * 5 + 1); ctx.fillStyle = col;
  for (let x = x0; x < x1; x += size * (0.35 + r() * 0.9) / dens) {
    if (vn(x / (size * 9), seed) < 0.42) continue;      // 成片分布，中间留空地
    const h = size * (0.7 + r() * 0.8), w = h * 0.32, y = yAt(x) + h * 0.12, tiers = 4;
    ctx.beginPath();
    for (let k = 0; k < tiers; k++) { const ty = y - h * k / tiers * 0.8, tw = w * (1 - k / tiers * 0.7); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - h * 0.42); ctx.lineTo(x + tw, ty); }
    ctx.fill(); ctx.fillRect(x - 1.2, y - 2, 2.4, h * 0.18);
  }
}

// 逆光草边：沿一条轮廓线（山坡顶边）长一排草叶，随风摆；rim 给受光的草尖一道亮边
function grassEdge(ctx, pts, { h = 26, dens = 0.45, col = '#0b1024', rim = null, rimA = 0.6, t = 0, seed = 9, wind = 1 } = {}) {
  const r = rng(seed); ctx.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.round(L * dens / 6));
    for (let j = 0; j < m; j++) {
      const u = r(), x = lerp(ax, bx, u), y = lerp(ay, by, u) + 2, hh = h * (0.4 + r() * 0.9), sway = (Math.sin(t * 1.7 * wind + x * 0.013) * 0.5 + (r() - 0.5) * 0.6) * hh * 0.35;
      const tip = [x + sway + (r() - 0.5) * 6, y - hh];
      ctx.strokeStyle = col; ctx.lineWidth = 1.2 + r() * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.2, y - hh * 0.6, tip[0], tip[1]); ctx.stroke();
      if (rim) { ctx.strokeStyle = rgba(rim, rimA * (0.4 + r() * 0.6)); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(lerp(x, tip[0], 0.55), lerp(y, tip[1], 0.55)); ctx.lineTo(tip[0], tip[1]); ctx.stroke(); }
    }
  }
}

// ---------- 自发光与溢光：冷色世界里唯一的暖点 ----------
// glow：光源本身的光晕（screen）；spill：把光照到某个表面上（裁在形状内，只照朝向光源的一侧）
function glow(ctx, x, y, r, col, a = 0.8, { flicker = 0.06 } = {}) {
  const f = 1 + flicker * Math.sin(S.K * 2.3) * Math.sin(S.K * 0.71);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [k, aa] of [[1, a], [2.6, a * 0.45], [6, a * 0.18]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * k * f); g.addColorStop(0, rgba(col, aa)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * k * f, y - r * k * f, r * k * f * 2, r * k * f * 2); }
  ctx.restore();
}
function spill(ctx, pts, x, y, r, col, a = 0.6) {
  ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
  ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

// ---------- 低空雾带：横向缓慢漂移的一条软雾 ----------
function mistBand(ctx, y, h, col, a = 0.25, { t = 0, seed = 2, speed = 8 } = {}) {
  const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) { const cx = ((r() * W * 1.6 + t * speed * (0.6 + r())) % (W * 1.6)) - W * 0.3, cy = y + (r() - 0.5) * h * 0.5, rx = W * (0.25 + r() * 0.3); ctx.save(); ctx.translate(cx, cy); ctx.scale(1, h / rx); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore(); }
  ctx.restore();
}

// ---------- 最后一步调色：以暗部为支点的对比度曲线 + 暗角（颗粒、纸纹沿用 common.js） ----------
function contrast(ctx, { pivot = 0.22, k = 1.2 } = {}) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data, P = pivot * 255;
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = clamp(P + (d[i + c] - P) * k, 0, 255);
  ctx.putImageData(img, 0, 0);
}

return { PAL, sky, stars, moon, sun, clouds, ridges, pines, grassEdge, glow, spill, mistBand, contrast, mix, rgba };
};
