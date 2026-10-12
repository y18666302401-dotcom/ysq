// 表情表：每个人物 × 7 种表情的头部特写（新造型做完先跑一张，看五官和表情）
// node face_sheet.js out.png   —— 换成本期的人物：改 SPEC
'use strict';
const fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');
const NEW = require('./char34');
const { INK, PAPER } = NEW;
const SPEC = {
  MODENA: { thigh: 70, shin: 68, upper: 56, fore: 54, torso: 124, tw: 104, head: 50, foot: 58, skirt: 46, quilt: true, tunic: '#D9C7A0', tunicSh: '#B9A47C', tunicSh2: '#A08B64', hose: '#4E6E8E', hoseSh: '#3B5672', hoseSh2: '#2E445B', hoseF: '#3B5672', hair: '#3A2A24', hairSh: '#271C18', hat: 'kettle', mustache: true },
  BOLOGNA: { thigh: 66, shin: 64, upper: 54, fore: 52, torso: 118, tw: 112, head: 52, foot: 56, skirt: 40, quilt: false, tunic: '#7C93A8', tunicSh: '#5F778D', tunicSh2: '#4C6276', hose: '#8C7A5E', hoseSh: '#6E5E46', hoseSh2: '#574A37', hoseF: '#6E5E46', hair: '#6B4A30', hairSh: '#4E3522', hat: 'coif', coif: '#E8DDC6', coifSh: '#C9BBA0', beard: true },
  WOMAN: { thigh: 58, shin: 58, upper: 48, fore: 46, torso: 104, tw: 92, head: 46, foot: 46, skirt: 108, quilt: false, tunic: '#9DB08A', tunicSh: '#7E9270', tunicSh2: '#687B5B', hose: '#9DB08A', hoseSh: '#7E9270', hoseSh2: '#687B5B', hoseF: '#7E9270', hair: '#5A3A28', hairSh: '#40291C', hat: 'coif', coif: '#F2EBDD', coifSh: '#D3C8B2' },
  BOY: { thigh: 44, shin: 44, upper: 36, fore: 34, torso: 80, tw: 74, head: 44, foot: 40, skirt: 30, quilt: false, tunic: '#C9774E', tunicSh: '#A65E3B', tunicSh2: '#8E4E30', hose: '#6F7F5A', hoseSh: '#5A6848', hoseSh2: '#4A563B', hoseF: '#5A6848', hair: '#8A5A34', hairSh: '#6A4226' },
};
const BASE = { fN: [26, 0], fF: [-28, 0], hN: [30, -150], hF: [-10, -150], lean: 0, elbowPref: [-0.5, 1] };
const EXPR = [
  ['平静', { look: [1, 0] }],
  ['得意', { look: [0.3, 0], smile: 0.9, brow: 0.6, lid: 0.35 }],
  ['吃惊', { look: [1, -0.1], mouth: 0.8, brow: 1.8 }],
  ['生气', { look: [1, 0.1], mouth: 0.5, smile: -0.5, brow: -1.4 }],
  ['发愁', { look: [0.6, 0.3], smile: -0.6, brow: 0.6, browAng: -0.8, lid: 0.3 }],
  ['鬼祟', { look: [-0.9, 0], smile: 0.5, brow: -0.6, lid: 0.45 }],
  ['睡着', { blink: 1, mouth: 0.25, brow: -0.2 }],
];
function headShot(lib, spec, expr, size = 300, sc = 4.2) {
  const big = createCanvas(1500, 1500), b = big.getContext('2d'); b.fillStyle = PAPER; b.fillRect(0, 0, 1500, 1500); const box = [2000, 2400, 1000, 2300];
  const P = Object.assign({}, BASE, expr), fig = lib.buildMan(P, spec), x = 750, gy = 1480, hc = fig.joints.hc;
  // 把头放到画布中间：先算头在世界坐标的位置，再平移
  const hx = x + sc * hc[0], hy = gy + sc * hc[1];
  b.save(); b.translate(750 - hx, 640 - hy); lib.renderFigure(b, x, gy, 1, fig, { scale: sc, ground: false, box }); b.restore();
  const c = createCanvas(size, size), cx = c.getContext('2d'); const crop = spec.head * sc * 1.55; cx.drawImage(big, 750 - crop + spec.head * sc * 0.15, 640 - crop * 0.95, crop * 2, crop * 2, 0, 0, size, size); return c;
}
(async () => {
  const S = 270, cols = EXPR.length, padL = 250, top = 120, W = padL + cols * S + 40, rows = ['MODENA', 'BOLOGNA', 'WOMAN', 'BOY'], H = top + rows.length * (S + 20) + 60;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d'); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const label = (t, x, y, s = 40, a = 'center', c = INK) => { ctx.fillStyle = c; ctx.font = `${s}px YaHeiB`; ctx.textAlign = a; ctx.fillText(t, x, y); };
  label('表情表', W / 2, 70, 52);
  // 表情表
  const t2 = top + 40;
  EXPR.forEach(([nm], j) => label(nm, padL + j * S + S / 2, t2 - 6, 34));
  const names = { MODENA: '戴铁盔的士兵', BOLOGNA: '戴头巾的守卫', WOMAN: '妇女', BOY: '男孩（无帽）' };
  rows.forEach((r, i) => { label(names[r], padL - 16, t2 + 20 + i * (S + 20) + S / 2, 30, 'right'); EXPR.forEach(([, ex], j) => ctx.drawImage(headShot(NEW, SPEC[r], ex, S - 10), padL + j * S, t2 + 20 + i * (S + 20))); });
  fs.writeFileSync(process.argv[2] || 'face_sheet.png', cv.toBuffer('image/png'));
})();
