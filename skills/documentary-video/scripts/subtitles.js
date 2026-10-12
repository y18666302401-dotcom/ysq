// 字幕：断行 + 去标点 + 重点词标色 + 自查。所有画风共用（canvas 渲染）。
//
// 用法（动画入口里）：
//   const SUB = require('<skill>/scripts/subtitles.js');
//   const hl = SUB.loadHighlights(ROOT);                       // 项目根目录的 highlights.json
//   const subs = SUB.buildSubs(shots, lang, hl, charTime);     // charTime(shot, i)：原文第 i 个字符的发音时刻
//   SUB.drawSubs(ctx, t, subs, lang, { W, y: 1395, font: 'YaHeiB', size: {zh: 66, en: 58}, stroke: '#1a1410' });
// 自查（每种语言渲染前必跑，输出贴给自己看）：
//   node subtitles.js <项目根目录> zh|en
//
// highlights.json（阶段 2 和脚本一起写，见 02-script.md）：
//   { "zh": {"name": ["王羲之"], "place": ["建康"], "date": ["东晋"], "num": ["三百多斤"], "key": ["吃墨"]},
//     "en": {"name": ["Wang Xizhi"], ...} }
// 时间（年份、朝代、世纪）和数字会自动识别；人名、地名、关键转折必须写在 highlights.json 里。
// 手写的词优先于自动识别；每行最多标 3 处。

const fs = require('fs'), path = require('path');

const COLORS = { date: '#E8B04A', place: '#8EC5E8', num: '#E5483A', key: '#E5483A', name: '#9FE3B4', text: '#F3EBDD' };

// ---------- 去标点（rules.md 第 3 节） ----------
const ZH_DROP = /[“”‘’"「」『』《》〈〉（）()【】\[\]…·]/g;
const ZH_SPACE = /[，、：；—–\-]+|[。！？!?.]+(?=.)/g;
const EN_DROP = /["“”()\[\]…]|(?<![A-Za-z])['‘’]|['‘’](?![A-Za-z])/g;   //  = 分段记号，当作字母看
const EN_SPACE = /\s*(?:[,;:]|—|–|--|\s-\s)\s*|[.!?]+\s+(?=\S)/g;
function cleanText(s, lang) {
  if (lang === 'zh') return s.replace(ZH_DROP, '').replace(ZH_SPACE, '　').replace(/[。！？!?.]+$/, '').replace(/　+/g, '　');
  return s.replace(EN_DROP, '').replace(EN_SPACE, ' ').replace(/[.!?]+(\s*)$/, '$1').replace(/ {2,}/g, ' ');
}

// ---------- 重点词 ----------
function loadHighlights(root) {
  const f = path.join(root, 'highlights.json');
  if (!fs.existsSync(f)) { console.warn('[subtitles] 没有 highlights.json：人名、地名、关键转折不会标色'); return { zh: {}, en: {} }; }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const CN = '零〇一二两三四五六七八九十百千万亿几';
const AUTO = {
  zh: [
    ['date', new RegExp(`(?:公元前|公元)?[0-9${CN}]+年(?:[0-9${CN}]+月)?(?:[0-9${CN}]+日)?|[0-9${CN}]+世纪|[0-9${CN}]+月[0-9${CN}]+日`, 'g')],
    ['date', /春秋|战国|秦朝|西汉|东汉|汉朝|三国|西晋|东晋|南北朝|隋朝|唐朝|北宋|南宋|宋朝|元朝|明朝|清朝|民国/g],
    ['num', new RegExp(`[0-9][0-9.,]*(?:多|余)?[万亿千百]?(?:%|个|只|斤|里|米|公里|岁|天|人|次|首|座|匹|头|名|位|分钟|秒|倍|两|文|贯|丈|尺|寸|小时|年)?|[${CN}]{2,}(?:多|余)?(?:个|只|斤|里|米|公里|岁|天|人|次|首|座|匹|头|名|位|分钟|秒|倍|两|文|贯|丈|尺|寸|小时|年)|[三四五六七八九十百千万](?:多|余)?(?:斤|里|米|公里|岁|天|次|首|座|匹|名|分钟|秒|倍|贯|丈|尺|小时)`, 'g')],
  ],
  en: [
    ['date', /\b(?:\d{1,4}\s?(?:BC|BCE|AD|CE)|(?:AD|BC)\s?\d{1,4}|1\d{3}s?|20\d{2}s?|\d{1,2}(?:st|nd|rd|th) century|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2})\b/g],
    ['num', /\b\d[\d,.]*(?:\s?(?:%|percent|million|billion|thousand|hundred|miles?|yards?|kilometers?|km|meters?|feet|foot|pounds?|kg|years?|days?|hours?|minutes?|seconds?|times))?\b/g],
  ],
};
// 返回 [[start, end, type], ...]，按位置排序、不重叠
function findTerms(text, lang, hl) {
  const out = [], taken = new Uint8Array(text.length);
  const put = (a, b, type) => { for (let k = a; k < b; k++) if (taken[k]) return; for (let k = a; k < b; k++) taken[k] = 1; out.push([a, b, type]); };
  const manual = Object.entries((hl && hl[lang]) || {}).flatMap(([type, list]) => list.map(w => [w, type])).sort((p, q) => q[0].length - p[0].length);
  for (const [w, type] of manual) {
    let i = -1;
    while ((i = (lang === 'en' ? text.toLowerCase().indexOf(w.toLowerCase(), i + 1) : text.indexOf(w, i + 1))) >= 0) put(i, i + w.length, type);
  }
  for (const [type, re] of AUTO[lang] || []) { re.lastIndex = 0; let m; while ((m = re.exec(text))) if (m[0].trim()) put(m.index, m.index + m[0].length, type); }
  return out.sort((p, q) => p[0] - q[0]);
}

// ---------- 断行 ----------
// 返回 [[a, b, segs, rawLine]]，segs = [[文字, 类型, 变色时刻]]
// 人名、地名反复出现时只在全片前 2 次标色（同一个名字每行都变色会满屏彩色），其余类型每次都标。
function buildSubs(shots, lang, hl, charTime, { repeatLimit = 2 } = {}) {
  const maxLen = lang === 'zh' ? 14 : 32, out = [], seen = {};
  for (const shot of shots) {
    const text = shot.text.replace(/<[^>]+>/g, '');
    const terms = findTerms(text, lang, hl);
    const groups = lang === 'zh' ? splitZh(text, maxLen, terms) : splitEn(text, maxLen, terms);
    groups.forEach(([i0, i1], gi) => {
      const a = gi === 0 ? shot.start + 0.02 : charTime(shot, i0) - 0.08;
      const b = gi < groups.length - 1 ? charTime(shot, groups[gi + 1][0]) - 0.1 : shot.end - 0.04;
      // 本行内的重点词（最多 3 个，手写的优先已在 findTerms 里处理）
      const inLine = terms.filter(([s, e, type]) => {
        if (s < i0 || e > i1) return false;
        if (type !== 'name' && type !== 'place') return true;
        const k = text.slice(s, e).toLowerCase(); seen[k] = (seen[k] || 0) + 1;
        return seen[k] <= repeatLimit;
      }).slice(0, 3);
      const segs = []; let p = i0;
      for (const [s, e, type] of inLine) {
        if (s > p) segs.push([text.slice(p, s), 'text', null]);
        segs.push([text.slice(s, e), type, charTime(shot, s)]); p = e;
      }
      if (p < i1) segs.push([text.slice(p, i1), 'text', null]);
      // 整行一起去标点（分段处插入记号，避免 Su Shi|'s 这类跨段的撇号被误删），再按记号拆回各段
      const parts = cleanText(segs.map(q => q[0]).join(''), lang).split('');
      const clean = segs.map(([, ty, tOn], k) => [parts[k] || '', ty, tOn]);
      if (clean.length) { clean[0][0] = clean[0][0].replace(/^[\s　]+/, ''); const L = clean[clean.length - 1]; L[0] = L[0].replace(/[\s　]+$/, ''); }
      const kept = clean.filter(q => q[0]);
      if (kept.length) out.push([a, b, kept, text.slice(i0, i1)]);
    });
  }
  return out;
}
const inside = (k, terms) => terms.some(([s, e]) => k > s && k < e);   // 不在重点词中间断行
function splitZh(text, maxLen, terms) {
  const parts = [], re = /[^，。、：；！？—]+[，。、：；！？—”」』）]*/g; let m;
  while ((m = re.exec(text))) parts.push([m.index, m.index + m[0].length]);
  const len = q => text.slice(q[0], q[1]).replace(/[，。、：；！？—“”‘’「」『』《》（）]/g, '').length;   // 去标点后的字数
  const raw = []; let cur = null;
  for (const [s, e] of parts) {
    if (cur && len([cur[0], e]) > maxLen) { raw.push(cur); cur = null; }
    cur = cur ? [cur[0], e] : [s, e];
  }
  if (cur) raw.push(cur);
  const out = [];
  for (const [s, e] of raw) {
    if (len([s, e]) <= maxLen + 1) { out.push([s, e]); continue; }
    const L = e - s;
    const n = Math.ceil(L / maxLen), per = L / n; let a = s;
    for (let k = 1; k < n; k++) {
      let best = Math.round(s + per * k), bd = 1e9;
      for (let c = a + 3; c < e - 2; c++) {
        if (inside(c, terms)) continue;
        const d = Math.abs(c - (s + per * k)) - ('的了在和与是里上中着过把被给'.includes(text[c - 1]) ? 1.5 : 0) - (terms.some(([ts, te]) => c === ts || c === te) ? 1.5 : 0);
        if (d < bd) { bd = d; best = c; }
      }
      out.push([a, best]); a = best;
    }
    out.push([a, e]);
  }
  return out;
}
function splitEn(text, maxLen, terms) {
  const words = []; const re = /\S+\s*/g; let m;
  while ((m = re.exec(text))) words.push([m.index, m.index + m[0].length]);
  const L = text.trim().length, lim = Math.min(maxLen, Math.ceil(L / Math.ceil(L / maxLen)) + 4);
  const groups = []; let cur = null;
  const str = g => text.slice(g[0], g[1]).trim();
  words.forEach(([s, e], wi) => {
    if (cur && str([cur[0], e]).length > lim && !inside(s, terms)) {
      const lw = text.slice(cur[0], cur[1]).match(/(\S+\s*)$/)[1];
      const back = cur[1] - lw.length;
      if (/^(a|an|the|of|in|into|to|at|on|by|for|from|with|and|its|his|her|their)\s*$/i.test(lw) && back > cur[0]) { groups.push([cur[0], back]); cur = [back, cur[1]]; }
      else { groups.push(cur); cur = null; }
    }
    cur = cur ? [cur[0], e] : [s, e];
    const nxt = words[wi + 1];
    if (nxt && /[,.;—]\s*$/.test(text.slice(s, e)) && str(cur).length >= 14 && str([cur[0], nxt[1]]).length > maxLen * 0.6 && !inside(e, terms)) { groups.push(cur); cur = null; }
  });
  if (cur) groups.push(cur);
  return groups;
}

// ---------- 绘制 ----------
// 重点词：读到的那一刻变色 + 回弹放大；人名常驻略大一号（1.08）。
function drawSubs(ctx, t, subs, lang, o) {
  const W = o.W || 1080, size = (o.size && o.size[lang]) || (lang === 'zh' ? 66 : 58), colors = Object.assign({}, COLORS, o.colors || {});
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [a, b, segs] of subs) {
    if (t < a || t > b) continue;
    const fadeIn = Math.min(1, Math.max(0, (t - a) / 0.1)), fadeOut = Math.min(1, Math.max(0, (b - t) / 0.1));
    ctx.globalAlpha = Math.min(fadeIn, fadeOut); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const fontOf = ty => `${Math.round(size * (ty === 'name' ? 1.08 : 1))}px ${o.font || 'sans-serif'}`;
    const widths = segs.map(([s, ty]) => { ctx.font = fontOf(ty); return ctx.measureText(s).width; });
    let x = W / 2 - widths.reduce((p, q) => p + q, 0) / 2; const y = (o.y || 1395) + (1 - fadeIn) * 12;
    segs.forEach(([s, ty, tOn], i) => {
      const on = ty !== 'text' && tOn != null && t >= tOn, dt = on ? t - tOn : 0;
      const pop = on ? 1 + 0.18 * Math.exp(-dt * 9) * Math.cos(dt * 22) : 1;
      ctx.save(); ctx.font = fontOf(ty); ctx.translate(x + widths[i] / 2, y); ctx.scale(pop, pop);
      ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || 12; ctx.strokeStyle = o.stroke || '#1a1410';
      ctx.strokeText(s, -widths[i] / 2, 0);
      ctx.fillStyle = on ? colors[ty] : colors.text; ctx.fillText(s, -widths[i] / 2, 0); ctx.restore();
      x += widths[i];
    });
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- 自查 ----------
// 打印每行字幕（重点词用 [类型:词] 标出），并报告：标色行占比、没对上旁白的手写词、标点残留。
function audit(subs, lang, hl) {
  let lit = 0, bad = 0; const used = new Set();
  for (const [a, b, segs] of subs) {
    const n = segs.filter(s => s[1] !== 'text').length; if (n) lit++;
    segs.forEach(s => { if (s[1] !== 'text') used.add(s[0].toLowerCase()); });
    const line = segs.map(([s, ty]) => ty === 'text' ? s : `[${ty}:${s}]`).join('');
    const punct = /[，。、：；！？“”《》（）,;:!?"()]|\.(?!\w)/.test(segs.map(s => s[0]).join(''));
    if (punct) bad++;
    console.log(`${a.toFixed(2).padStart(6)}  ${line}${punct ? '   ← 残留标点' : ''}`);
  }
  const missing = Object.values((hl && hl[lang]) || {}).flat().filter(w => !used.has(cleanText(w, lang).toLowerCase()));
  const ratio = lit / Math.max(1, subs.length);
  console.log(`\n标色行 ${lit}/${subs.length}（${Math.round(ratio * 100)}%）${ratio < 0.4 ? '  ← 偏少：补 highlights.json 里的人名、地名、关键转折' : ''}`);
  if (missing.length) console.log('highlights.json 里这些词没在字幕中出现（错字或旁白改过）：' + missing.join('、'));
  if (bad) console.log(`有 ${bad} 行残留标点`);
  return { ratio, missing, bad };
}

module.exports = { COLORS, cleanText, loadHighlights, findTerms, buildSubs, drawSubs, audit };

if (require.main === module) {
  const [root, lang = 'zh'] = process.argv.slice(2);
  if (!root) { console.log('用法：node subtitles.js <项目根目录> zh|en'); process.exit(1); }
  const shots = JSON.parse(fs.readFileSync(path.join(root, 'audio', lang, 'shots.json'), 'utf8'));
  const hl = loadHighlights(root);
  const isCounted = ch => /[\p{L}\p{N}]/u.test(ch);
  const charTime = (shot, i) => { let k = 0; for (let j = 0; j < i; j++) if (isCounted(shot.text[j])) k++; return (shot.chartimes || [])[Math.min(k, (shot.chartimes || []).length - 1)] ?? shot.start; };
  audit(buildSubs(shots, lang, hl, charTime), lang, hl);
}
