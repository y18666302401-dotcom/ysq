// rig.js：卡通人物骨架 + 关键姿势表演（侧面、面朝右）
// - 腿和手臂用两节反向求解（IK）：给出脚、手要到的位置，膝盖和手肘自己算 → 脚踩住地面不滑、手撑住床
// - 表演用关键姿势：每段有自己的缓动，蓄力 → 动作 → 落地回弹；姿势按 12fps（一拍二）取样，由调用方传入量化后的时间
'use strict';
const K = require('./toon');
const { lerp, clamp, ell, spline, noodle, shape, fillOnly, push, pop, translate, rotate } = K;

const L = { thigh: 84, shin: 84, upper: 62, fore: 56, spine: 110, neck: 18, head: 42 };
const dir = a => [Math.sin(a), -Math.cos(a)];
const add = (p, a, l) => { const d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
const E = {
  lin: u => u, io: u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, out: u => 1 - Math.pow(1 - u, 3), in: u => u * u * u,
  back: u => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },   // 轻微过冲后回落
};
// 两节 IK：p 根部，q 目标，a/b 两节长度，pref 关节偏向的方向
function ik(p, q, a, b, pref) {
  const dx = q[0] - p[0], dy = q[1] - p[1], d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), end = [p[0] + Math.cos(base) * d, p[1] + Math.sin(base) * d];
  const j1 = [p[0] + Math.cos(base + A) * a, p[1] + Math.sin(base + A) * a], j2 = [p[0] + Math.cos(base - A) * a, p[1] + Math.sin(base - A) * a];
  const m = [(p[0] + end[0]) / 2, (p[1] + end[1]) / 2], s = j => (j[0] - m[0]) * pref[0] + (j[1] - m[1]) * pref[1];
  return [s(j1) >= s(j2) ? j1 : j2, end];
}
const mixv = (a, b, u) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], u)) : lerp(a, b, u);
function mixPose(a, b, u) { const o = {}; for (const k of Object.keys(b)) { if (a[k] == null) { o[k] = b[k]; continue; } o[k] = typeof b[k] === 'object' && !Array.isArray(b[k]) ? mixPose(a[k], b[k], u) : mixv(a[k], b[k], u); } return o; }
// 关键姿势轨道：keys = [[时间, 姿势, 缓动名]]；姿势只写变化的字段，其余沿用上一个
function track(keys) {
  const full = []; let cur = {};
  for (const [t, p, e] of keys) { cur = Object.assign(JSON.parse(JSON.stringify(cur)), p, { face: Object.assign({}, cur.face, p.face) }); full.push([t, cur, e || 'io']); }
  return t => {
    if (t <= full[0][0]) return full[0][1];
    for (let i = 1; i < full.length; i++) if (t < full[i][0]) { const [t0, a] = full[i - 1], [t1, b, e] = full[i]; return mixPose(a, b, E[e]((t - t0) / (t1 - t0))); }
    return full[full.length - 1][1];
  };
}
// 落地回弹：impact 时刻之后的衰减余弦
const bounce = (t, at, amp = 1, f = 9, d = 7) => t < at ? 0 : amp * Math.exp(-d * (t - at)) * Math.cos(f * (t - at) * Math.PI);

// 画人：p = { hip, spine, neck, fN, fF, hN, hF, face:{lid,brow,gaze} }，C = 配色，head = 画头的函数
function draw(p, C, head, { headOnly = false } = {}) {
  const hip = p.hip, sh = add(hip, p.spine, L.spine), hc = add(sh, p.spine + p.neck, L.neck + L.head);
  if (headOnly) return drawHead(p, hc, head);
  const legPref = dir(p.spine + Math.PI / 2), armPref = dir(p.spine - Math.PI / 2 + 0.4);   // 膝盖朝前（面朝方向），手肘朝后
  const leg = (foot, col, colS) => {
    const [knee, f] = ik(hip, foot, L.thigh, L.shin, [legPref[0] + 0.3, legPref[1]]);
    shape(noodle(hip, knee, 4, 32, 27), { fill: col }); shape(noodle(knee, f, -4, 27, 22), { fill: col, shade: colS ? () => fillOnly(noodle(knee, f, -4, 12, 9).map(q => [q[0] - 6, q[1]]), colS, { boil: 0.4 }) : null });
    const sx = f[0] - knee[0], sy = f[1] - knee[1], l = Math.hypot(sx, sy) || 1, fx = -sy / l, fy = sx / l, fd = fx >= 0 ? [fx, fy] : [-fx, -fy];   // 脚尖朝前
    shape(ell(f[0] + fd[0] * 12, f[1] + fd[1] * 12 + 3, 24, 13, 20), { fill: C.shoe });
  };
  const arm = (hand, col) => {
    const [el, h] = ik(sh, hand, L.upper, L.fore, armPref);
    shape(noodle(sh, el, 4, 22, 19), { fill: col }); shape(noodle(el, h, -3, 19, 16), { fill: col }); shape(ell(h[0], h[1], 14, 14), { fill: C.skin });
  };
  leg(p.fF, C.pantsS); arm(p.hF, C.shirtS);
  // 身体：沿脊柱的圆胖形状 + 格子衬衫的条纹（硬边阴影块）
  const n = p.spine + Math.PI / 2, side = (q, w) => add(q, n, w), mid = add(hip, p.spine, L.spine * 0.55);
  const body = spline([side(hip, -34), side(mid, -42), side(sh, -32), add(sh, p.spine, 14), side(sh, 32), side(mid, 44), side(hip, 36), add(hip, p.spine + Math.PI, 12)], true, 5);
  shape(body, { fill: C.shirt, shade: () => {
    for (let k = 1; k < 3; k++) { const a = add(hip, p.spine, k * 36), b = add(hip, p.spine, k * 36 + 9); fillOnly([add(a, n, -60), add(a, n, 60), add(b, n, 60), add(b, n, -60)], C.shirtS, { boil: 0 }); }
    fillOnly([side(hip, -60), side(sh, -60), side(sh, -18), side(hip, -14)], C.shirtS, { boil: 0.4 });
  } });
  leg(p.fN, C.pants, C.pantsS); arm(p.hN, C.shirt);
  drawHead(p, hc, head);
  return { hip, sh, hc };
}
function drawHead(p, hc, head) {
  // 头：视线方向由世界坐标里的注视点换算到头的局部坐标
  const ang = p.spine + p.neck, f = p.face || {}, g = f.gaze ? [f.gaze[0] - hc[0], f.gaze[1] - hc[1]] : [1, 0], gl = Math.hypot(g[0], g[1]) || 1;
  const c = Math.cos(-ang), s = Math.sin(-ang), look = [(g[0] * c - g[1] * s) / gl, (g[0] * s + g[1] * c) / gl];
  push(); translate(hc[0], hc[1]); rotate(ang); head(L.head, { lid: f.lid ?? 1, brow: f.brow ?? 0, look }); pop();
  return { hc };
}
module.exports = { L, E, ik, track, bounce, draw, add, dir };
