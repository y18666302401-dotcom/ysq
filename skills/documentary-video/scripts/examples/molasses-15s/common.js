// 两种画风共用：字体、字幕、纹理与调色层、渲染管线（canvas → ffmpeg）
'use strict';
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const fs = require('fs');
const S = require('./story');
const { W, H, rng, clamp, prog, wobble } = S;

GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');
GlobalFonts.registerFromPath('C:/Windows/Fonts/simkai.ttf', 'Kai');

// ---------- 纹理（屏幕空间固定，只生成一次） ----------
function noiseCanvas(seed, { grain = 40, blobs = 0, blobCol = '#000', blobAlpha = 0.05, base = '#ffffff' } = {}) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  const r = rng(seed);
  // 低频斑驳：许多半透明的大软斑
  for (let i = 0; i < blobs; i++) {
    const x = r() * W, y = r() * H, rad = 80 + r() * 380, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, blobCol); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = blobAlpha * (0.4 + r()); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.globalAlpha = 1;
  // 细颗粒
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * grain; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); }
  ctx.putImageData(img, 0, 0);
  return cv;
}
function vignetteCanvas(strength = 0.55, inner = 0.35) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, H * inner * 0.5, W * 0.5, H * 0.45, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return cv;
}

// ---------- 字幕 ----------
// style: { font, size, colors:{date,place,num,text}, stroke, strokeW, y, jitter(k) }
function drawSubs(ctx, t, st) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [a, b, segs] of S.SUBS) {
    if (t < a || t > b) continue;
    const fadeIn = prog(t, a, a + 0.12), fadeOut = 1 - prog(t, b - 0.12, b);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.font = `${st.size}px ${st.font}`; ctx.textBaseline = 'middle';
    const widths = segs.map(s => ctx.measureText(s[0]).width), total = widths.reduce((p, q) => p + q, 0);
    let x = W / 2 - total / 2; const y = st.y + (1 - fadeIn) * 14;
    segs.forEach(([txt, type, tOn], i) => {
      const on = type !== 'text' && tOn != null && t >= tOn;
      const pop = on ? 1 + 0.16 * Math.max(0, wobble(t - tOn, 16, 7)) + 0.12 * Math.exp(-(t - tOn) * 10) : 1;
      const col = on ? st.colors[type] : st.colors.text;
      ctx.save(); ctx.translate(x + widths[i] / 2, y); ctx.scale(pop, pop);
      if (st.jitter) { const j = st.jitter(i); ctx.translate(j[0], j[1]); ctx.rotate(j[2]); }
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.lineWidth = st.strokeW; ctx.strokeStyle = st.stroke; ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
      x += widths[i];
    });
    ctx.globalAlpha = 1;
  }
}

// ---------- 渲染 ----------
// frame(ctx, t)；hold：每张画停几帧（一拍二 = 2）
function renderVideo(frame, out, { fps = 30, hold = 1, from = 0, to = S.DUR } = {}) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = Math.round(from * fps); const N = Math.round(to * fps); let buf = null;
  return new Promise(res => {
    const write = () => {
      while (n < N) {
        if (n % hold === 0 || !buf) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; frame(ctx, n / fps); buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer); }
        const ok = ff.stdin.write(buf); n++; if (!ok) { ff.stdin.once('drain', write); return; }
      }
      ff.stdin.end();
    };
    ff.on('close', c => res(c)); write();
  });
}
function stills(frame, times, out, { cols = 5, thumbW = 324 } = {}) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d'), th = Math.round(thumbW * H / W), rows = Math.ceil(times.length / cols);
  const sheet = createCanvas(thumbW * cols, th * rows), sx = sheet.getContext('2d');
  times.forEach((t, k) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; frame(ctx, t);
    sx.drawImage(cv, (k % cols) * thumbW, Math.floor(k / cols) * th, thumbW, th);
    sx.fillStyle = '#ff0'; sx.font = '24px sans-serif'; sx.fillText(t.toFixed(2), (k % cols) * thumbW + 8, Math.floor(k / cols) * th + 28);
  });
  fs.writeFileSync(out, sheet.toBuffer('image/png'));
}
function still(frame, t, out) { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); frame(ctx, t); fs.writeFileSync(out, cv.toBuffer('image/png')); }

// 命令行：node x.js stills 1,3,5 out.png | node x.js still 7.2 out.png | node x.js video out.mp4
async function cli(frame, opts) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'stills') stills(frame, a.split(',').map(Number), b);
  else if (cmd === 'still') still(frame, Number(a), b);
  else if (cmd === 'video') { const t0 = Date.now(); const c = await renderVideo(frame, a, opts); console.log('done', c, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
}

module.exports = { createCanvas, noiseCanvas, vignetteCanvas, drawSubs, renderVideo, stills, still, cli };
