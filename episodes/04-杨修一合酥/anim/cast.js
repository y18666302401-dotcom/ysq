// 第 4 期人物造型（全片复用）：参数见 PROJECT.md 的"人物造型"
'use strict';
const L = require('./lib');
const { C } = L;
const { INK, taper, smooth, add } = C;

// 交领：两道赭黄领缘从两肩斜交到胸前
const crossCollar = trim => (g, R, tw, T) => {
  taper(g, [R([-0.3 * tw, -T + 10]), R([-0.02 * tw, -T * 0.72]), R([0.22 * tw, -T * 0.5])], 9, C.tc(trim), { seed: 31, ends: [0.6, 0.4] });
  taper(g, [R([0.28 * tw, -T + 8]), R([0.12 * tw, -T * 0.78]), R([0.02 * tw, -T * 0.66])], 7, C.tc(trim), { seed: 32, ends: [0.6, 0.3] });
};

const CAO = { thigh: 70, shin: 68, upper: 58, fore: 56, torso: 128, tw: 122, head: 56, foot: 56, skirt: 118, quilt: false,
  tunic: '#3E3A4A', tunicSh: '#2E2B38', tunicSh2: '#24212C', hose: '#2E2B38', hoseSh: '#24212C', hoseSh2: '#1C1A22', hoseF: '#24212C',
  hair: '#2A2220', hairSh: '#1A1414', hat: 'han', beard: true, emblem: crossCollar('#C9A14A'), guan: '#26232B' };
const YANG = { thigh: 72, shin: 70, upper: 56, fore: 54, torso: 124, tw: 100, head: 52, foot: 56, skirt: 116, quilt: false,
  tunic: '#7C93A8', tunicSh: '#5F778D', tunicSh2: '#4C6276', hose: '#5F778D', hoseSh: '#4C6276', hoseSh2: '#3C4E5E', hoseF: '#4C6276',
  hair: '#2A2220', hairSh: '#1A1414', hat: 'han', mustache: true, emblem: crossCollar('#E8DDC6'), guan: '#26232B' };
const RUNNER = { thigh: 64, shin: 62, upper: 52, fore: 50, torso: 112, tw: 100, head: 50, foot: 54, skirt: 70, quilt: false,
  tunic: '#8E6E4A', tunicSh: '#74583A', tunicSh2: '#5E4630', hose: '#4F5866', hoseSh: '#3E4652', hoseSh2: '#323843', hoseF: '#3E4652',
  hair: '#2A2220', hairSh: '#1A1414', hat: 'cap', capCol: '#3A3540', capSh: '#2A2630', emblem: crossCollar('#B9A47C') };

const OFFICER = (tunic, sh, sh2, seed) => ({ thigh: 68, shin: 66, upper: 56, fore: 54, torso: 124, tw: 116, head: 52, foot: 58, skirt: 60, quilt: true,
  tunic, tunicSh: sh, tunicSh2: sh2, hose: '#4F5866', hoseSh: '#3E4652', hoseSh2: '#323843', hoseF: '#3E4652', hair: '#2A2220', hairSh: '#1A1414', hat: 'kettle', mustache: seed % 2 === 0, beard: seed % 3 === 0 });
const OFFICERS = [OFFICER('#B08A5E', '#8C6A45', '#704F33', 1), OFFICER('#9A7550', '#7A5A3C', '#5E432C', 2), OFFICER('#B9A47C', '#9C8862', '#806E4C', 3), OFFICER('#A8825B', '#8C6A45', '#704F33', 4)];
const WORKER = { thigh: 64, shin: 62, upper: 54, fore: 52, torso: 112, tw: 104, head: 50, foot: 54, skirt: 50, quilt: false,
  tunic: '#C9B48A', tunicSh: '#AE9A70', tunicSh2: '#938058', hose: '#7A6A52', hoseSh: '#625440', hoseSh2: '#4E4232', hoseF: '#625440', hair: '#2A2220', hairSh: '#1A1414', hat: 'coif', coif: '#E8DDC6', coifSh: '#C9BBA0', emblem: crossCollar('#8C7A5E') };
const GUEST = (tunic, sh, sh2, beard) => ({ thigh: 68, shin: 66, upper: 54, fore: 52, torso: 120, tw: 108, head: 52, foot: 54, skirt: 110, quilt: false,
  tunic, tunicSh: sh, tunicSh2: sh2, hose: sh, hoseSh: sh2, hoseSh2: sh2, hoseF: sh2, hair: '#3A2A24', hairSh: '#271C18', hat: 'han', beard, mustache: !beard, emblem: crossCollar('#E8DDC6'), guan: '#26232B' });
const GUESTS = [GUEST('#8E9C7A', '#74825F', '#5E6A4C', true), GUEST('#A88A6E', '#8C7056', '#725A44', false)];
const ZHI = { thigh: 70, shin: 68, upper: 54, fore: 52, torso: 118, tw: 100, head: 52, foot: 54, skirt: 112, quilt: false,
  tunic: '#8FAE8F', tunicSh: '#739373', tunicSh2: '#5E7A5E', hose: '#739373', hoseSh: '#5E7A5E', hoseSh2: '#4A624A', hoseF: '#5E7A5E', hair: '#2A2220', hairSh: '#1A1414', hat: 'cap', capCol: '#2C2A33', capSh: '#1E1C24', emblem: crossCollar('#E8DDC6') };
const PI = Object.assign({}, ZHI, { tunic: '#5E6470', tunicSh: '#4A505B', tunicSh2: '#3A3F48', hose: '#4A505B', hoseSh: '#3A3F48', hoseSh2: '#2E3238', hoseF: '#3A3F48', mustache: true });
const SOLDIER = OFFICER('#8C7A5E', '#74643C', '#5E5030', 5);

// 进贤冠：贴头的黑帻 + 向后上方斜起的梁 + 一根簪
function addGuan(fig, S) {
  if (!S.guan) return;
  const hc = fig.joints.hc, hr = S.head * 0.8, H = ([a, b]) => add(hc, [a * hr, b * hr]);
  const cap = smooth([[-1.02, -0.3], [-0.98, -0.88], [-0.35, -1.16], [0.45, -1.08], [0.86, -0.66], [0.72, -0.5], [0.12, -0.62], [-0.5, -0.46], [-0.7, -0.1]].map(H), true, 3);
  const beam = smooth([[0.38, -1.02], [-0.55, -1.82], [-0.88, -1.66], [0.0, -0.94]].map(H), true, 2);
  const parts = [
    { name: 'guanBeam', P: beam, col: S.guan, sh: '#1A1820', lit: [5, -4], seed: 91, over: [] },
    { name: 'guan', P: cap, col: S.guan, sh: '#1A1820', lit: [6, -5], seed: 92, over: ['head', 'hair', 'ear', 'guanBeam'],
      after: g => taper(g, [H([-1.2, -0.72]), H([-0.2, -0.86]), H([0.95, -0.8])], 6, C.tc('#C9A14A'), { seed: 93, ends: [0.8, 0.8] }) },
  ];
  const i = fig.parts.findIndex(p => p.name === 'armN'); fig.parts.splice(i, 0, ...parts);
}
function build(pose, S) { const fig = C.buildMan(pose, S); addGuan(fig, S); return fig; }

// 竹简（局部坐标：中心为原点，竖放）；txt 写在中线上，col 是字的颜色
function slipParts(c, ang, { w = 30, h = 120, txt = '', txtCol = INK, seed = 0 } = {}) {
  const T = v => add(c, C.rot(v, ang));
  const body = smooth([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(T), true, 1);
  return [{ name: 'slip' + seed, P: body, col: '#D8C48A', sh: '#B9A266', lit: [5, -3], seed: 120 + seed, after: g => {
    for (const y of [-0.3, 0.3]) taper(g, [T([-w / 2 - 2, y * h]), T([0, y * h + 2]), T([w / 2 + 2, y * h])], 4, C.tc('#6B4A36'), { seed: 7 + seed, ends: [1, 1] });
    if (txt) { g.save(); const p = T([0, -h * 0.02]); g.translate(p[0], p[1]); g.rotate(ang); g.fillStyle = C.tc(txtCol); g.font = `${Math.round(w * 1.2)}px WenKai`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore(); }
  } }];
}

module.exports = { CAO, YANG, RUNNER, OFFICERS, WORKER, GUESTS, ZHI, PI, SOLDIER, build, slipParts, crossCollar };
