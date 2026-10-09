#!/usr/bin/env node
// Canvas 光影画风的渲染管线：用无头 Chromium 打开一个 HTML 动画页，逐帧调用 window.renderFrame(n)，
// 把 canvas 像素送进 ffmpeg 编码成 MP4。也可以只抽几帧拼成联系表，用来自查画面。
//
// 页面约定（示例见 examples/sky-blue-15s/sky.html）：
//   window.VIDEO = { W, H, FPS, DUR }        画布尺寸、帧率、总时长（秒）
//   window.renderFrame = n => render(n / FPS) 画第 n 帧；画面只由时间决定（固定种子随机数，不用 Date.now / Math.random）
//   页面里第一个 <canvas> 就是画面（或用 --canvas 指定选择器）
//
// 用法：
//   node render_canvas_page.js sky.html out/sky.mp4                    # 渲染全片
//   node render_canvas_page.js sky.html out/part1.mp4 --from 0 --to 20 # 只渲染一段（长片分段渲染再拼接）
//   node render_canvas_page.js sky.html out/sheet.png --stills 0.5,3,6,9,12,14.5   # 抽帧联系表
//
// 依赖：playwright（npm i playwright，或全局已装），系统里有 ffmpeg。
// 云端/Claude Code 环境里 Chromium 已预装，不要运行 playwright install。

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  console.error('找不到 playwright：先运行 npm i playwright');
  process.exit(1);
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1], i++;
    else a._.push(argv[i]);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [page_, out] = args._;
  if (!page_ || !out) { console.error('用法：node render_canvas_page.js <page.html> <out.mp4|sheet.png> [--from s] [--to s] [--stills t1,t2,...] [--crf 18] [--canvas 选择器]'); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(); // 浏览器位置由 PLAYWRIGHT_BROWSERS_PATH 决定
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('页面报错：', e.message));
  await page.goto('file://' + path.resolve(page_));
  // 等字体加载完（加载失败也不要卡死），否则前几帧会用备用字体
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 5000))]));
  const V = await page.evaluate(() => window.VIDEO);
  if (!V || (await page.evaluate(() => typeof window.renderFrame)) !== 'function') throw new Error('页面缺少 window.VIDEO 或 window.renderFrame');
  const sel = args.canvas || 'canvas';

  // 在同一次 evaluate 里画帧并取像素，页面自己的播放循环插不进来
  const grab = n => page.evaluate(([n, sel]) => {
    window.renderFrame(n);
    return document.querySelector(sel).toDataURL('image/png').split(',')[1];
  }, [n, sel]);

  if (args.stills) {
    const times = args.stills.split(',').map(Number);
    const dir = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.stills-'));
    for (let k = 0; k < times.length; k++) fs.writeFileSync(path.join(dir, `${String(k).padStart(3, '0')}.png`), Buffer.from(await grab(Math.round(times[k] * V.FPS)), 'base64'));
    const cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols), tw = 270, th = Math.round(tw * V.H / V.W);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%03d.png'),
      '-vf', `scale=${tw}:${th},tile=${cols}x${rows}`, '-frames:v', '1', out]);
    fs.rmSync(dir, { recursive: true });
    console.log(`联系表 → ${out}（${times.join('s, ')}s）`);
  } else {
    const from = Math.round(Number(args.from || 0) * V.FPS), to = Math.round(Number(args.to || V.DUR) * V.FPS);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(V.FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(args.crf || 18), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise(r => ff.on('close', r));
    const t0 = Date.now();
    for (let n = from; n < to; n++) {
      const buf = Buffer.from(await grab(n), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((n - from) % (V.FPS * 2) === 0) process.stdout.write(`\r${((n - from) / (to - from) * 100).toFixed(0)}%  `);
    }
    ff.stdin.end();
    const code = await done;
    console.log(`\r${to - from} 帧 → ${out}，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒${code ? '（ffmpeg 退出码 ' + code + '）' : ''}`);
  }
  await browser.close();
}

function run(cmd, args) { return new Promise((res, rej) => spawn(cmd, args, { stdio: 'inherit' }).on('close', c => c ? rej(new Error(cmd + ' 失败')) : res())); }

main().catch(e => { console.error(e.message); process.exit(1); });
