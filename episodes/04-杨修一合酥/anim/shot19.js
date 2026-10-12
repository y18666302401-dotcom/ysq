// 分镜 19（招牌镜头 3）：曹操递出红字出题令签，传令兵刚跑到门口，墨字答案竹简已经从门外飞回来落在案上
// node shot19.js still <t> out.png | sheet t1,t2,... out.png | video out.mp4 [fps]（t 为全片时间，和配音同一条时间轴）
'use strict';
const L = require('./lib');
const { C, NT, W, H, eo, eio, backOut, burst, shot, wordTime, drawSubs, PAPER_TEX, S_ } = L;
const { G, clamp, lerp, add, renderFigure } = C;
const SC_ = require('./setC');
const { CAO, RUNNER, build, slipParts } = require('./cast');

const SH = shot('19');
const SCALE = 1.35, RED = '#C8372D';
// ---------- 时间：全部从配音推导 ----------
const tQ = wordTime('19', L.LANG === 'zh' ? '出题' : 'question');      // 出题
const tA = wordTime('19', L.LANG === 'zh' ? '答案' : 'answered');      // 答案
const tS = wordTime('19', L.LANG === 'zh' ? '送到' : 'fast', 0.9);     // 送到
const T = {
  give0: tQ - 0.32, give: tQ, grab: tQ + 0.1, turn0: tQ + 0.16, run0: tQ + 0.32,
  fly0: tS - 0.5, land: tS + 0.06,
};
T.skid = T.fly0 + 0.12;
T.run1 = T.skid; T.spin0 = T.skid + 0.06; T.spin1 = T.spin0 + 0.22;

// ---------- 人物位置 ----------
const CAO_X = 420, CAO_GY = 1372;               // 跪坐在案后：下半身被几案盖住
const RUN_GY = 1440, RUN_X0 = 690, RUN_X1 = 850;
const toLocal = (wx, wy, x, gy, dir) => [(wx - x) * dir / SCALE, (wy - gy) / SCALE];
function gait(t, xFn, t0, period, offset, lead, lift) {
  const u0 = (t - t0) / period + offset, n = Math.floor(u0), u = u0 - n;
  const plant = m => xFn(Math.max(t0, t0 + (m - offset + 0.25) * period)) + lead;
  if (u < 0.5) return [plant(n), 0];
  const s = (u - 0.5) / 0.5; return [lerp(plant(n), plant(n + 1), eio(s)), -lift * Math.sin(Math.PI * s)];
}
const runX = t => t < T.run0 ? RUN_X0 : t > T.run1 ? RUN_X1 + 18 * eo((t - T.run1) / 0.15) : lerp(RUN_X0, RUN_X1, (u => u < 0.3 ? u * u / 0.6 : u - 0.15)((t - T.run0) / (T.run1 - T.run0)) / 0.85);
const RUN_P = 0.34;

// 曹操的手（世界坐标，用来交接令签）
function caoPose(t) {
  const give = eio((t - T.give0) / (T.give - T.give0)), back = eio((t - T.grab - 0.05) / 0.3);
  const ext = give * (1 - back);
  const P = { fN: [30, 0], fF: [-24, 0], hF: [40, -168], hN: [lerp(78, 168, ext), lerp(-170, -222, ext)], lean: lerp(0.02, -0.04, ext), elbowPref: [-0.5, 1], look: [1, 0.05], brow: 0, smile: 0.1 };
  if (t >= T.land) { const k = t - T.land;
    if (k < 0.35) Object.assign(P, { look: [0.5, 0.85], brow: 1.6, mouth: 0.35, lean: 0.06 * Math.exp(-k * 8) });
    else Object.assign(P, { look: [0.5, 0.8], brow: -0.7, lid: 0.48, squint: 0.3, smile: -0.2, browAng: 0.8 }); }
  return P;
}
function caoHandWorld(t) { const fig = build(caoPose(t), CAO); return [CAO_X + SCALE * fig.joints.hN[0], CAO_GY + SCALE * fig.joints.hN[1]]; }

function runnerPose(t) {
  let x = runX(t), dir = -1, sx = 1, sy = 1, oy = 0, P;
  if (t < T.turn0) { // 躬身候命，伸手接令签
    const reach = eio((t - (T.give - 0.12)) / 0.2), hw = caoHandWorld(Math.min(t, T.grab)), tgt = toLocal(hw[0] + 6, hw[1] + 4, x, RUN_GY, dir);
    P = { fN: [26, 0], fF: [-26, 0], hN: [lerp(40, tgt[0], reach), lerp(-196, tgt[1], reach)], hF: [30, -190], lean: 0.14, drop: 6, look: [1, 0.25], brow: 0.3, elbowPref: [-0.5, 1] };
  } else if (t < T.run0) { // 转身：横向压扁回弹
    const k = (t - T.turn0) / (T.run0 - T.turn0); dir = k < 0.5 ? -1 : 1; sx = lerp(0.72, 1, backOut(k)); sy = lerp(1.12, 1, backOut(k));
    P = { fN: [20, 0], fF: [-24, 0], hN: [70, -230], hF: [-30, -180], lean: 0.1, drop: 12, look: [1, 0], brow: 1, mouth: 0.3, elbowPref: [-0.5, 1] };
  } else if (t < T.skid) { // 奔向门口，令签举在前面
    dir = 1; const f = o => gait(t, runX, T.run0, RUN_P, o, -16, 52), fN = f(0), fF = f(0.5), ph = (t - T.run0) / RUN_P * Math.PI * 2;
    P = { fN: toLocal(fN[0], RUN_GY + fN[1], x, RUN_GY, 1), fF: toLocal(fF[0], RUN_GY + fF[1], x, RUN_GY, 1), heelN: fN[1] < 0 ? 0.4 : 0, heelF: fF[1] < 0 ? 0.4 : 0,
      hN: [84, -246 + 10 * Math.sin(ph)], hF: [-56 - 30 * Math.sin(ph), -186], lean: 0.24, drop: 14 + 8 * Math.abs(Math.sin(ph)), look: [1, -0.05], mouth: 0.25, brow: 0.6, elbowPref: [-0.4, 1] };
    oy = -10 * Math.abs(Math.sin(ph));
  } else { // 竹简擦着头顶飞过：急停、后仰、转回来看
    const k = t - T.skid; dir = t < T.spin0 + 0.11 ? 1 : -1;
    const hop = k > 0.06 && k < 0.36 ? Math.sin(Math.PI * (k - 0.06) / 0.3) : 0; oy = -60 * hop;
    if (k < 0.06) { sy = 0.9; sx = 1.08; } else if (hop > 0) { sy = 1.08; sx = 0.94; } else if (k < 0.48) { sy = 0.93; sx = 1.05; }
    const spinK = clamp((t - T.spin0) / (T.spin1 - T.spin0)); if (spinK > 0 && spinK < 1) sx *= Math.max(0.55, Math.abs(Math.cos(Math.PI * spinK)));
    P = { fN: [30, hop > 0 ? -12 : 0], fF: [-34, hop > 0 ? -20 : 0], hN: [70, -262], hF: [74, -248], lean: dir === 1 ? -0.16 : 0.04, drop: 0, look: dir === 1 ? [-0.2, -0.9] : [1, 0.2], mouth: 0.85, brow: 1.8, elbowPref: [-0.5, 1] };
  }
  return { x, dir, sx, sy, oy, P };
}

// ---------- 飞来的答案竹简 ----------
const DOOR_PT = [990, 980], LAND_PT = [528, 1150];
function answerSlip(t) {
  if (t < T.fly0) return null;
  if (t < T.land) { const u = (t - T.fly0) / (T.land - T.fly0), e = eio(u);
    return { p: [lerp(DOOR_PT[0], LAND_PT[0], e), lerp(DOOR_PT[1], LAND_PT[1], e) - 260 * Math.sin(Math.PI * u)], a: -Math.PI * 3.2 * u - 0.3, s: 1 }; }
  const k = t - T.land, hop = k < 0.22 ? Math.sin(Math.PI * k / 0.22) * 26 : 0;
  return { p: [LAND_PT[0] + 10 * eo(k / 0.3), LAND_PT[1] - hop], a: lerp(-Math.PI * 3.5, -Math.PI * 3.5 + 0.05, eo(k / 0.3)) + (-Math.PI / 2 + Math.PI * 3.5) * eo(clamp(k / 0.18)) , s: 1 };
}

// ---------- 一帧 ----------
function frame(ctx, t) {
  G.K = Math.floor(t * 12 + 1e-6); SC_.setMode('night');
  const u = clamp((t - SH.start) / (SH.end - SH.start));
  const shake = t > T.land && t < T.land + 0.25 ? 7 * Math.exp(-(t - T.land) * 18) * Math.sin((t - T.land) * 70) : 0;
  const cam = { s: lerp(1.3, 1.36, eio(u)), dx: lerp(40, 70, eio(u)) };
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PAPER_TEX, 0, 0);
  ctx.save(); ctx.translate(W / 2 + shake, 1880); ctx.scale(cam.s, cam.s); ctx.translate(-W / 2 - cam.dx, -1880 + shake * 0.4);
  SC_.drawRoom(ctx, t);
  const night = (x, gy, dir, kk) => NT.nightOpts({ x, gy, dir, light: SC_.LIGHT, k: kk, moon: SC_.MOON });

  // 曹操（只画案面以上）
  const cp = caoPose(t), cf = build(cp, CAO);
  if (t < T.grab) { const i = cf.parts.findIndex(p => p.name === 'armN'); cf.parts.splice(i, 0, ...slipParts(add(cf.joints.hN, [26, -30]), 0.5, { txt: S_('slip_q'), txtCol: RED, seed: 1 })); }
  ctx.save(); ctx.beginPath(); ctx.rect(-200, -200, W + 400, SC_.TABLE.front + 230); ctx.clip();
  renderFigure(ctx, CAO_X, CAO_GY, 1, cf, Object.assign({ scale: SCALE, ground: false }, night(CAO_X, CAO_GY, 1, 0.75)));
  ctx.restore();
  SC_.drawTable(ctx, t);
  SC_.drawLamp(ctx, t);

  // 传令兵（令签接过来以后在他手里）
  const r = runnerPose(t), rf = build(r.P, RUNNER);
  if (t >= T.grab) { const i = rf.parts.findIndex(p => p.name === 'armN'); rf.parts.splice(i, 0, ...slipParts(add(rf.joints.hN, [22, -34]), 0.45, { txt: S_('slip_q'), txtCol: RED, seed: 2 })); }
  rf.groundX = r.x; rf.groundY = RUN_GY + 6; rf.groundK = clamp(1 + r.oy / 200, 0.5, 1);
  renderFigure(ctx, r.x, RUN_GY + r.oy, r.dir, rf, Object.assign({ scale: SCALE, sx: r.sx, sy: r.sy }, night(r.x, RUN_GY, r.dir, NT.falloff([r.x, RUN_GY - 300], SC_.LIGHT, 900) * 0.8)));
  if (t > T.skid && t < T.skid + 0.6) { const hy = RUN_GY + r.oy - 470; burst(ctx, r.x, hy, t, T.skid + 0.02, { n: 7, r0: 40, len: 38, dur: 0.35, w: 5, col: NT.NIGHT_INK }); }

  // 答案竹简：飞行轨迹上的速度线 + 落地冲击短线
  const a = answerSlip(t);
  if (a) {
    if (t < T.land) for (let i = 1; i <= 4; i++) { const b = answerSlip(t - i * 0.025); if (!b) break; ctx.strokeStyle = `rgba(20,24,48,${0.5 - i * 0.1})`; ctx.lineWidth = 6 - i; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.p[0], a.p[1]); ctx.lineTo(b.p[0], b.p[1]); ctx.stroke(); }
    renderFigure(ctx, a.p[0], a.p[1], 1, { parts: slipParts([0, 0], a.a, { txt: S_('slip_a'), txtCol: '#141830', seed: 3 }) }, Object.assign({ scale: 1.25, ground: false, box: [400, 400, 200, 200] }, night(a.p[0], a.p[1], 1, 0.7)));
    burst(ctx, LAND_PT[0], LAND_PT[1] - 10, t, T.land, { n: 9, r0: 70, len: 50, dur: 0.42, w: 6, col: NT.NIGHT_INK });
  }
  ctx.restore();
  SC_.drawForeground(ctx, t, cam);
  NT.paperOverlay(ctx, W, H, 0.45);
  drawSubs(ctx, t);
}

function events() {
  const E = [], e = (t, type, pan = 0) => E.push({ t: +t.toFixed(3), type, pan });
  e(T.give, 'slip_hand', -0.2); e(T.grab, 'grab', 0.2); e(T.turn0, 'whoosh_small', 0.3);
  for (let m = 1; ; m++) { const tt = T.run0 + (m - 0.25) * RUN_P / 2; if (tt > T.skid) break; e(tt, 'step', 0.5); }
  e(T.fly0, 'whoosh', 0.8); e(T.skid, 'skid', 0.6); e(T.land, 'slap', -0.1); e(T.land + 0.02, 'woodblock3', -0.1); e(T.land + 0.3, 'bell', 0);
  return E;
}

module.exports = { frame, events, T, SH };
if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'still') L.still(frame, +a, b);
  else if (cmd === 'sheet') L.sheet(frame, a.split(',').map(Number), b);
  else if (cmd === 'times') console.log(JSON.stringify(T, null, 1), SH.start, SH.end);
  else if (cmd === 'events') console.log(JSON.stringify(events()));
  else if (cmd === 'video') L.video(frame, SH.start, SH.end, +(b || 60), a).then(() => console.log('done'));
}
