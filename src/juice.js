/**
 * 손맛 연출: 판에서 일어난 일 하나를 소리(효과음) + 목소리(고스톱 용어) + 화면 효과로 바꾼다.
 *  - 화면 효과: 도장(큰 글자), 꽃잎·금가루 터짐, 금빛 번쩍, 햇살, 화면 흔들림, 꽃가루 비.
 *  - 소리: audio.js의 샘플(칸 위치에 따라 좌우·크기), 목소리는 나(p)·상대(o) 두 사람.
 * 일반 판, 온라인 방, 튜토리얼이 모두 이 파일 하나로 연출한다.
 */
import { html, React } from './h.js';
import { scoreOf } from './engine.js';
import { play, say, cellPos, unlock } from './audio.js';
import { buzz } from './fx.js';

const { useState, useEffect } = React;

// ---------- 화면 효과 버스 ----------
const subs = new Set();
let uid = 1;
export function fx(e) { e.id = uid++; subs.forEach(function (f) { f(e); }); }
const reduced = function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

function cellCenter(cell) {
  const el = cell != null && cell >= 0 ? document.querySelector('[data-cell="' + cell + '"]') : null;
  if (!el) return { x: innerWidth / 2, y: innerHeight * 0.45 };
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function shakeScreen(power) {
  if (reduced()) return;
  const g = document.querySelector('.game'); if (!g || !g.animate) return;
  const p = power || 6;
  g.animate([{ transform: 'none' }, { transform: 'translate(' + -p + 'px,' + p / 2 + 'px) rotate(-.4deg)' }, { transform: 'translate(' + p + 'px,' + -p / 2 + 'px) rotate(.4deg)' },
    { transform: 'translate(' + -p / 2 + 'px,' + p / 3 + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
}

const PALETTE = {
  gold: ['#ffd34a', '#ffe9a0', '#f2b21c', '#fff7d6'], red: ['#e23b2e', '#ff8a7a', '#c8203a', '#ffd34a'], blue: ['#2f5fd0', '#8fb0ff', '#1b3f9a', '#e8eeff'],
  green: ['#2f8f4a', '#8fd09a', '#d8a63a', '#f6f0d8'], ink: ['#1b1713', '#4e463c', '#ffd34a', '#fbf3df'], pink: ['#f4a0b5', '#ffd1dc', '#e2647f', '#fff'], rainbow: ['#e23b2e', '#ffd34a', '#2f8f4a', '#2f5fd0', '#8a5cc4']
};

function Burst(props) {
  const e = props.e, n = reduced() ? 0 : (e.n || 18), cols = PALETTE[e.color] || PALETTE.gold;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = (e.spread || 70) * (0.55 + Math.random() * 0.7);
    const shape = e.shape === 'petal' ? 'petal' : e.shape === 'feather' ? 'feather' : i % 3 ? 'dot' : 'star';
    parts.push(html`<i key=${i} class=${'pt ' + shape} style=${{ '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d - 20 + 'px', '--r': (Math.random() * 540 - 270) + 'deg', background: cols[i % cols.length], animationDelay: Math.random() * 0.08 + 's' }}></i>`);
  }
  return html`<div class="fx-burst" style=${{ left: e.x + 'px', top: e.y + 'px' }}>${e.ring ? html`<b class="ring" style=${{ borderColor: cols[0] }}></b>` : null}${parts}</div>`;
}
function Stamp(props) {
  const e = props.e;
  return html`<div class=${'fx-stamp ' + (e.tone || 'red') + (e.rays ? ' rays' : '')} style=${{ animationDelay: (e.delay || 0) + 'ms' }}>
    ${e.rays ? html`<span class="sun" aria-hidden="true"></span>` : null}
    <span class="seal"><b>${e.text}</b>${e.sub ? html`<small>${e.sub}</small>` : null}</span>
  </div>`;
}
function Rain(props) {
  if (reduced()) return null;
  const cols = PALETTE[props.e.color || 'rainbow'];
  return html`<div class="fx-rain">${Array.from({ length: 36 }, function (_, i) {
    return html`<i key=${i} style=${{ left: Math.random() * 100 + '%', background: cols[i % cols.length], animationDelay: Math.random() * 1.2 + 's', animationDuration: 1.8 + Math.random() * 1.4 + 's', '--sw': (Math.random() * 80 - 40) + 'px' }}></i>`;
  })}</div>`;
}

/** 앱 맨 위에 한 번 깔아 둔다. */
export function FxLayer() {
  const [items, setItems] = useState([]);
  useEffect(function () {
    const onFx = function (e) {
      if (e.type === 'shake') { shakeScreen(e.power); return; }
      const life = e.life || (e.type === 'stamp' ? 1500 + (e.delay || 0) : e.type === 'rain' ? 3600 : e.type === 'flash' ? 600 : 1000);
      setItems(function (a) { return a.concat([e]).slice(-12); });
      setTimeout(function () { setItems(function (a) { return a.filter(function (x) { return x.id !== e.id; }); }); }, life);
    };
    subs.add(onFx);
    const wake = function () { unlock(); };
    addEventListener('pointerdown', wake, { passive: true }); addEventListener('keydown', wake);
    return function () { subs.delete(onFx); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
  }, []);
  return html`<div class="fx-layer" aria-hidden="true">${items.map(function (e) {
    if (e.type === 'burst') return html`<${Burst} key=${e.id} e=${e} />`;
    if (e.type === 'stamp') return html`<${Stamp} key=${e.id} e=${e} />`;
    if (e.type === 'flash') return html`<div key=${e.id} class=${'fx-flash ' + (e.color || 'gold')}></div>`;
    if (e.type === 'rain') return html`<${Rain} key=${e.id} e=${e} />`;
    return null;
  })}</div>`;
}

// ---------- 판 사건 → 연출 ----------
const YAKU = {
  chong: { voice: 'chongtong', text: '총통', tone: 'rainbow', color: 'rainbow', rank: 9, sfx: 'gwang', rays: true },
  godori: { voice: 'godori', text: '고도리', tone: 'gold', color: 'gold', rank: 7, sfx: 'yaku', shape: 'feather' },
  hong: { voice: 'hongdan', text: '홍단', tone: 'red', color: 'red', rank: 6, sfx: 'yaku', shape: 'petal' },
  cheong: { voice: 'cheongdan', text: '청단', tone: 'blue', color: 'blue', rank: 6, sfx: 'yaku', shape: 'petal' },
  cho: { voice: 'chodan', text: '초단', tone: 'green', color: 'green', rank: 6, sfx: 'yaku', shape: 'petal' },
  omok: { voice: 'omok', text: '오목', tone: 'ink', color: 'ink', rank: 5, sfx: 'omok' },
  tti: { voice: 'tti', text: '띠', tone: 'red', color: 'pink', rank: 2, sfx: 'yaku', small: true },
  yeol: { voice: 'yeol', text: '열끗', tone: 'ink', color: 'green', rank: 2, sfx: 'yaku', small: true },
  pi: { voice: 'pi', text: '피', tone: 'green', color: 'green', rank: 1, sfx: 'yaku', small: true }
};
function gwangInfo(st, p) {
  const s = scoreOf(st, p), n = s.gwang;
  let bi = false; st.cells.forEach(function (c) { if (c && c.owner === p && c.id === 44) bi = true; });
  if (n >= 5) return { voice: 'ogwang', text: '오광', rank: 10, rays: true };
  if (n === 4) return { voice: 'sagwang', text: '사광', rank: 8, rays: true };
  return bi ? { voice: 'bisamgwang', text: '비삼광', rank: 7 } : { voice: 'samgwang', text: '삼광', rank: 8 };
}

/**
 * 한 수(또는 흔들기·고)가 반영된 새 판을 받아 연출한다.
 * ctx: { me: 내 자리(아래쪽), voiceOf(seat) => 'p'|'o', quiet: 목소리 생략 }
 */
export function onMove(st, ctx) {
  const L = st && st.last; if (!L) return;
  const p = L.player, q = 1 - p, vp = ctx.voiceOf(p), vq = ctx.voiceOf(q), mine = p === ctx.me;
  const pos = cellPos(L.cell), at = cellCenter(L.cell);
  const voice = ctx.quiet ? function () { } : say;

  if (L.shake) {
    play('shake'); voice(vp, 'shake');
    fx({ type: 'stamp', text: '흔들기', sub: L.shake + '월 ×2', tone: 'gold' }); fx({ type: 'shake', power: 4 });
    return;
  }
  if (L.go && !L.cell && L.cell !== 0) { /* 고는 아래 onDecide에서 */ }

  // 패 내리치기(칸 위치 따라 좌우·크기)
  play('slap' + (1 + Math.floor(Math.random() * 3)), { pan: pos.pan, gain: pos.gain });
  setTimeout(function () { play('draw', { pan: mine ? 0.3 : -0.3, gain: 0.55 }); }, 320);

  // 무엇을 말할지: 족보 > 뺏기 > 깨짐 > 잠금
  const gained = (L.gained || []).map(function (k) { return k === 'gwang' ? Object.assign({ key: k, tone: 'gold', color: 'gold', sfx: 'gwang' }, gwangInfo(st, p)) : Object.assign({ key: k }, YAKU[k]); })
    .filter(Boolean).sort(function (a, b) { return b.rank - a.rank; });
  const steals = L.steals || [];
  let spoke = false;

  if (steals.length) {
    setTimeout(function () { play(steals.length >= 3 ? 'ssak' : 'steal', { pan: pos.pan }); play('flip', { pan: pos.pan, gain: 0.7, delay: 0.08 }); }, 60);
    steals.forEach(function (c, i) { setTimeout(function () { const cc = cellCenter(c); fx({ type: 'burst', x: cc.x, y: cc.y, color: mine ? 'gold' : 'red', n: 10, spread: 40 }); }, 120 + i * 90); });
    if (!mine) { fx({ type: 'shake', power: steals.length >= 2 ? 7 : 4 }); buzz(steals.length >= 2 ? [60, 40, 60] : 40); }
    if (!gained.length) {
      voice(vp, steals.length >= 3 ? 'ssak' : steals.length === 2 ? 'ttadak' : 'jjak'); spoke = true;
      if (steals.length >= 2) fx({ type: 'stamp', text: steals.length >= 3 ? '싹쓸이' : '따닥', tone: mine ? 'gold' : 'red' });
      if (Math.random() < 0.55) voice(vq, 'ouch', { delay: 250 });
    }
  }
  if (L.locks && L.locks.length && !steals.length) { setTimeout(function () { play('lock', { pan: pos.pan }); }, 90); }

  if (gained.length) {
    const top = gained[0];
    setTimeout(function () { play(top.sfx || 'yaku'); }, 140);
    voice(vp, top.voice); spoke = true;
    gained.forEach(function (g, i) {
      if (g.small && gained.length > 1) return;
      fx({ type: 'stamp', text: g.text, sub: g.key === 'omok' ? '+3점' : null, tone: g.tone, rays: g.rays, delay: i * 650 });
    });
    fx({ type: 'burst', x: at.x, y: at.y, color: top.color, shape: top.shape, n: top.rank >= 6 ? 26 : 14, spread: top.rank >= 6 ? 110 : 70, ring: true });
    if (top.rank >= 7) fx({ type: 'flash', color: top.color === 'rainbow' ? 'gold' : top.color });
    if (top.key === 'omok') {
      (scoreOf(st, p).fiveCells || []).forEach(function (run) { [run[0], run[run.length - 1]].forEach(function (c, i) { setTimeout(function () { const cc = cellCenter(c); fx({ type: 'burst', x: cc.x, y: cc.y, color: 'ink', n: 12, spread: 50 }); }, 200 + i * 160); }); });
    }
    if (steals.length && Math.random() < 0.6) voice(vq, 'ouch', { delay: 200 });
  }
  if (L.lost && L.lost.length) {
    if (!spoke || Math.random() < 0.5) voice(vq, 'broken', { delay: spoke ? 150 : 0 });
    fx({ type: 'stamp', text: '깨짐', tone: 'crack', delay: gained.length ? 700 : 0 });
  }
  if (!spoke && L.locks && L.locks.length && !steals.length && Math.random() < 0.35) voice(vp, 'lock');
}

/** 고/스톱을 고른 직후. */
export function onDecide(st, who, choice, ctx) {
  const v = ctx.voiceOf(who), voice = ctx.quiet ? function () { } : say;
  if (choice === 'go') {
    const n = st.go[who];
    play('go'); voice(v, 'go' + Math.min(5, Math.max(1, n)));
    fx({ type: 'stamp', text: n + '고', sub: n >= 3 ? '×' + Math.pow(2, n - 2) : '+' + n + '점', tone: n >= 3 ? 'rainbow' : 'red', rays: n >= 3 });
    fx({ type: 'flash', color: 'red' }); fx({ type: 'shake', power: 5 + n });
    voice(ctx.voiceOf(1 - who), 'ouch', { delay: 300 });
  } else {
    play('stop'); voice(v, 'stop');
    fx({ type: 'stamp', text: '스톱', tone: 'ink' });
  }
}

/** 판이 끝났을 때: 승패 + 박(피박·광박·고박) 하나씩. */
export function onEnd(st, ctx) {
  const r = st.result; if (!r) return;
  const voice = ctx.quiet ? function () { } : say;
  if (r.winner == null) {
    play('nagari'); voice('o', 'nagari');
    fx({ type: 'stamp', text: '나가리', sub: '다음 판 ×2', tone: 'crack' });
    return;
  }
  const w = r.winner, vw = ctx.voiceOf(w), vl = ctx.voiceOf(1 - w), iWon = w === ctx.me;
  let t = 0;
  (r.lines || []).forEach(function (l) {
    const key = /피박/.test(l.label) ? 'pibak' : /광박/.test(l.label) ? 'gwangbak' : /고박/.test(l.label) ? 'gobak' : null;
    if (!key) return;
    const d = t; t += 900;
    setTimeout(function () { play('bak'); fx({ type: 'stamp', text: key === 'pibak' ? '피박' : key === 'gwangbak' ? '광박' : '고박', sub: '×2', tone: 'red' }); fx({ type: 'shake', power: 6 }); }, d);
    voice(vw, key, { delay: d });
  });
  setTimeout(function () {
    if (iWon || ctx.me == null) { play('win'); fx({ type: 'rain', color: 'rainbow' }); fx({ type: 'stamp', text: '승리', sub: r.final + '점', tone: 'gold', rays: true }); }
    else { play('lose'); fx({ type: 'stamp', text: '패배', sub: r.final + '점', tone: 'ink' }); }
    voice(vw, 'win'); voice(vl, 'lose', { delay: 200 });
  }, t);
}

export function onStart(ctx) { play('deal'); if (!ctx.quiet) say('o', 'start', { delay: 300 }); }
export function onThink() { if (Math.random() < 0.18) say('o', 'think'); }
