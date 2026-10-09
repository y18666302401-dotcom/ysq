// 示例项目（卡林顿事件）的绘图库：本期配色、纹理与调色层、卡林顿与电报员造型、怀表、字幕。
// 新项目按本期视觉设定改配色和角色；纹理、调色、字幕、名牌可直接复用。
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 'NSB');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 'NSerB');

const W = 1080, H = 1920;
// 本期 8 色
const C = {
  ink: '#1e1530', navy: '#1b2a4e', cream: '#efe1c2', rust: '#d0552b',
  mustard: '#e5a72a', green: '#43d68c', pink: '#ec68a6', cyan: '#4fe4ec',
};
// 角色设计稿用色（已确认的卡林顿设计稿）
const CH = {
  skin: '#dc9670', skinD: '#b06a49', hair: '#3b2a22', hairD: '#2a1d18', hairH: '#5c4133',
  coat: '#1f1c36', coatD: '#16132a', vest: '#5b2838', cravat: '#ece0c8', cravatD: '#cdbd9e',
  plaid: '#cfc3aa', eye: '#3c5a78',
};
// 字幕标色（rules.md）
const SUB = { date: '#E8B04A', place: '#8EC5E8', num: '#E5483A', text: '#F3EBDD', name: '#FFFFFF' };
const FLARE = '#fffaf0';

// ---------- 数学 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// 弹簧回弹（阻尼振荡），确定性
const spring = (t, k = 14, d = 5) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(k * t);
const wobble = (t, k = 18, d = 4) => t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(k * t);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hex2rgb(h) { if (h.startsWith('rgb')) return h.match(/[\d.]+/g).slice(0, 3).map(Number); const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

// ---------- 纹理与调色层（屏幕空间固定） ----------
const grainTiles = [];
for (let k = 0; k < 3; k++) {
  const c = createCanvas(256, 256), x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(99 + k);
  for (let i = 0; i < 256 * 256; i++) { const v = 150 + r() * 105; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); grainTiles.push(c);
}
// 麻布交叉纹
const linen = (() => {
  const c = createCanvas(64, 64), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  const r = rng(7);
  for (let i = 0; i < 64; i += 2) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`; x.fillRect(0, i, 64, 1); x.fillRect(i, 0, 1, 64); }
  return c;
})();
const vignette = (() => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H * 0.45, H * 0.22, W / 2, H * 0.45, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
})();
function finish(ctx, frame) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.32; ctx.fillStyle = ctx.createPattern(grainTiles[frame % 3], 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(linen, 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette, 0, 0);
  ctx.restore();
}

// ---------- 基础形状 ----------
function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function rrect(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function line(ctx, pts, color, w, dash) {
  ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) { ctx.setLineDash(dash.pattern); ctx.lineDashOffset = dash.offset || 0; }
  ctx.stroke(); ctx.restore();
}
// 截取折线的前 f 部分
function partial(pts, f) {
  if (f >= 1) return pts; if (f <= 0) return [pts[0], pts[0]];
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  let target = L * f, out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (target <= seg[i - 1]) { const u = target / seg[i - 1]; out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]); return out; }
    target -= seg[i - 1]; out.push(pts[i]);
  }
  return out;
}
function pointAt(pts, f) { const p = partial(pts, f); return p[p.length - 1]; }
function sag(x1, y1, x2, y2, s, n = 24) { const o = []; for (let i = 0; i <= n; i++) { const u = i / n; o.push([lerp(x1, x2, u), lerp(y1, y2, u) + Math.sin(u * Math.PI) * s]); } return o; }
function shakeOf(t, t0, amp = 14, dur = 0.5) { const u = t - t0; if (u < 0 || u > dur) return [0, 0]; const k = Math.exp(-u * 7) * amp; return [Math.sin(u * 83) * k, Math.cos(u * 71) * k]; }

// ---------- 文字 ----------
function text(ctx, s, x, y, { size = 48, color = C.cream, font = 'NSB', align = 'center', base = 'middle', stroke = null, sw = 0, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
}
// 名牌：真实姓名、生卒年、身份
function nameplate(ctx, x, y, name, sub, p) {
  if (p <= 0) return;
  const e = easeOut(clamp(p * 1.6)), bw = 420 * e;
  ctx.save();
  rect(ctx, x, y + 74, bw, 7, C.rust);
  ctx.beginPath(); ctx.rect(x, y - 10, 600 * e + 10, 170); ctx.clip();
  text(ctx, name, x, y + 30, { size: 66, font: 'NSerB', align: 'left', color: C.cream, stroke: C.ink, sw: 10 });
  text(ctx, sub, x, y + 118, { size: 36, align: 'left', color: C.cream, stroke: C.ink, sw: 8 });
  ctx.restore();
}

// ---------- 怀表（全片时间计数器） ----------
function watch(ctx, x, y, r, hh, mm, opts = {}) {
  const { swing = 0, chain = true } = opts;
  ctx.save(); ctx.translate(x, y); ctx.rotate(swing);
  if (chain) line(ctx, [[0, -r * 1.12], [-r * 0.5, -r * 1.9], [-r * 1.3, -r * 2.3]], C.mustard, r * 0.06);
  rect(ctx, -r * 0.13, -r * 1.2, r * 0.26, r * 0.22, mix(C.mustard, C.ink, 0.3));
  circle(ctx, 0, 0, r, C.mustard);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.25, Math.PI * 0.75); ctx.closePath(); ctx.fillStyle = mix(C.mustard, C.ink, 0.25); ctx.fill(); ctx.restore();
  circle(ctx, 0, 0, r * 0.84, C.cream);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, L = i % 3 === 0 ? 0.16 : 0.08;
    line(ctx, [[Math.sin(a) * r * 0.74, -Math.cos(a) * r * 0.74], [Math.sin(a) * r * (0.74 - L), -Math.cos(a) * r * (0.74 - L)]], C.ink, r * (i % 3 === 0 ? 0.05 : 0.03));
  }
  const ha = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
  line(ctx, [[0, 0], [Math.sin(ha) * r * 0.42, -Math.cos(ha) * r * 0.42]], C.ink, r * 0.07);
  line(ctx, [[0, 0], [Math.sin(ma) * r * 0.62, -Math.cos(ma) * r * 0.62]], C.ink, r * 0.045);
  circle(ctx, 0, 0, r * 0.08, opts.pivot || C.rust);
  ctx.restore();
}
// 左上角怀表角标 + 计数器文字
function watchBadge(ctx, p, hh, mm, line1, line2, opts = {}) {
  if (p <= 0) return;
  const e = backOut(clamp(p)), x = 150, y = 300 - (1 - e) * 260;
  watch(ctx, x, y, 78, hh, mm, { swing: Math.sin((opts.t || 0) * 2.2) * 0.06 * (1 - (opts.still || 0)) });
  if (line1) text(ctx, line1, x + 112, y - 24, { size: 40, align: 'left', color: opts.c1 || SUB.date, stroke: C.ink, sw: 9, alpha: clamp(p * 2 - 0.6) });
  if (line2) text(ctx, line2, x + 112, y + 30, { size: 34, align: 'left', color: opts.c2 || C.cream, stroke: C.ink, sw: 8, alpha: clamp(p * 2 - 0.8) });
}

// ---------- 夜空、极光、山 ----------
const STARS = (() => { const r = rng(42); return Array.from({ length: 140 }, () => [r() * W, r() * H * 0.75, 1 + r() * 2.5, r() * 6.28]); })();
function stars(ctx, t, alpha = 1, dy = 0) {
  for (const [x, y, s, ph] of STARS) { const a = alpha * (0.45 + 0.4 * Math.sin(t * 2 + ph)); if (a <= 0) continue; ctx.globalAlpha = a; rect(ctx, x, y + dy, s, s, C.cream); }
  ctx.globalAlpha = 1;
}
// 极光：平涂色块的帘幕（无渐变、无发光），reveal 控制展开程度
function aurora(ctx, t, { y0 = 500, h = 520, amp = 60, reveal = 1, cx = W / 2, spread = 1, alpha = 0.92, layers = 3, xmin = -100, xmax = W + 100 } = {}) {
  if (reveal <= 0) return;
  const half = (xmax - xmin) / 2 * reveal * spread, x1 = cx - half, x2 = cx + half;
  for (let k = 0; k < layers; k++) {
    const N = 48, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const x = lerp(x1, x2, i / N), u = i / N;
      const env = Math.sin(u * Math.PI);
      const y = y0 + k * 70 + Math.sin(x * 0.006 + t * 0.9 + k * 1.7) * amp + Math.sin(x * 0.017 - t * 1.3 + k) * amp * 0.35;
      const hh = h * reveal * (0.55 + 0.45 * Math.sin(x * 0.011 + t * 0.7 + k * 2.1)) * env * (1 - k * 0.22);
      top.push([x, y - hh * 0.25]); bot.push([x, y + hh * 0.75]);
    }
    ctx.globalAlpha = alpha * (1 - k * 0.18);
    poly(ctx, [...top, ...bot.reverse()], k === 1 ? C.pink : C.green);
    // 粉色上缘
    const fr = top.map(([x, y], i) => [x, y]), fr2 = top.map(([x, y], i) => [x, y + 26 * reveal]).reverse();
    poly(ctx, [...fr, ...fr2], k === 1 ? mix(C.pink, C.cream, 0.3) : C.pink);
  }
  ctx.globalAlpha = 1;
}
function ridge(ctx, seed, yBase, amp, color, colorLit, t = 0) {
  const r = rng(seed), pts = [[-50, H + 50]]; let x = -50; const peaks = [];
  while (x < W + 100) { const px = x + 120 + r() * 200, py = yBase - amp * (0.4 + r() * 0.6); peaks.push([px, py]); x = px + 80 + r() * 140; }
  pts.push([-50, yBase]); peaks.forEach(p => { pts.push(p); }); pts.push([W + 60, yBase]); pts.push([W + 60, H + 50]);
  poly(ctx, pts, color);
  // 双色分面：每个山峰左侧亮面
  if (colorLit) { let prev = [-50, yBase]; peaks.forEach(p => { poly(ctx, [prev, p, [p[0] - (p[0] - prev[0]) * 0.15, yBase + 40], [prev[0], yBase + 40]], colorLit); prev = [p[0] + 80, yBase - 10]; }); }
}

// ---------- 小人剪影 ----------
function figure(ctx, x, y, s, col, colLit, { lean = 0, headTilt = 0, armUp = 0, crouch = 0, hat = false } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(lean);
  const bodyH = 70 * (1 - crouch * 0.4);
  poly(ctx, [[-22, 0], [-26, -bodyH], [26, -bodyH], [22, 0]], col);
  poly(ctx, [[-22, 0], [-26, -bodyH], [-4, -bodyH], [-4, 0]], colLit || col);
  poly(ctx, [[-20, 0], [-14, 40], [-4, 40], [-2, 0]], col); poly(ctx, [[2, 0], [4, 40], [14, 40], [20, 0]], col);
  ctx.save(); ctx.translate(18, -bodyH + 6); ctx.rotate(-armUp * 2.2); poly(ctx, [[-6, 0], [6, 0], [5, 46], [-5, 46]], col); ctx.restore();
  ctx.save(); ctx.translate(0, -bodyH - 22); ctx.rotate(headTilt);
  circle(ctx, 0, 0, 20, col); ctx.beginPath(); ctx.arc(0, 0, 20, Math.PI * 0.5, Math.PI * 1.5); ctx.fillStyle = colLit || col; ctx.fill();
  if (hat) { rect(ctx, -28, -16, 56, 7, col); rect(ctx, -16, -34, 32, 20, col); }
  ctx.restore(); ctx.restore();
}

// ---------- 卡林顿（照设计稿：侧脸朝右，双色分面） ----------
function carrington(ctx, x, y, s, { blink = 0, look = 0, mouth = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // 礼服肩部
  poly(ctx, [[-330, 420], [-300, 120], [-160, 60], [40, 40], [190, 100], [260, 420]], CH.coat);
  poly(ctx, [[-330, 420], [-300, 120], [-160, 60], [-80, 60], [-110, 420]], CH.coatD);
  poly(ctx, [[-30, 70], [70, 70], [40, 420], [-60, 420]], CH.vest);
  poly(ctx, [[-90, 50], [-40, 140], [-20, 70]], CH.coatD); poly(ctx, [[60, 60], [130, 60], [80, 150]], CH.coatD);
  // 领巾
  poly(ctx, [[-50, -10], [80, -20], [90, 50], [40, 95], [-10, 70], [-60, 40]], CH.cravat);
  poly(ctx, [[40, 40], [100, 50], [70, 120]], CH.cravatD);
  // 脖子与脸（双色分面）
  poly(ctx, [[-40, -60], [60, -60], [70, 0], [-40, 0]], CH.skinD);
  const face = [[-90, -360], [40, -380], [95, -320], [100, -250], [150, -170], [110, -160], [120, -120], [95, -100], [100, -70], [60, -30], [-30, -30], [-80, -120]];
  poly(ctx, face, CH.skin);
  poly(ctx, [[-90, -360], [-10, -365], [-20, -30], [-30, -30], [-80, -120]], CH.skinD);
  // 鬓须（耳前，浓密）
  poly(ctx, [[-60, -230], [-5, -235], [15, -120], [5, -40], [-40, -30], [-75, -110]], CH.hair);
  poly(ctx, [[-50, -200], [-20, -200], [-10, -80], [-40, -60]], CH.hairD);
  // 耳
  poly(ctx, [[-85, -250], [-60, -255], [-55, -200], [-80, -195]], CH.skinD);
  // 后梳发
  poly(ctx, [[-150, -250], [-140, -370], [-60, -430], [40, -420], [110, -370], [70, -360], [-20, -355], [-80, -330], [-92, -250], [-118, -205], [-150, -215]], CH.hair);
  poly(ctx, [[-110, -380], [-40, -420], [10, -415], [-60, -390]], CH.hairH);
  // 眉、眼（简单椭圆），blink 0..1
  poly(ctx, [[40, -305], [100, -308], [98, -296], [42, -293]], CH.hairD);
  ctx.save(); ctx.translate(72 + look * 6, -275); ctx.scale(1, Math.max(0.08, 1 - blink));
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2); ctx.fillStyle = '#f5ecda'; ctx.fill();
  circle(ctx, 8, 0, 8, CH.eye); circle(ctx, 9, 0, 3.5, CH.hairD); ctx.restore();
  // 嘴
  poly(ctx, [[100, -128], [124, -126 + mouth * 6], [100, -120 + mouth * 4]], '#8a3e30');
  ctx.restore();
}
// 卡林顿的手 + 铅笔
function handPencil(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(rot);
  poly(ctx, [[-120, 40], [-40, -10], [20, -20], [40, 10], [10, 40], [-100, 80]], CH.coat);
  poly(ctx, [[-30, -20], [30, -30], [50, 0], [30, 30], [-20, 25]], CH.skin);
  poly(ctx, [[-30, -20], [0, -24], [-5, 25], [-20, 25]], CH.skinD);
  poly(ctx, [[30, -10], [110, 40], [104, 48], [24, 2]], C.mustard); poly(ctx, [[104, 40], [124, 54], [106, 50]], C.ink);
  ctx.restore();
}

// ---------- 电报员（19 世纪通用造型：马甲、袖箍） ----------
function operator(ctx, x, y, s, { lean = 0, armR = 0, armL = 0, blink = 0, recoil = 0 } = {}) {
  // 侧身朝右坐在桌前；armR/armL：0=手放在桌面，正值=手按下；recoil：被电击后猛缩
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(lean - recoil * 0.12);
  const shirt = C.cream, shirtD = mix(C.cream, C.rust, 0.28);
  const arm = (sx, sy, a1, a2, col, colD, band) => {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a1);
    poly(ctx, [[-22, -10], [22, -10], [19, 130], [-19, 130]], col); poly(ctx, [[-22, -10], [0, -10], [0, 130], [-19, 130]], colD);
    if (band) rect(ctx, -22, 40, 44, 18, C.rust);
    ctx.translate(0, 125); ctx.rotate(a2);
    poly(ctx, [[-18, 0], [18, 0], [15, 120], [-15, 120]], col);
    poly(ctx, [[-16, 112], [16, 112], [22, 150], [-12, 156]], CH.skin);
    ctx.restore();
  };
  // 远侧手臂（在身体后面）
  arm(70, 70, -0.55 - armL * 0.1 + recoil * 0.5, -1.1 - recoil * 1.2, shirtD, shirtD, true);
  // 躯干：衬衫 + 马甲
  poly(ctx, [[-110, 320], [-100, 30], [90, 30], [110, 320]], shirt);
  poly(ctx, [[-110, 320], [-100, 30], [-30, 30], [-40, 320]], shirtD);
  poly(ctx, [[-85, 320], [-78, 45], [5, 45], [10, 320]], mix(C.ink, C.navy, 0.4));
  poly(ctx, [[10, 320], [15, 45], [75, 45], [82, 320]], C.navy);
  for (let i = 0; i < 4; i++) circle(ctx, 18, 90 + i * 50, 6, C.mustard);
  // 头
  ctx.save(); ctx.translate(0, -40);
  poly(ctx, [[-20, 80], [30, 80], [30, 30], [-20, 30]], CH.skinD);
  poly(ctx, [[-60, -100], [50, -110], [80, -40], [95, -30], [80, -15], [85, 10], [55, 40], [-40, 40], [-65, -20]], CH.skin);
  poly(ctx, [[-60, -100], [0, -105], [-5, 40], [-40, 40], [-65, -20]], CH.skinD);
  poly(ctx, [[-75, -60], [-60, -125], [20, -140], [80, -100], [60, -90], [0, -100], [-40, -80], [-50, -20], [-70, -10]], CH.hair);
  poly(ctx, [[45, 2], [90, 0], [85, 14], [40, 14]], CH.hair);
  const eyeOpen = recoil > 0.3 ? 1.3 : 1;
  ctx.save(); ctx.translate(50, -48); ctx.scale(eyeOpen, Math.max(0.1, (1 - blink) * eyeOpen)); ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fillStyle = '#f5ecda'; ctx.fill(); circle(ctx, 5, 0, 5.5, C.ink); ctx.restore();
  rect(ctx, 34, -72 - recoil * 10, 34, 7, CH.hairD);
  ctx.restore();
  // 近侧手臂
  arm(10, 80, -0.45 - armR * 0.12 + recoil * 0.6, -1.15 + armR * 0.15 - recoil * 1.3, shirt, shirtD, true);
  ctx.restore();
}
// ---------- 电报机 ----------
function telegraphKey(ctx, x, y, s, press = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -110, -10, 220, 40, 6, mix(C.rust, C.ink, 0.45)); rect(ctx, -110, 18, 220, 12, mix(C.rust, C.ink, 0.65));
  rect(ctx, -10, -50, 20, 44, C.mustard);
  ctx.save(); ctx.translate(0, -50); ctx.rotate(press * 0.12); rect(ctx, -100, -8, 200, 14, C.mustard); rect(ctx, -100, 0, 200, 6, mix(C.mustard, C.ink, 0.3));
  rrect(ctx, 80, -28, 40, 22, 8, C.ink); ctx.restore();
  ctx.restore();
}
function sounder(ctx, x, y, s, lever = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -120, 0, 240, 36, 6, mix(C.rust, C.ink, 0.45));
  rrect(ctx, -70, -110, 50, 110, 10, C.rust); rrect(ctx, 20, -110, 50, 110, 10, mix(C.rust, C.ink, 0.25));
  ctx.save(); ctx.translate(-100, -120); ctx.rotate(-lever * 0.08); rect(ctx, 0, -10, 210, 16, C.mustard); ctx.restore();
  ctx.restore();
}
// 电池：玻璃罐电池组
function battery(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < 3; i++) {
    const bx = -190 + i * 130;
    rrect(ctx, bx, -150, 110, 170, 10, mix(C.navy, C.cream, 0.25));
    rrect(ctx, bx, -150, 40, 170, 10, mix(C.navy, C.cream, 0.4));
    rect(ctx, bx + 10, -90, 90, 100, mix(C.navy, C.cyan, 0.15));
    rect(ctx, bx + 25, -180, 18, 40, C.ink); rect(ctx, bx + 68, -180, 18, 40, C.rust);
    if (i < 2) line(ctx, [[bx + 77, -180], [bx + 115, -205], [bx + 164, -180]], C.rust, 8);
  }
  ctx.restore();
}

// ---------- 太阳、地球、物质团 ----------
function sun(ctx, x, y, r, t = 0) {
  circle(ctx, x, y, r, C.mustard);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.25, Math.PI * 1.25); ctx.closePath(); ctx.fillStyle = C.rust; ctx.fill(); ctx.restore();
  const R = rng(5);
  for (let i = 0; i < 9; i++) { const a = R() * 6.28 + t * 0.05, d = R() * r * 0.8; circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.03 + R() * 0.05), mix(C.mustard, C.cream, 0.4)); }
}
function earth(ctx, x, y, r, rot = 0) {
  circle(ctx, x, y, r, mix(C.navy, C.cyan, 0.25));
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  const R = rng(11);
  for (let i = 0; i < 6; i++) {
    const cx = x + ((R() * 2 - 1) * r + rot * r * 2) % (r * 2.4), cy = y + (R() * 2 - 1) * r * 0.7, w = r * (0.3 + R() * 0.4);
    poly(ctx, [[cx - w, cy], [cx - w * 0.3, cy - w * 0.6], [cx + w * 0.5, cy - w * 0.4], [cx + w, cy + w * 0.2], [cx, cy + w * 0.7]], C.cream);
  }
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI * 0.5, Math.PI * 0.5); ctx.lineTo(x, y + r); ctx.fillStyle = 'rgba(16,10,30,0.45)'; ctx.fill();
  ctx.restore();
}
// 带电物质团（扁平的弧形云团）
function blob(ctx, x, y, r, ang, t, col = C.cream, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
  const N = 40, pts = [];
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + Math.PI * i / N, wob = 1 + 0.08 * Math.sin(a * 7 + t * 5) + 0.05 * Math.sin(a * 13 - t * 3);
    pts.push([Math.cos(a) * r * wob, Math.sin(a) * r * 1.2 * wob]);
  }
  for (let i = N; i >= 0; i--) { const a = -Math.PI / 2 + Math.PI * i / N; pts.push([Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.9]); }
  poly(ctx, pts, col);
  ctx.restore();
}

// ---------- 地图 ----------
let MAP = { land: [], usa: [] }; try { MAP = JSON.parse(fs.readFileSync(__dirname + '/mapdata.json')); } catch (e) { /* 地图数据可选：需要时用 Natural Earth 生成 mapdata.json */ }
function projector(lon0, lat0, scale) { // 简化的等角圆柱投影，中心 lon0/lat0 → 画面中心
  const k = Math.cos(lat0 * Math.PI / 180);
  return (lon, lat) => [W / 2 + (lon - lon0) * k * scale, H / 2 - (lat - lat0) * scale];
}
function drawRings(ctx, rings, P, fill, shadeFill) {
  for (const r of rings) {
    ctx.beginPath(); r.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }
}
function pinLabel(ctx, x, y, label, p, side = 'right', color = SUB.place) {
  if (p <= 0) return;
  const e = backOut(clamp(p * 2));
  circle(ctx, x, y, 14 * e, color); circle(ctx, x, y, 6 * e, C.ink);
  text(ctx, label, side === 'right' ? x + 28 : x - 28, y, { size: 44, align: side === 'right' ? 'left' : 'right', color, stroke: C.ink, sw: 10, alpha: clamp(p * 2 - 0.3) });
}

// ---------- 字幕 ----------
function subtitle(ctx, shot, t) {
  const t0 = shot.speech_start - 0.1, t1 = Math.min(shot.speech_end + 0.35, shot.end);
  if (t < t0 || t > t1) return;
  const a = clamp((t - t0) / 0.15) * clamp((t1 - t) / 0.15);
  const raw = shot.text.replace(/[，。、：？]$/, '');
  // 切词：按关键词分段
  let segs = [{ s: raw, k: null }];
  for (const k of shot.keywords) {
    const out = [];
    for (const sg of segs) {
      if (sg.k) { out.push(sg); continue; }
      const i = sg.s.indexOf(k.text);
      if (i < 0) { out.push(sg); continue; }
      if (i > 0) out.push({ s: sg.s.slice(0, i), k: null });
      out.push({ s: k.text, k }); if (i + k.text.length < sg.s.length) out.push({ s: sg.s.slice(i + k.text.length), k: null });
    }
    segs = out;
  }
  const size = 56; ctx.save(); ctx.font = `${size}px NSB`;
  // 切成不可拆分的单位：关键词整体、连续英文数字整体、其余单字
  const units = [];
  for (const sg of segs) {
    if (sg.k) { units.push({ g: [...sg.s].map(ch => ({ ch, k: sg.k })), s: sg.s }); continue; }
    const parts = sg.s.match(/[A-Za-z0-9\-·]+|./gu) || [];
    for (const p of parts) units.push({ g: [...p].map(ch => ({ ch, k: null })), s: p });
  }
  const uw = units.map(u => ctx.measureText(u.s).width), total = uw.reduce((a, b) => a + b, 0), maxW = 940;
  let lines;
  if (total <= maxW) lines = [units.flatMap(u => u.g)];
  else {
    let best = -1, bestScore = 1e9, acc = 0;
    for (let i = 0; i < units.length - 1; i++) {
      acc += uw[i];
      if (acc > maxW || total - acc > maxW) continue;
      let score = Math.abs(acc - total / 2);
      if (/[，、：]/.test(units[i].s)) score -= total * 0.2;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) best = Math.floor(units.length / 2);
    lines = [units.slice(0, best + 1).flatMap(u => u.g), units.slice(best + 1).flatMap(u => u.g)];
  }
  const lh = 78, y0 = 1560 - (lines.length - 1) * lh;
  lines.forEach((ln, li) => {
    const lw = ln.reduce((s, g) => s + ctx.measureText(g.ch).width, 0);
    let x = W / 2 - lw / 2;
    for (const g of ln) {
      const gw = ctx.measureText(g.ch).width;
      let col = SUB.text, sc = 1;
      if (g.k) {
        const u = t - g.k.t;
        if (u >= 0) { col = SUB[g.k.type]; sc = 1 + 0.18 * Math.exp(-u * 6) * Math.cos(u * 18) * (u < 0.6 ? 1 : 0); }
        if (g.k.type === 'name' && u >= 0) sc *= 1.08;
      }
      ctx.save(); ctx.translate(x + gw / 2, y0 + li * lh); ctx.scale(sc, sc);
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,8,24,0.95)'; ctx.lineWidth = 12; ctx.strokeText(g.ch, 0, 0);
      ctx.fillStyle = col; ctx.fillText(g.ch, 0, 0); ctx.restore();
      x += gw;
    }
  });
  ctx.restore();
}

module.exports = {
  createCanvas, W, H, C, CH, SUB, FLARE, clamp, lerp, prog, easeIO, easeOut, easeIn, backOut, spring, wobble, rng, mix, rgba,
  finish, poly, circle, rect, rrect, line, partial, pointAt, sag, shakeOf, text, nameplate, watch, watchBadge, stars, aurora, ridge,
  figure, carrington, handPencil, operator, telegraphKey, sounder, battery, sun, earth, blob, MAP, projector, drawRings, pinLabel, subtitle,
};
