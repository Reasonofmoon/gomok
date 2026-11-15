/**
 * 아바타: SVG로 그린 캐릭터 6명 × 표정 10가지.
 * 판에서 일어난 일(짝 뺏기, 족보, 고, 흔들기, 깨짐, 판 끝)에 맞춰 표정과 말풍선이 바뀐다.
 */
import { html, React } from './h.js';
import { scoreOf, GOAL } from './engine.js';

const { useState, useEffect, useRef } = React;
const INK = '#2a1f1a', MOUTH = '#7a2a22';

export const MOOD_KO = { idle: '평온', think: '고민', happy: '신남', smug: '의기양양', shock: '깜짝', sad: '울상', angry: '버럭', nervous: '조마조마', cheer: '환호', wait: '기다림' };
const MOOD = {
  idle: { eyes: 'dot', brows: 'flat', mouth: 'smile', fx: [] },
  think: { eyes: 'up', brows: 'worried', mouth: 'flat', fx: ['dots'] },
  happy: { eyes: 'happy', brows: 'up', mouth: 'grin', fx: ['blush'] },
  smug: { eyes: 'lid', brows: 'smug', mouth: 'smirk', fx: ['blush'] },
  shock: { eyes: 'wide', brows: 'up', mouth: 'o', fx: ['lines'] },
  sad: { eyes: 'closed', brows: 'worried', mouth: 'frown', fx: ['tear'] },
  angry: { eyes: 'dot', brows: 'angry', mouth: 'wobble', fx: ['vein', 'red'] },
  nervous: { eyes: 'dot', brows: 'worried', mouth: 'wobble', fx: ['sweat'] },
  cheer: { eyes: 'happy', brows: 'up', mouth: 'open', fx: ['blush', 'sparkle'] },
  wait: { eyes: 'closed', brows: 'flat', mouth: 'flat', fx: ['zz'] }
};

// ---------- 얼굴 부품 ----------
function eye(type, cx, cy, skin) {
  if (type === 'happy') return html`<path d=${'M' + (cx - 4.6) + ' ' + (cy + 1.2) + ' Q' + cx + ' ' + (cy - 4.8) + ' ' + (cx + 4.6) + ' ' + (cy + 1.2)} stroke=${INK} stroke-width="2.6" fill="none" stroke-linecap="round" />`;
  if (type === 'closed') return html`<path d=${'M' + (cx - 4.6) + ' ' + (cy - 1) + ' Q' + cx + ' ' + (cy + 3.8) + ' ' + (cx + 4.6) + ' ' + (cy - 1)} stroke=${INK} stroke-width="2.4" fill="none" stroke-linecap="round" />`;
  if (type === 'wide') return html`<g><circle cx=${cx} cy=${cy} r="5.4" fill="#fff" stroke=${INK} stroke-width="1.3" /><circle cx=${cx} cy=${cy} r="2" fill=${INK} /></g>`;
  if (type === 'lid') return html`<g><path d=${'M' + (cx - 3.6) + ' ' + (cy - 0.4) + ' A3.6 3.6 0 0 0 ' + (cx + 3.6) + ' ' + (cy - 0.4) + ' Z'} fill=${INK} /><path d=${'M' + (cx - 4.8) + ' ' + (cy - 0.2) + ' L' + (cx + 4.8) + ' ' + (cy - 1.4)} stroke=${INK} stroke-width="1.8" stroke-linecap="round" /></g>`;
  const dx = type === 'up' ? 1.2 : 0, dy = type === 'up' ? -1.6 : 0;
  return html`<g><ellipse cx=${cx + dx} cy=${cy + dy} rx="3.2" ry="4" fill=${INK} /><circle cx=${cx + dx + 1.1} cy=${cy + dy - 1.4} r="1.2" fill="#fff" /></g>`;
}
function brow(type, cx, by, side, col, w) {
  // side: -1 왼눈(안쪽 끝이 오른쪽), 1 오른눈
  const inner = cx - side * 4.4, outer = cx + side * 4.4;
  let yi = by, yo = by;
  if (type === 'up') { yi = by - 2.4; yo = by - 2.4; }
  if (type === 'worried') { yi = by - 2.8; yo = by + 0.8; }
  if (type === 'angry') { yi = by + 2.4; yo = by - 2.2; }
  if (type === 'smug') { if (side === 1) { yi = by - 3; yo = by - 2; } }
  return html`<path d=${'M' + outer + ' ' + yo + ' Q' + cx + ' ' + (Math.min(yi, yo) - 1.2) + ' ' + inner + ' ' + yi} stroke=${col || INK} stroke-width=${w || 2.2} fill="none" stroke-linecap="round" />`;
}
function mouth(type, my) {
  switch (type) {
    case 'grin': return html`<path d=${'M43 ' + (my - 1) + ' Q50 ' + (my + 9) + ' 57 ' + (my - 1) + ' Z'} fill=${MOUTH} stroke=${INK} stroke-width="1.2" stroke-linejoin="round" />`;
    case 'open': return html`<g><path d=${'M40.5 ' + (my - 2) + ' Q50 ' + (my + 13) + ' 59.5 ' + (my - 2) + ' Z'} fill=${MOUTH} stroke=${INK} stroke-width="1.2" stroke-linejoin="round" /><ellipse cx="50" cy=${my + 5.4} rx="4.4" ry="2.4" fill="#f08a8a" /></g>`;
    case 'o': return html`<ellipse cx="50" cy=${my + 1.6} rx="3.2" ry="4" fill=${MOUTH} stroke=${INK} stroke-width="1.1" />`;
    case 'frown': return html`<path d=${'M44 ' + (my + 3) + ' Q50 ' + (my - 2.4) + ' 56 ' + (my + 3)} stroke=${INK} stroke-width="2.2" fill="none" stroke-linecap="round" />`;
    case 'flat': return html`<path d=${'M45 ' + (my + 1) + ' L55 ' + (my + 1)} stroke=${INK} stroke-width="2.2" stroke-linecap="round" />`;
    case 'smirk': return html`<path d=${'M44 ' + (my + 1.4) + ' Q52 ' + (my + 3.6) + ' 57 ' + (my - 2)} stroke=${INK} stroke-width="2.2" fill="none" stroke-linecap="round" />`;
    case 'wobble': return html`<path d=${'M42.5 ' + (my + 1) + ' l2.5 -1.8 l2.5 1.8 l2.5 -1.8 l2.5 1.8 l2.5 -1.8 l2.5 1.8'} stroke=${INK} stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    default: return html`<path d=${'M44 ' + my + ' Q50 ' + (my + 5.4) + ' 56 ' + my} stroke=${INK} stroke-width="2.2" fill="none" stroke-linecap="round" />`;
  }
}
function beak(type, my) {
  const open = type === 'open' || type === 'o' || type === 'grin';
  const tilt = type === 'smirk' ? ' rotate(-8 50 ' + my + ')' : type === 'frown' ? ' rotate(6 50 ' + my + ')' : '';
  return html`<g transform=${'translate(0 0)' + tilt}>
    <path d=${'M44 ' + (my - 4) + ' L50 ' + (my - 6) + ' L56 ' + (my - 4) + ' L50 ' + (my + (open ? 1 : 5)) + ' Z'} fill="#e8b64e" stroke=${INK} stroke-width="1" stroke-linejoin="round" />
    ${open ? html`<path d=${'M45 ' + (my + 2) + ' L50 ' + (my + (type === 'open' ? 11 : 8)) + ' L55 ' + (my + 2) + ' Z'} fill="#d99a32" stroke=${INK} stroke-width="1" stroke-linejoin="round" />` : null}
  </g>`;
}
function fxLayer(list, ex, ey) {
  return list.map(function (k) {
    if (k === 'blush') return html`<g key=${k} fill="#ff7f86" opacity=".5"><ellipse cx=${50 - ex - 3} cy=${ey + 8} rx="5" ry="2.8" /><ellipse cx=${50 + ex + 3} cy=${ey + 8} rx="5" ry="2.8" /></g>`;
    if (k === 'sweat') return html`<path key=${k} d="M80 34 Q75 44 80 47 Q85 44 80 34 Z" fill="#9ad7ff" stroke="#3b8fd0" stroke-width="1" />`;
    if (k === 'tear') return html`<g key=${k} fill="#8fd0ff" stroke="#3b8fd0" stroke-width=".7"><path d=${'M' + (50 - ex) + ' ' + (ey + 3) + ' q-3 7 0 10 q3 -3 0 -10 Z'} /><path d=${'M' + (50 + ex) + ' ' + (ey + 3) + ' q-3 7 0 10 q3 -3 0 -10 Z'} /></g>`;
    if (k === 'vein') return html`<path key=${k} d="M70 22 q4 4 0 8 M80 22 q-4 4 0 8 M71 21 q4 -4 8 0 M71 31 q4 4 8 0" stroke="#e0302a" stroke-width="2" fill="none" stroke-linecap="round" />`;
    if (k === 'red') return html`<ellipse key=${k} cx="50" cy=${ey - 6} rx="22" ry="9" fill="#e0302a" opacity=".16" />`;
    if (k === 'dots') return html`<g key=${k} fill="#fff" stroke=${INK} stroke-width="1"><circle cx="76" cy="26" r="2.4" /><circle cx="83" cy="18" r="3.2" /><circle cx="91" cy="9" r="4.2" /></g>`;
    if (k === 'lines') return html`<path key=${k} d="M24 16 L28 23 M50 8 L50 16 M76 16 L72 23" stroke=${INK} stroke-width="2.2" stroke-linecap="round" />`;
    if (k === 'sparkle') return html`<g key=${k} fill="#ffd34a" stroke="#c98a12" stroke-width=".6"><path d="M16 22 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" /><path d="M84 30 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z" /></g>`;
    if (k === 'zz') return html`<text key=${k} x="74" y="26" font-size="12" font-weight="900" fill=${INK}>z<tspan font-size="9" dy="-6">z</tspan></text>`;
    return null;
  });
}

// ---------- 캐릭터 ----------
const human = function (skin) {
  return html`<g><circle cx="23" cy="60" r="5" fill=${skin} stroke=${INK} stroke-width="1.2" /><circle cx="77" cy="60" r="5" fill=${skin} stroke=${INK} stroke-width="1.2" />
    <ellipse cx="50" cy="57" rx="27" ry="26" fill=${skin} stroke=${INK} stroke-width="1.4" /></g>`;
};
const hanbok = function (col, collar) {
  return html`<g><path d="M14 102 Q18 84 50 82 Q82 84 86 102 Z" fill=${col} stroke=${INK} stroke-width="1.3" />
    <path d="M38 83 L50 98 L62 83" stroke=${collar || '#fffaf0'} stroke-width="4.5" fill="none" stroke-linejoin="round" /></g>`;
};

export const CHARS = {
  moon: {
    name: '달이', bg: '#f6dc8a', skin: '#ffe2c6', ey: 58, ex: 11, my: 70,
    back: function () { return html`<path d="M20 62 Q16 24 50 22 Q84 24 80 62 L82 80 Q72 76 70 60 L30 60 Q28 76 18 80 Z" fill="#2a211d" />`; },
    body: function () { return html`<g>${hanbok('#ee6a8a')}<path d="M54 90 Q62 92 60 100 M54 90 Q48 96 52 102" stroke="#c8203a" stroke-width="3" fill="none" stroke-linecap="round" /></g>`; },
    front: function () {
      return html`<g><path d="M23 54 Q25 29 50 28 Q75 29 77 54 Q68 42 60 45 Q56 38 50 45 Q44 38 39 45 Q31 42 23 54 Z" fill="#2a211d" />
        <path d="M66 26 A9 9 0 1 0 76 38 A7 7 0 1 1 66 26 Z" fill="#ffd34a" stroke="#c98a12" stroke-width="1" /></g>`;
    }
  },
  grandpa: {
    name: '훈장님', bg: '#cfe3d2', skin: '#f6d3ae', ey: 59, ex: 11, my: 71, browCol: '#efece4', browW: 3.6,
    body: function () { return hanbok('#ece6d8', '#3a2f28'); },
    front: function () {
      return html`<g><path d="M36 74 Q50 102 64 74 Q58 82 50 82 Q42 82 36 74 Z" fill="#f6f3ec" stroke="#c9c2b5" stroke-width="1" />
        <path d="M40 67 Q45 64 50 67 Q55 64 60 67" stroke="#f6f3ec" stroke-width="3.4" fill="none" stroke-linecap="round" />
        <ellipse cx="50" cy="34" rx="42" ry="7.5" fill="rgba(22,18,16,.82)" />
        <path d="M35 34 L37.5 12 Q50 8 62.5 12 L65 34 Z" fill="rgba(22,18,16,.92)" />
        <path d="M36 30 L64 30" stroke="#5a4a40" stroke-width="2" />
        <path d="M26 38 Q24 70 34 92 M74 38 Q76 70 66 92" stroke="#3a2f28" stroke-width="1" fill="none" stroke-dasharray="1.4 1.6" /></g>`;
    }
  },
  granny: {
    name: '할매', bg: '#f4d3d3', skin: '#f7d6b8', ey: 59, ex: 11, my: 71,
    back: function () { return html`<g><circle cx="50" cy="26" r="11" fill="#8f8983" stroke=${INK} stroke-width="1.2" /><path d="M30 24 L72 28" stroke="#d9a82a" stroke-width="3" stroke-linecap="round" /><circle cx="72" cy="28" r="2.6" fill="#e04a5a" /></g>`; },
    body: function () { return html`<g>${hanbok('#8a6ac0')}<path d="M54 90 Q62 92 60 100" stroke="#e0a030" stroke-width="3" fill="none" stroke-linecap="round" /></g>`; },
    front: function () { return html`<path d="M23 54 Q22 30 50 30 Q78 30 77 54 Q72 38 50 38 Q28 38 23 54 Z" fill="#a39d96" stroke=${INK} stroke-width="1" />`; }
  },
  crane: {
    name: '학', bg: '#d6e8f3', skin: '#fffdf8', ey: 56, ex: 11, my: 70, beak: true,
    body: function () { return html`<path d="M16 102 Q22 82 50 80 Q78 82 84 102 Z" fill="#1f1b18" stroke=${INK} stroke-width="1.2" />`; },
    head: function () { return html`<g><circle cx="50" cy="55" r="28" fill="#fffdf8" stroke=${INK} stroke-width="1.4" /><ellipse cx="50" cy="30" rx="10" ry="6.4" fill="#d8262a" /></g>`; }
  },
  tiger: {
    name: '범', bg: '#fde3b5', skin: '#f29b38', ey: 55, ex: 12, my: 74,
    back: function () { return html`<g><circle cx="27" cy="34" r="10" fill="#f29b38" stroke=${INK} stroke-width="1.3" /><circle cx="27" cy="34" r="5" fill="#f7c1a6" /><circle cx="73" cy="34" r="10" fill="#f29b38" stroke=${INK} stroke-width="1.3" /><circle cx="73" cy="34" r="5" fill="#f7c1a6" /></g>`; },
    body: function () { return html`<path d="M16 102 Q20 84 50 82 Q80 84 84 102 Z" fill="#f29b38" stroke=${INK} stroke-width="1.3" />`; },
    head: function () {
      return html`<g><ellipse cx="50" cy="58" rx="30" ry="27" fill="#f29b38" stroke=${INK} stroke-width="1.4" />
        <path d="M44 33 L46 42 M50 32 L50 43 M56 33 L54 42 M21 56 L30 58 M22 64 L30 63 M79 56 L70 58 M78 64 L70 63" stroke=${INK} stroke-width="2.4" stroke-linecap="round" />
        <ellipse cx="50" cy="73" rx="14" ry="10" fill="#fff8ec" /><path d="M46 65 L54 65 L50 69 Z" fill="#5a2a22" /></g>`;
    }
  },
  dragon: {
    name: '용', bg: '#e6d6f3', skin: '#57b394', ey: 54, ex: 12, my: 76,
    back: function () { return html`<g><path d="M30 38 Q22 22 28 10 Q32 22 38 32 Z M70 38 Q78 22 72 10 Q68 22 62 32 Z" fill="#f0c040" stroke=${INK} stroke-width="1.2" /><path d="M34 30 L40 20 L46 28 L50 18 L54 28 L60 20 L66 30 Z" fill="#e05a4a" stroke=${INK} stroke-width="1" /></g>`; },
    body: function () { return html`<path d="M16 102 Q20 84 50 82 Q80 84 84 102 Z" fill="#57b394" stroke=${INK} stroke-width="1.3" />`; },
    head: function () {
      return html`<g><ellipse cx="50" cy="57" rx="28" ry="26" fill="#57b394" stroke=${INK} stroke-width="1.4" />
        <ellipse cx="50" cy="73" rx="17" ry="11" fill="#86d0b6" stroke=${INK} stroke-width="1" />
        <circle cx="45" cy="68" r="1.5" fill=${INK} /><circle cx="55" cy="68" r="1.5" fill=${INK} />
        <path d="M34 72 Q20 70 14 80 M66 72 Q80 70 86 80" stroke="#f08a3a" stroke-width="2" fill="none" stroke-linecap="round" /></g>`;
    }
  }
};

/** 상점 아바타 글자 → 캐릭터 */
export const CHAR_OF = { '月': 'moon', '鶴': 'crane', '虎': 'tiger', '龍': 'dragon', '翁': 'grandpa', '婆': 'granny' };
export function charOf(glyph) { return CHAR_OF[glyph] || 'moon'; }
export function rivalOf(mine) { return mine === 'grandpa' ? 'granny' : 'grandpa'; }

export function Avatar(props) {
  const ch = CHARS[props.char] || CHARS.moon;
  const mood = MOOD[props.mood] ? props.mood : 'idle', f = MOOD[mood];
  const ex = ch.ex, ey = ch.ey;
  return html`<div class=${'av s' + (props.seat || 0) + (props.size ? ' ' + props.size : '') + (props.active ? ' on' : '')} role="img" aria-label=${ch.name + ' · ' + MOOD_KO[mood]} title=${ch.name}
      onClick=${props.onClick}>
    <svg viewBox="0 0 100 100" key=${mood} class=${'mood-' + mood}>
      <rect width="100" height="100" fill=${ch.bg} />
      ${ch.back ? ch.back() : null}
      ${ch.body()}
      ${ch.head ? ch.head() : human(ch.skin)}
      ${f.fx.indexOf('red') >= 0 ? fxLayer(['red'], ex, ey) : null}
      ${ch.front ? ch.front() : null}
      ${brow(f.brows, 50 - ex, ey - 9, -1, ch.browCol, ch.browW)}${brow(f.brows, 50 + ex, ey - 9, 1, ch.browCol, ch.browW)}
      ${eye(f.eyes, 50 - ex, ey, ch.skin)}${eye(f.eyes, 50 + ex, ey, ch.skin)}
      ${ch.beak ? beak(f.mouth, ch.my) : mouth(f.mouth, ch.my)}
      ${fxLayer(f.fx.filter(function (k) { return k !== 'red'; }), ex, ey)}
    </svg>
  </div>`;
}

// ---------- 판 → 표정 ----------
const YAKU = { gwang: '광!', godori: '고도리!', hong: '홍단!', cheong: '청단!', cho: '초단!', omok: '오목!', chong: '총통!', tti: '띠!', yeol: '열끗!', pi: '피!' };
const OUCH = ['아이고!', '내 패!', '어머나', '이런!'];

function baseline(st, p, thinker) {
  if (!st) return 'idle';
  if (st.status === 'ended') { const w = st.result.winner; return w == null ? 'shock' : w === p ? 'cheer' : 'sad'; }
  if (st.pending) return st.pending.player === p ? 'think' : 'nervous';
  if (st.turn === p && thinker === p) return 'think';
  const mine = scoreOf(st, p).total, theirs = scoreOf(st, 1 - p).total;
  if (theirs >= GOAL - 2 && theirs > mine) return 'nervous';
  if (mine >= GOAL - 3 && mine > theirs) return 'smug';
  return 'idle';
}

function fromEvent(st) {
  const L = st.last; if (!L) return null;
  const p = L.player, q = 1 - p, m = [null, null], s = [null, null];
  if (st.status === 'ended' && st.result) {
    const w = st.result.winner;
    if (w == null) { m[0] = m[1] = 'shock'; s[0] = '나가리!'; s[1] = '에잇'; }
    else { m[w] = 'cheer'; m[1 - w] = 'sad'; s[w] = '이겼다!'; s[1 - w] = '아이고…'; }
    return { m: m, s: s };
  }
  if (L.shake) { m[p] = 'smug'; m[q] = 'shock'; s[p] = '흔들어!'; s[q] = '헉'; }
  else if (L.go) { m[p] = 'cheer'; m[q] = 'nervous'; s[p] = L.go + '고!'; s[q] = '어쩌지…'; }
  else if (L.gained && L.gained.length) { m[p] = 'happy'; m[q] = L.steals.length ? 'shock' : 'nervous'; s[p] = L.gained.map(function (k) { return YAKU[k]; }).slice(0, 2).join(' '); s[q] = '안 돼!'; }
  else if (L.steals && L.steals.length) { m[p] = 'smug'; m[q] = 'shock'; s[p] = L.steals.length >= 3 ? '싹쓸이!' : L.steals.length === 2 ? '따닥!' : '짝!'; s[q] = OUCH[(L.cell + st.plays) % OUCH.length]; }
  else if (L.lost && L.lost.length) { m[p] = 'smug'; m[q] = 'angry'; s[q] = '깨졌잖아!'; }
  else if (L.locks && L.locks.length) { m[p] = 'happy'; s[p] = '잠갔다'; }
  else return null;
  return { m: m, s: s };
}

/**
 * useMoods(st, thinker): [표정0, 표정1], [말0, 말1] (자리 번호 기준).
 * thinker = 차례일 때 "고민" 얼굴을 할 자리(컴퓨터). 사건 표정은 2초 뒤 평소 표정으로 돌아간다.
 */
export function useMoods(st, thinker) {
  const [ev, setEv] = useState(null);
  const keyRef = useRef(''), timer = useRef(null);
  useEffect(function () {
    if (!st || !st.last) return;
    const L = st.last, k = st.plays + ':' + (L.go || 0) + ':' + (L.shake || 0) + ':' + st.status;
    if (k === keyRef.current) return;
    const first = keyRef.current === '';
    keyRef.current = k;
    if (first && st.status !== 'ended' && st.plays > 1) return;   // 들어오자마자 지난 수에 반응하지 않기
    const e = fromEvent(st); if (!e) return;
    clearTimeout(timer.current);
    setEv(Object.assign({ key: k }, e));
    timer.current = setTimeout(function () { setEv(null); }, st.status === 'ended' ? 3200 : 2100);
  }, [st]);
  useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
  const moods = [0, 1].map(function (p) { return (ev && ev.m[p]) || baseline(st, p, thinker); });
  const says = [0, 1].map(function (p) { return ev && ev.s[p] ? { text: ev.s[p], key: ev.key + p } : null; });
  return { moods: moods, says: says };
}
