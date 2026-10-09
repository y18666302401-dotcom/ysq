// 示例：10 秒一镜到底（卡林顿事件第 4–5 镜，用户确认过效果）
// 演示：极光→怀表、夜色→望远镜、表盘→投影屏、表壳→光柱 四段液体变形；链条物理与摆动；关节手臂与呼吸、眨眼、视线。
// 运行：npm install @napi-rs/canvas
//   node test10.js stills 1,3,5,7,9 sheet.png   # 抽帧检查
//   node test10.js video out.mp4                # 渲染视频（约 1 分钟），同时写出 sim.json（链子拽住的时刻）
//   python3 sound.py                            # 合成音乐与音效 → sound.wav
//   ffmpeg -i out.mp4 -i sound.wav -c:v copy -c:a aac -shortest final.mp4
const Lb = require('./lib'); const fs = require('fs'); const { spawn } = require('child_process');
const { W, H, C, CH, FLARE, clamp, lerp, prog, easeIO, easeOut, easeIn, backOut, wobble, rng, mix, rgba, poly, circle, rect, rrect, line, text, nameplate, watch, stars } = Lb;
const FPS = 30, DUR = 10.0;

// 液体变形、链条物理、关节手臂都来自 skill 的工具库
const { centroid, norm, morph, settle, blobPath, circlePts: circ, rectPts: rectP, chainSim, squash, ik2: ik, limb } = require('../../flat_toolkit');

// ---------- 极光帘幕（多边形，供变形用） ----------
function curtain(k, t) {
  const top = [], bot = [], x1 = -150, x2 = W + 150, N = 50;
  for (let i = 0; i <= N; i++) {
    const x = lerp(x1, x2, i / N), u = i / N, env = Math.sin(u * Math.PI);
    const y = 560 + k * 110 + Math.sin(x * 0.006 + t * 0.9 + k * 1.7) * 90 + Math.sin(x * 0.017 - t * 1.3 + k) * 30;
    const h = 900 * (0.55 + 0.45 * Math.sin(x * 0.011 + t * 0.7 + k * 2.1)) * env * (1 - k * 0.22);
    top.push([x, y - h * 0.25]); bot.push([x, y + h * 0.75]);
  }
  return top.concat(bot.reverse());
}
const AUR_COL = [C.green, C.pink, mix(C.green, C.cyan, 0.3)];

// ---------- 场景时间点 ----------
const T = { m1a: 1.1, m1b: 2.9, drop: 2.9, rewA: 3.2, rewB: 5.2, m2a: 5.9, m2b: 7.3, inkA: 4.3, inkB: 5.9, discA: 7.0, discB: 7.9, camA: 6.4, camB: 9.4, name: 8.2, drawA: 7.4 };
const WATCH0 = [400, 470], WR = 170;
const BOARD = [280, 460, 520, 600], DISC = [540, 760, 200];
const TUBE = [[-300, -560], [-150, -620], [300, 420], [190, 480]];
const SHAFT = [[640, -500], [1000, -500], [820, 1700], [330, 1700]];

// ---------- 物理：挂怀表的链子 ----------
const SIM = chainSim({ anchor: [720, -60], end: [WATCH0[0], WATCH0[1] - WR * 1.12], length: 880, t0: T.drop, duration: DUR - T.drop });
fs.writeFileSync(__dirname + '/sim.json', JSON.stringify({ tCatch: SIM.tCatch }));
function watchState(t) {
  if (t < T.drop) return { x: WATCH0[0], y: WATCH0[1], ang: 0, sq: 0, chain: null };
  const f = SIM.at(t), b = f.pts[f.pts.length - 1];
  const sq = squash(t, SIM.tCatch);
  return { x: b[0], y: b[1] + WR * 1.12, ang: f.angle, sq, chain: f.pts };
}

// ---------- 卡林顿：关节人物 ----------
function carringtonRig(ctx, t, pen, { draw = 0 } = {}) {
  const X = 170, Y = 1130, s = 0.78, breathe = Math.sin(t * 2 * Math.PI / 3.4);
  const blink = (() => { const u = (t + 0.4) % 3.1; return u < 0.15 ? Math.sin(u / 0.15 * Math.PI) : 0; })();
  // 视线跟着笔尖；画画时头微微点动
  const look = Math.atan2(pen[1] - (Y - 260 * s), pen[0] - X) * 0.18 + Math.sin(t * 6.2) * 0.015 * draw;
  const lean = 0.03 * draw + 0.006 * breathe;
  ctx.save(); ctx.translate(X, Y); ctx.rotate(lean); ctx.scale(s, s * (1 + 0.012 * breathe));
  // 远侧肩背
  poly(ctx, [[-330, 420], [-300, 120], [-160, 60], [40, 40], [190, 100], [260, 420]], CH.coat);
  poly(ctx, [[-330, 420], [-300, 120], [-160, 60], [-80, 60], [-110, 420]], CH.coatD);
  poly(ctx, [[-30, 70], [70, 70], [40, 420], [-60, 420]], CH.vest);
  // 怀表链（次级运动：跟着呼吸和身体晃）
  const sw = Math.sin(t * 2.3) * 6 + lean * 120;
  line(ctx, [[-10, 250], [25 + sw * 0.3, 290 + Math.abs(sw) * 0.2], [62, 255]], C.mustard, 6);
  poly(ctx, [[-90, 50], [-40, 140], [-20, 70]], CH.coatD); poly(ctx, [[60, 60], [130, 60], [80, 150]], CH.coatD);
  poly(ctx, [[-50, -10], [80, -20], [90, 50], [40, 95], [-10, 70], [-60, 40]], CH.cravat);
  poly(ctx, [[40, 40], [100, 50], [70, 120]], CH.cravatD);
  // 头：绕脖子转动
  ctx.save(); ctx.translate(0, -40); ctx.rotate(look); ctx.translate(0, 40);
  poly(ctx, [[-40, -60], [60, -60], [70, 0], [-40, 0]], CH.skinD);
  poly(ctx, [[-90, -360], [40, -380], [95, -320], [100, -250], [150, -170], [110, -160], [120, -120], [95, -100], [100, -70], [60, -30], [-30, -30], [-80, -120]], CH.skin);
  poly(ctx, [[-90, -360], [-10, -365], [-20, -30], [-30, -30], [-80, -120]], CH.skinD);
  poly(ctx, [[-60, -230], [-5, -235], [15, -120], [5, -40], [-40, -30], [-75, -110]], CH.hair);
  poly(ctx, [[-50, -200], [-20, -200], [-10, -80], [-40, -60]], CH.hairD);
  poly(ctx, [[-85, -250], [-60, -255], [-55, -200], [-80, -195]], CH.skinD);
  poly(ctx, [[-150, -250], [-140, -370], [-60, -430], [40, -420], [110, -370], [70, -360], [-20, -355], [-80, -330], [-92, -250], [-118, -205], [-150, -215]], CH.hair);
  poly(ctx, [[-110, -380], [-40, -420], [10, -415], [-60, -390]], CH.hairH);
  poly(ctx, [[40, -305], [100, -308 - draw * 3], [98, -296 - draw * 3], [42, -293]], CH.hairD);
  ctx.save(); ctx.translate(76, -275); ctx.scale(1, Math.max(0.08, 1 - blink));
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, 7); ctx.fillStyle = '#f5ecda'; ctx.fill(); circle(ctx, 9, 2, 8, CH.eye); circle(ctx, 10, 2, 3.5, CH.hairD); ctx.restore();
  poly(ctx, [[100, -128], [124, -126], [100, -120]], '#8a3e30');
  ctx.restore();
  ctx.restore();
  // 近侧手臂：肩—肘—手，两段 IK；肩膀随画画的动作轻微前送
  const S = [X + Math.cos(lean) * 150 * s - 70 * s * Math.sin(lean) + draw * 6 * Math.sin(t * 6.2), Y + 90 * s + Math.sin(lean) * 150 * s];
  const wrist = [pen[0] - 70, pen[1] - 50];
  const E = ik(S, wrist, 270, 260);
  limb(ctx, S, E, 46, 40, CH.coat); limb(ctx, E, wrist, 40, 30, CH.coatD);
  rect(ctx, 0, 0, 0, 0, C.ink);
  // 手与铅笔（笔尖 = pen）
  const ha = Math.atan2(pen[1] - wrist[1], pen[0] - wrist[0]);
  ctx.save(); ctx.translate(wrist[0], wrist[1]); ctx.rotate(ha);
  poly(ctx, [[-10, -26], [40, -30], [62, -6], [50, 24], [0, 26]], CH.skin); poly(ctx, [[-10, -26], [16, -28], [10, 26], [0, 26]], CH.skinD);
  ctx.restore();
  line(ctx, [[wrist[0] + Math.cos(ha) * 30, wrist[1] + Math.sin(ha) * 30], pen], C.mustard, 9);
  circle(ctx, pen[0], pen[1], 5, C.ink);
}

// ---------- 天文台 ----------
function sunDisc(ctx, x, y, r) {
  circle(ctx, x, y, r, mix(C.cream, C.mustard, 0.1));
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0.6, 0.6 + Math.PI); ctx.closePath(); ctx.fillStyle = mix(C.cream, C.mustard, 0.24); ctx.fill(); ctx.restore();
  const pts = [[0.05, -0.1, 0.11], [0.18, -0.02, 0.08], [-0.08, 0.02, 0.07], [0.26, 0.08, 0.05], [-0.18, -0.12, 0.05], [0.1, 0.12, 0.06]];
  for (const [dx, dy, s] of pts) circle(ctx, x + r * (0.12 + dx), y + r * (0.05 + dy), s * r * 1.5, mix(C.cream, C.rust, 0.35));
  for (const [dx, dy, s] of pts) circle(ctx, x + r * (0.12 + dx), y + r * (0.05 + dy), s * r * 0.8, C.ink);
}

function drawM2(t, w, m2) {
  // 光柱：由怀表的金色表壳流变而成
  if (m2 > 0) {
    const src = norm(circ(w.x, w.y, WR));
    ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * (1 - m2);
    blobPath(ctx, m2 < 1 ? morph(src, SHAFT_N, m2, t, { amp: 30, sag: 60, seed: 2 }) : settle(SHAFT_N, t - T.m2b, t, 10), mix(C.mustard, mix(C.cream, C.mustard, 0.35), m2));
    ctx.restore();
    const R = rng(3); for (let i = 0; i < 26; i++) { const x = 380 + R() * 520, y = ((R() * 1700 + t * 22 * (0.5 + R())) % 1700) - 200; ctx.globalAlpha = 0.6 * m2; rect(ctx, x + Math.sin(t + i) * 10, y, 5, 5, C.cream); ctx.globalAlpha = 1; }
  }
  // 投影屏：由表盘流变而成
  if (m2 > 0) {
    const src = norm(circ(w.x, w.y, WR * 0.84));
    blobPath(ctx, m2 < 1 ? morph(src, BOARD_N, m2, t, { amp: 24, sag: 50, seed: 5 }) : settle(BOARD_N, t - T.m2b, t, 8), mix(C.cream, mix(C.cream, C.ink, 0.05), m2));
  }
}
// ---------- 每一帧 ----------
const cv = Lb.createCanvas(W, H), ctx = cv.getContext('2d');
const RECT_INK = norm(rectP(-400, -400, W + 800, H + 800)), TUBE_N = norm(TUBE);
const BOARD_N = norm(rectP(...BOARD)), SHAFT_N = norm(SHAFT);
function frame(t, fi) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cp = easeIO(prog(t, T.camA, T.camB));
  const cs = lerp(1, 0.84, cp), cx = lerp(540, 430, cp), cy = lerp(960, 930, cp);
  ctx.save(); ctx.translate(540, 960); ctx.scale(cs, cs); ctx.translate(-cx, -cy);
  // —— 白天的天文台（被夜色盖住，夜色流进望远镜后露出来） ——
  rect(ctx, -700, -700, W + 1400, H + 1400, mix(C.cream, C.rust, 0.28));
  rect(ctx, -700, 1420, W + 1400, 900, mix(C.rust, C.ink, 0.55));
  rect(ctx, 530, 1060, 20, 360, mix(C.rust, C.ink, 0.5));
  const w = watchState(t);
  const m2 = prog(t, T.m2a, T.m2b);
  if (m2 >= 1) drawM2(t, w, m2);
  // 太阳圆盘：从屏中央像液滴一样涨开
  const dp = prog(t, T.discA, T.discB);
  if (dp > 0) {
    const r = DISC[2] * easeOut(dp);
    ctx.save(); ctx.beginPath();
    const pts = circ(DISC[0], DISC[1], r).map(([x, y], i) => { const k = 1 + Math.sin(i * 0.4 + t * 8) * 0.05 * (1 - dp); return [DISC[0] + (x - DISC[0]) * k, DISC[1] + (y - DISC[1]) * k]; });
    blobPath(ctx, pts, mix(C.cream, C.mustard, 0.1)); ctx.clip();
    sunDisc(ctx, DISC[0], DISC[1], DISC[2]); ctx.restore();
  }
  // 卡林顿
  if (t > T.inkA) {
    const drawing = easeOut(prog(t, T.drawA, T.drawA + 0.6));
    const pen = [lerp(360, DISC[0] + 20 + Math.cos(t * 3.1) * 30, drawing), lerp(1180 + Math.sin(t * 1.8) * 6, DISC[1] + 30 + Math.sin(t * 4.3) * 20, drawing)];
    carringtonRig(ctx, t, pen, { draw: drawing });
  }
  // —— 夜色：先铺满，再流进望远镜筒 ——
  const ip = prog(t, T.inkA, T.inkB);
  const inkPts = ip <= 0 ? RECT_INK : ip < 1 ? morph(RECT_INK, TUBE_N, ip, t, { stagger: 0.55, amp: 40, sag: 30, seed: 1 }) : settle(TUBE_N, t - T.inkB, t, 6);
  const inkCol = mix(C.ink, C.navy, ip);
  ctx.save(); blobPath(ctx, inkPts, inkCol); ctx.clip();
  if (ip < 1) { ctx.globalAlpha = 1 - ip; stars(ctx, t, 1, 0); stars(ctx, t + 2, 0.8, -900); ctx.globalAlpha = 1; }
  ctx.restore();
  if (ip >= 0.98) { poly(ctx, [[-300, -560], [-225, -590], [245, 450], [190, 480]], mix(C.navy, C.ink, 0.4)); rect(ctx, 188, 420, 90, 70, C.mustard); }
  if (m2 > 0 && m2 < 1) drawM2(t, w, m2);
  // —— 极光 → 怀表（液体变形 1） ——
  const m1 = prog(t, T.m1a, T.m1b);
  if (t < T.m1b) {
    const tgt = [norm(circ(...WATCH0, WR)), norm(circ(WATCH0[0], WATCH0[1], WR * 0.84)), norm(circ(...WATCH0, WR * 0.95))];
    [0, 2, 1].forEach(k => {
      const src = norm(curtain(k, Math.min(t, T.m1a)));
      const pts = m1 <= 0 ? norm(curtain(k, t)) : morph(src, tgt[k], m1, t, { stagger: 0.5, amp: 34, sag: 90, seed: k * 2 });
      const col = k === 1 ? mix(C.pink, C.cream, m1) : mix(AUR_COL[k], C.mustard, m1);
      ctx.globalAlpha = lerp(0.85, 1, m1); blobPath(ctx, pts, col); ctx.globalAlpha = 1;
    });
  }
  // —— 怀表：落下、被链子拽住、摆动 ——
  if (t >= T.m1b && m2 < 1) {
    const chainLen = easeOut(prog(t, T.m1b - 0.3, T.m1b + 0.3));
    const retract = easeIn(prog(t, T.m2a, T.m2a + 0.8));
    if (w.chain) {
      const pts = w.chain, n = pts.length, k0 = Math.round((n - 1) * (1 - chainLen)), k1 = Math.round((n - 1) * (1 - retract));
      if (k1 - k0 >= 1) line(ctx, pts.slice(k0, k1 + 1), C.mustard, 7);
    }
    if (m2 <= 0) {
      ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1 + w.sq, 1 - w.sq); ctx.translate(-w.x, -w.y);
      const rw = easeIO(prog(t, T.rewA, T.rewB)), mins = lerp(25 * 60, 11 * 60 + 18, rw);
      const det = easeOut(prog(t, T.m1b - 0.1, T.m1b + 0.4));
      watch(ctx, w.x, w.y, WR, Math.floor(mins / 60), mins % 60, { swing: w.ang, chain: false, pivot: FLARE });
      if (det < 1) { ctx.globalAlpha = 1 - det; circle(ctx, w.x, w.y, WR * 0.84, C.cream); ctx.globalAlpha = 1; }
      ctx.restore();
    }
  }
  ctx.restore();
  Lb.finish(ctx, fi);
  nameplate(ctx, 70, 170, '理查德·卡林顿', '1826–1875 · 英国天文学家', prog(t, T.name, T.name + 0.9));
}

const mode = process.argv[2];
if (mode === 'stills') {
  const times = process.argv[3].split(',').map(Number), sw = 270, sh = 480, cols = 6, rows = Math.ceil(times.length / cols);
  const sheet = Lb.createCanvas(sw * cols, sh * rows), sx = sheet.getContext('2d');
  times.forEach((t, k) => { frame(t, k); sx.drawImage(cv, (k % cols) * sw, Math.floor(k / cols) * sh, sw, sh); sx.fillStyle = '#ff0'; sx.font = '22px NSB'; sx.fillText(t.toFixed(1), (k % cols) * sw + 6, Math.floor(k / cols) * sh + 24); });
  fs.writeFileSync(process.argv[4], sheet.toBuffer('image/png'));
} else {
  const out = process.argv[3];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0; const N = Math.round(DUR * FPS);
  const write = () => { while (n < N) { frame(n / FPS, n); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++; if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
  ff.on('close', c => console.log('done', c)); write();
}
