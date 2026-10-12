// 第 4 期全片：按 audio/<语言>/shots.json 的时间轴把 24 个分镜串起来
// node film.js still <t> out.png | sheet t1,t2,... out.png | shots 01,02 out.png（每镜取 3 帧）| events | video out.mp4 [fps] [t0] [t1]
// LANG_V=en 渲染英文版
'use strict';
const L = require('./lib');
const { W, H, SHOTS, drawSubs, PAPER_TEX } = L;
const ST = require('./stage');
const SHOT = Object.assign({}, require('./shotsA'), require('./shotsB'), require('./shotsC'), require('./shotsD'));
const S19 = require('./shot19');
const HOLD = 3.5;                                    // 结尾提问卡在旁白之后再停 3.5 秒
const END = SHOTS[SHOTS.length - 1].end + HOLD;
const shotAt = t => SHOTS.find((s, i) => t < s.end || i === SHOTS.length - 1);

function frame(ctx, t) {
  L.C.G.K = Math.floor(t * 12 + 1e-6);
  const s = shotAt(t);
  if (s.id === '19') { S19.frame(ctx, t); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PAPER_TEX, 0, 0);
  SHOT[s.id](ctx, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  L.NT.paperOverlay(ctx, W, H, 0.4);
  drawSubs(ctx, t);
}
function events() {
  ST.EVENTS.length = 0;
  // 音效时间都由跟词的时刻推出，与当前帧无关：每个分镜调用一次即可登记全部事件
  for (const s of SHOTS) if (s.id !== '19') SHOT[s.id](SCR, (s.start + s.end) / 2);
  const seen = new Set(), out = [];
  for (const e of ST.EVENTS.concat(S19.events())) { const k = e.type + '@' + e.t; if (!seen.has(k)) { seen.add(k); out.push(e); } }
  return out.sort((a, b) => a.t - b.t);
}
const SCR = require('@napi-rs/canvas').createCanvas(W, H).getContext('2d');

module.exports = { frame, END };
if (require.main === module) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === 'still') L.still(frame, +a, b);
  else if (cmd === 'sheet') L.sheet(frame, a.split(',').map(Number), b);
  else if (cmd === 'shots') { const ids = a.split(','), ts = []; for (const id of ids) { const s = SHOTS.find(x => x.id === id); const e = id === SHOTS[SHOTS.length - 1].id ? END : s.end; ts.push(s.start + 0.15, (s.start + e) / 2, e - 0.08); } L.sheet(frame, ts, b, 300); }
  else if (cmd === 'events') { require('fs').writeFileSync(a, JSON.stringify(events(), null, 0)); console.log('events →', a, 'END', END.toFixed(2)); }
  else if (cmd === 'video') L.video(frame, +(c || 0), +(d || END), +(b || 60), a).then(() => console.log('done'));
  else if (cmd === 'end') console.log(END);
}
