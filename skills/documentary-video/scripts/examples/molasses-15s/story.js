// 共享的故事时间线与几何：两种画风都从这里取位置、物理和时间点，只是画法不同。
// 故事：1919 年 1 月 15 日，波士顿糖蜜罐爆裂（15 秒，竖屏 1080x1920）。
'use strict';
const W = 1080, H = 1920, DUR = 15, G = 1250; // G：地面的世界坐标 y

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const smooth = t => t * t * (3 - 2 * t);
const wobble = (t, k = 18, d = 4) => t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(k * t);
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- 场景布局（世界坐标；1 米 ≈ 55px） ----------
const TANK = { x0: 280, x1: 840, top: 430, roof: 345, seam: 520 };   // 罐高约 15 米
const EL = { deck: 690, cols: [220, -80, -380, -680, -980, -1280], x0: -1700, x1: 330 }; // 高架铁路
const LAMP = { x: -20 };
const PEOPLE = [{ x: 70, s: 1 }, { x: -60, s: 0.92 }, { x: -170, s: 1.05 }];

// ---------- 时间点 ----------
const T = { card: 0.35, strain: 3.4, tag: 4.6, crack: 7.0, flow: 7.6, morphEnd: 8.2, ruler: 9.3, speed: 11.4 };

// ---------- 糖蜜浪 ----------
const xf = t => 280 - 1450 * easeOut(prog(t, T.flow, 14.5));                 // 浪头位置
const Hm = t => t < T.flow ? 0 : 410 * easeOut(prog(t, T.flow, 8.8)) - 170 * easeIO(prog(t, 10.5, 15)); // 浪高（7.5 米 ≈ 410px）
const tankLevel = t => 820 - 560 * easeOut(prog(t, T.flow, 10.5));            // 罐内剩余液面高度
// 浪的剖面：浪头后约 150px 处最高，峰值正好等于 Hm（7.5 米）
const prof = d => (1 - Math.exp(-d / 70)) * (0.62 + 0.38 * Math.exp(-d / 380));
const [FMAX, DMAX] = (() => { let m = 0, dm = 0; for (let d = 0; d < 2000; d++) if (prof(d) > m) { m = prof(d); dm = d; } return [m, dm]; })();
const crestX = t => xf(t) + DMAX;
function waveTop(x, t) {
  const d = Math.max(0, x - xf(t)), hm = Hm(t);
  let h = hm * prof(d) / FMAX;
  h += 11 * Math.sin(x * 0.028 - t * 5.5) * (1 - Math.exp(-d / 120)) * (hm / 410);
  h = lerp(h, tankLevel(t), smooth(clamp((x - 250) / 120)));
  return G - h;
}
// 浪的轮廓（闭合多边形）：顶边从罐内向浪头，浪头前沿略向前卷
function wavePoly(t, N = 110) {
  const a = xf(t), b = TANK.x1 - 12, k = Hm(t) / 410, pts = [];
  for (let i = 0; i <= N; i++) {
    const x = lerp(b, a, i / N), d = x - a;
    pts.push([x - 60 * Math.exp(-d / 90) * k, waveTop(x, t)]);
  }
  pts.push([a + 8, G + 6], [b, G + 6]);
  return pts;
}
// 浪过之后，糖蜜向镜头方向铺开（地面以下的“近处街面”）：浪头处为 0，越往后越深
const floodDepth = (x, t) => 420 * smooth(clamp((x - xf(t)) / 520)) * easeOut(prog(t, 7.9, 11.5));
// 顶边点列（画亮面、浪花用）
function waveTopPts(t, N = 110) { return wavePoly(t, N).slice(0, N + 1); }

// 裂缝（液体变形的起点）：沿接缝的一条细长锯齿
function crackPoly() {
  const L = [], R = [], n = 14;
  for (let i = 0; i <= n; i++) {
    const y = lerp(470, G - 10, i / n), z = (i % 2 ? 1 : -1) * 7;
    L.push([TANK.seam - 9 + z, y]); R.push([TANK.seam + 9 + z, y]);
  }
  return L.concat(R.reverse());
}

// ---------- 铆钉崩飞（固定步长预积分） ----------
const RIVETS = (() => {
  const r = rng(7), out = [], n = 16, dt = 1 / 240;
  for (let i = 0; i < n; i++) {
    const y0 = lerp(480, G - 60, i / (n - 1)), t0 = T.crack + ((i * 7) % n) * 0.028;
    const left = r() < 0.72;
    let x = TANK.seam, y = y0, vx = (left ? -1 : 1) * (500 + r() * 900), vy = -(250 + r() * 750), rot = 0;
    const w = (r() - 0.5) * 30, frames = []; let bounces = 0;
    for (let t = t0; t <= DUR + 0.1; t += dt) {
      frames.push([x, y, rot]);
      if (bounces < 2) { vy += 2600 * dt; x += vx * dt; y += vy * dt; rot += w * dt; if (y > G - 6) { y = G - 6; vy *= -0.33; vx *= 0.45; bounces++; } }
    }
    out.push({ t0, frames, size: 9 + r() * 6 });
  }
  return out;
})();
function rivetAt(rv, t) {
  if (t < rv.t0) return null;
  const s = rv.frames[Math.min(rv.frames.length - 1, Math.round((t - rv.t0) * 240))];
  if (s[1] > G - 40 && s[0] > xf(t) - 10 && t > T.flow) return null;   // 已被浪淹没
  return s;
}

// ---------- 罐壁倒下：两块钢板绕底边向左倒 ----------
const PLATES = [{ x0: 400, x1: TANK.seam, t0: 7.05 }, { x0: TANK.x0, x1: 400, t0: 7.18 }];
function plateAngle(p, t) {               // 0 = 直立，-π/2 = 平躺在地上
  const fall = 0.62, u = prog(t, p.t0, p.t0 + fall);
  let a = -Math.PI / 2 * easeIn(u);
  if (t > p.t0 + fall) a = -Math.PI / 2 + 0.07 * Math.abs(wobble(t - p.t0 - fall, 16, 6));
  return a;
}
const plateLand = p => p.t0 + 0.62;

// ---------- 高架铁路的立柱被浪冲弯 ----------
function hitTime(cx) { if (xf(DUR) > cx) return null; let a = T.flow, b = DUR; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (xf(m) > cx - 40) a = m; else b = m; } return b; }
const COLS = EL.cols.map((x, i) => ({ x, hit: hitTime(x), A: [0.30, 0.22, 0.12, 0.07, 0.04, 0.02][i] }));
function colAngle(c, t) {               // 正值 = 顶部向左倾
  if (c.hit == null || t < c.hit) return 0;
  const hmk = clamp(Hm(c.hit + 0.4) / 410);
  return hmk * (c.A * easeOut(prog(t, c.hit, c.hit + 0.45)) + 0.05 * wobble(t - c.hit, 15, 4));
}
const colTop = (c, t) => { const a = colAngle(c, t), L = G - EL.deck; return [c.x - Math.sin(a) * L, G - Math.cos(a) * L]; };

// ---------- 行人：先慢慢走，罐裂开后转身向左跑 ----------
function personAt(p, t) {
  const tReact = T.crack + 0.08;
  if (t < tReact) return { x: p.x + 22 * t, dir: 1, run: 0, phase: t * 1.1 };
  const tr = t - tReact, x0 = p.x + 22 * tReact;
  return { x: x0 - 680 * (tr - (1 - Math.exp(-tr * 5)) / 5), dir: -1, run: 1, phase: tReact * 1.1 + tr * 2.6 };
}

// ---------- 鸽子：罐裂开时从高架上惊飞 ----------
const PIGEONS = Array.from({ length: 7 }, (_, i) => { const r = rng(40 + i); return { x: -300 + i * 70 + r() * 30, vx: -(160 + r() * 220), vy: -(260 + r() * 160), t0: T.crack + 0.05 + r() * 0.25, ph: r() * 6 }; });
function pigeonAt(p, t) {
  if (t < p.t0) return { x: p.x, y: EL.deck - 70, flap: 0, sit: true };
  const u = t - p.t0; return { x: p.x + p.vx * u, y: EL.deck - 70 + p.vy * u + 60 * u * u, flap: Math.sin(u * 28 + p.ph), sit: false };
}

// ---------- 镜头 ----------
function camera(t) {
  let cx = 380 + 8 * Math.min(t, 3.4), cy = 900, z = 1;
  if (t > T.strain) { const u = easeIO(prog(t, T.strain, T.crack)); cx = lerp(407, 520, u); cy = lerp(900, 860, u); z = lerp(1, 1.32, u); }
  if (t > T.crack) {
    z = lerp(1.32, 1.06, easeOut(prog(t, T.crack, 8.0)));
    const follow = xf(t) + 400; cx = lerp(520, follow, smooth(prog(t, 7.4, 8.6))); cy = lerp(860, 880, prog(t, 7, 8));
    z = lerp(z, 0.95, easeIO(prog(t, 8, 12.5)));
    const fu = easeIO(prog(t, 12.6, 15)); cx = lerp(cx, -430, fu); cy = lerp(cy, 820, fu); z = lerp(z, 0.68, fu);
  }
  // 冲击震动：罐裂开、第一根立柱被撞
  let sh = 26 * Math.exp(-6 * Math.max(0, t - T.crack)) * (t > T.crack ? 1 : 0);
  const h0 = COLS[0].hit; if (h0 && t > h0) sh += 12 * Math.exp(-7 * (t - h0));
  const sx = sh * (Math.sin(t * 91) + 0.5 * Math.sin(t * 157)), sy = sh * (Math.cos(t * 83) + 0.5 * Math.sin(t * 131));
  return { cx: cx + sx / z, cy: cy + sy / z, z };
}
function applyCam(ctx, cam) { ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.cx * cam.z, H / 2 - cam.cy * cam.z); }

// ---------- 字幕（旁白文字；keyword 在读到时变色） ----------
// 每行：[开始, 结束, [[文字, 类型, 变色时刻], ...]]，类型：date / place / num / text
const SUBS = [
  [0.3, 3.3, [['1919 年 1 月 15 日', 'date', 0.5], ['，', 'text'], ['波士顿', 'place', 2.0], ['。', 'text']]],
  [3.5, 6.9, [['一个装着', 'text'], ['八百多万升', 'num', 4.5], ['糖蜜的巨罐，', 'text']]],
  [7.0, 8.5, [['突然', 'text'], ['裂开', 'num', 7.05], ['。', 'text']]],
  [8.6, 11.3, [['七米多高', 'num', 9.3], ['的糖蜜浪，', 'text']]],
  [11.4, 13.25, [['以每小时', 'text'], ['五十多公里', 'num', 11.9], ['的速度，', 'text']]],
  [13.3, 14.95, [['冲过了街道。', 'text']]],
];

// 给音效用的事件时间
function events() {
  return {
    card: T.card + 0.35, tag: T.tag + 0.3, crack: T.crack,
    rivets: RIVETS.map(r => r.t0), plates: PLATES.map(plateLand),
    cols: COLS.filter(c => c.hit).map(c => ({ t: c.hit, k: c.A })), ruler: T.ruler, speed: T.speed,
  };
}

module.exports = { floodDepth, crestX, W, H, DUR, G, clamp, lerp, prog, easeIO, easeOut, easeIn, smooth, wobble, rng, TANK, EL, LAMP, PEOPLE, T, xf, Hm, waveTop, wavePoly, waveTopPts, crackPoly, RIVETS, rivetAt, PLATES, plateAngle, COLS, colAngle, colTop, personAt, PIGEONS, pigeonAt, camera, applyCam, SUBS, events };

if (require.main === module) require('fs').writeFileSync(__dirname + '/events.json', JSON.stringify(events(), null, 1));
