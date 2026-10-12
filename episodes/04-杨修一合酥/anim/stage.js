// 分镜共用：读分镜时间、跟词的时刻、画人物（夜景光照 / 跪坐在案后）、步态、镜头
'use strict';
const L = require('./lib');
const { C, NT, W, H, eo, eio, backOut, shot, wordTime, LANG } = L;
const { clamp, lerp, add, renderFigure } = C;
const { build, slipParts } = require('./cast');

// 跟词：两种语言各给一个提示词；找不到时退回到说话区间里的比例位置
const cue = (id, zh, en, fb = 0.5) => wordTime(id, LANG === 'zh' ? zh : en, fb);
const SH = id => shot(id);
// 分镜内的局部时间 u（秒）和总时长 d
const local = (t, id) => { const s = shot(id); return { u: t - s.start, d: s.end - s.start, s }; };
// 关键帧插值：ks = [[t, value, ease?], ...]
function keys(ks) { return t => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t < ks[i][0]) { const [t0, a] = ks[i - 1], [t1, b, e] = ks[i]; const u = (t - t0) / (t1 - t0); const f = e === 'lin' ? u : e === 'out' ? eo(u) : e === 'back' ? backOut(u) : eio(u); return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], f)) : lerp(a, b, f); } return ks[ks.length - 1][1]; }; }

// 画一个人物。light：{ pos, k, moon }（夜景）或 null（白天）
function figure(ctx, spec, pose, x, gy, dir, { scale = 1.35, sx = 1, sy = 1, oy = 0, light = null, props = null, ground = true, clipY = null } = {}) {
  const fig = build(pose, spec); if (props) props(fig);
  fig.groundX = x; fig.groundY = gy + 6; fig.groundK = clamp(1 + oy / 200, 0.5, 1);
  const opts = Object.assign({ scale, sx, sy, ground }, light ? NT.nightOpts({ x, gy, dir, light: light.pos, k: light.k, moon: light.moon }) : {});
  if (clipY != null) { ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 9000, clipY + 4000); ctx.clip(); }
  renderFigure(ctx, x, gy + oy, dir, fig, opts);
  if (clipY != null) ctx.restore();
  return fig;
}
// 把道具插在近手臂前（手指盖在道具上）
const holdBefore = (fig, parts) => { const i = fig.parts.findIndex(p => p.name === 'armN'); fig.parts.splice(i, 0, ...parts); };
const handW = (fig, x, gy, dir, scale = 1.35, which = 'hN') => [x + dir * scale * fig.joints[which][0], gy + scale * fig.joints[which][1]];
const headW = (fig, x, gy, dir, scale = 1.35) => [x + dir * scale * fig.joints.hc[0], gy + scale * fig.joints.hc[1]];
const toLocal = (wx, wy, x, gy, dir, scale = 1.35) => [(wx - x) * dir / scale, (wy - gy) / scale];

// 不滑步的步态（同 bucket-60fps/sample.js）
function gait(t, xFn, t0, period, offset, lead, lift) {
  const u0 = (t - t0) / period + offset, n = Math.floor(u0), u = u0 - n;
  const plant = m => xFn(Math.max(t0, t0 + (m - offset + 0.25) * period)) + lead;
  if (u < 0.5) return [plant(n), 0];
  const s = (u - 0.5) / 0.5; return [lerp(plant(n), plant(n + 1), eio(s)), -lift * Math.sin(Math.PI * s)];
}
// 走路姿势：给出 x(t)，返回脚的局部坐标和身体起伏
function walkPose(t, xFn, t0, gy, dir, { period = 0.5, lift = 26, lead = 10, scale = 1.35, base = {} } = {}) {
  const x = xFn(t), f = o => gait(t, xFn, t0, period, o, dir * lead, lift), fN = f(0), fF = f(0.5), ph = (t - t0) / period * Math.PI * 2;
  return { x, oy: -6 * Math.abs(Math.sin(ph)), P: Object.assign({ fN: toLocal(fN[0], gy + fN[1], x, gy, dir, scale), fF: toLocal(fF[0], gy + fF[1], x, gy, dir, scale), heelN: fN[1] < 0 ? 0.3 : 0, heelF: fF[1] < 0 ? 0.3 : 0 }, base), ph };
}
const stepTimes = (t0, t1, period) => { const out = []; for (const o of [0, 0.5]) for (let m = 1; ; m++) { const tt = t0 + (m - o + 0.25) * period; if (tt > t1) break; if (tt > t0) out.push(+tt.toFixed(3)); } return out.sort((a, b) => a - b); };

// 镜头：把世界坐标 (x, y) 放到屏幕中心，缩放 s；shake 为震动幅度
function camera(ctx, { x = 540, y = 960, s = 1, rot = 0 } = {}, shake = 0, t = 0) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(540 + shake * Math.sin(t * 70), 960 + shake * 0.6 * Math.cos(t * 83)); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-x, -y);
}
const shakeAt = (t, t0, amp = 8, dur = 0.25) => t > t0 && t < t0 + dur ? amp * Math.exp(-(t - t0) * 14) : 0;

// 音效事件：每个分镜在这里登记（时间是全片时间）
const EVENTS = [];
const ev = (t, type, pan = 0, extra = {}) => EVENTS.push(Object.assign({ t: +t.toFixed(3), type, pan: +pan.toFixed(2) }, extra));

// 写字的手：笔尖压在 tip 上，手在笔尖左上方，小臂（袖子）从肩膀方向伸过来——画在道具前面
function writingArm(ctx, fig, x, gy, tip, { scale = 1.35, robe = '#3E3A4A', robeSh = '#2E2B38', trim = '#C9A14A', skin = C.SKIN, skinSh = C.SKIN_SH } = {}) {
  const { prep, ell, solid, ink } = L, hw = [tip[0] - 34, tip[1] - 62], sh = [x + scale * fig.joints.ns[0], gy + scale * fig.joints.ns[1]], el = [lerp(sh[0], hw[0], 0.55) - 30, lerp(sh[1], hw[1], 0.55) + 40];
  solid(ctx, C.limbPoly([el, [lerp(el[0], hw[0], 0.5), lerp(el[1], hw[1], 0.5) + 6], hw], [[0, 46], [0.8, 40], [1, 30]]).poly, robe, { sh: robeSh, seed: 1642, lit: [6, -6] });
  ink(ctx, L.prep([[hw[0] - 20, hw[1] + 4], [hw[0] - 6, hw[1] - 16]], false), 1, { seed: 1643, w: 4, col: trim });
  const back = [hw[0] - (tip[0] - hw[0]) * 0.7, hw[1] - (tip[1] - hw[1]) * 0.7];
  solid(ctx, C.limbPoly([back, hw, tip], [[0, 10], [0.85, 9], [1, 18]]).poly, '#8C6A45', { seed: 1640, noShadow: true });
  ctx.fillStyle = '#232845'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 10, 0, 7); ctx.fill();
  solid(ctx, prep(C.ell(hw[0], hw[1], 21, 17, 0.6, 20), true), skin, { sh: skinSh, seed: 1641, noShadow: true });
}

module.exports = { writingArm, cue, SH, local, keys, figure, holdBefore, handW, headW, toLocal, gait, walkPose, stepTimes, camera, shakeAt, EVENTS, ev, slipParts };
