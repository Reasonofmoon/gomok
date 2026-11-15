/**
 * 고목(GO·MOK) 규칙 엔진: 7x7 판 위에서 치는 고스톱 + 오목.
 * 순수 함수만 둔다(DOM 없음). 화면, AI, Node 시험, 나중의 서버가 같은 파일을 쓴다.
 *
 * 한 수의 흐름
 *  1) 손패 한 장을 빈 칸에 낸다. 첫 수는 가운데, 그 뒤로는 이미 놓인 패의 이웃(8방) 칸만.
 *  2) 짝 뺏기: 이웃에 같은 달 상대 패가 있으면 내 것으로 뒤집는다(잠긴 패는 못 뺏는다).
 *  3) 짝 잠금: 새 패와 이웃의 같은 달 내 패(방금 뺏은 패 포함)는 함께 잠긴다. 잠긴 패는 다시 뺏기지 않는다.
 *  4) 판 위 "내 패"로 족보 점수를 다시 센다. 7점 이상이고 지난 고 때보다 늘었으면 고/스톱을 고른다.
 *  5) 더미에서 한 장 뽑고 차례를 넘긴다. 패가 모두 떨어지면 점수가 높은 쪽(7점 이상)이 이기고, 아니면 나가리.
 */
import { CARD } from './hwatu.js';

export const SIZE = 7;
export const CELLS = SIZE * SIZE;
export const CENTER = 24;
export const HAND = 5;
export const GOAL = 7;

export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

export function newGame(opts) {
  const o = opts || {};
  const seed = o.seed == null ? (Date.now() & 0x7fffffff) : o.seed;
  const deck = shuffle(CARD.map(function (c) { return c.id; }), rng(seed));
  return {
    cells: new Array(CELLS).fill(null),
    deck: deck.slice(HAND * 2),
    hands: [deck.slice(0, HAND), deck.slice(HAND, HAND * 2)],
    turn: o.first || 0, plays: 0, status: 'playing',
    go: [0, 0], goScore: [0, 0], shaken: [[], []], pending: null, result: null, last: null, seed: seed
  };
}

function clone(st) {
  return {
    cells: st.cells.map(function (c) { return c ? { id: c.id, owner: c.owner, locked: c.locked } : null; }),
    deck: st.deck.slice(), hands: [st.hands[0].slice(), st.hands[1].slice()],
    turn: st.turn, plays: st.plays, status: st.status, go: st.go.slice(), goScore: st.goScore.slice(), shaken: [st.shaken[0].slice(), st.shaken[1].slice()],
    pending: st.pending, result: st.result, last: st.last, seed: st.seed
  };
}

const DIR8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const NB = [];
for (let i = 0; i < CELLS; i++) {
  const x = i % SIZE, y = (i / SIZE) | 0, out = [];
  for (const d of DIR8) { const nx = x + d[0], ny = y + d[1]; if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(ny * SIZE + nx); }
  NB.push(out);
}
export function neighbors(i) { return NB[i]; }

export function legalCells(st) {
  if (st.status !== 'playing' || st.pending) return [];
  if (st.plays === 0) return [CENTER];
  const out = [];
  for (let i = 0; i < CELLS; i++) {
    if (st.cells[i]) continue;
    if (NB[i].some(function (n) { return !!st.cells[n]; })) out.push(i);
  }
  return out;
}

/** 이 칸에 이 패를 내면 뺏을 수 있는 칸들(미리보기용). */
export function previewSteal(st, player, cardId, cell) {
  const m = CARD[cardId].m, out = [];
  for (const n of NB[cell]) { const c = st.cells[n]; if (c && c.owner !== player && !c.locked && CARD[c.id].m === m) out.push(n); }
  return out;
}

// ---------- 족보 ----------

function runsOf(cells, p) {
  // 가로·세로·두 대각선에서 p 패가 이어진 줄들. 5칸 이상인 줄 수와 가장 긴 줄.
  let longest = 0, fives = 0;
  const lines = [];
  for (let y = 0; y < SIZE; y++) lines.push(Array.from({ length: SIZE }, function (_, x) { return y * SIZE + x; }));
  for (let x = 0; x < SIZE; x++) lines.push(Array.from({ length: SIZE }, function (_, y) { return y * SIZE + x; }));
  for (let k = -(SIZE - 1); k <= SIZE - 1; k++) {
    const a = [], b = [];
    for (let x = 0; x < SIZE; x++) {
      const y1 = x + k; if (y1 >= 0 && y1 < SIZE) a.push(y1 * SIZE + x);
      const y2 = SIZE - 1 - x + k; if (y2 >= 0 && y2 < SIZE) b.push(y2 * SIZE + x);
    }
    if (a.length >= 5) lines.push(a);
    if (b.length >= 5) lines.push(b);
  }
  const fiveCells = [];
  for (const line of lines) {
    let run = [];
    for (const i of line.concat([-1])) {
      const c = i >= 0 ? cells[i] : null;
      if (c && c.owner === p) run.push(i);
      else {
        if (run.length > longest) longest = run.length;
        if (run.length >= 5) { fives++; fiveCells.push(run.slice()); }
        run = [];
      }
    }
  }
  return { longest: longest, fives: fives, fiveCells: fiveCells };
}

/**
 * p가 판 위에 가진 패의 점수. items는 화면에서 진행도(have/need)를 보여 줄 때도 쓴다.
 * opp를 넘기면 상대가 이미 잠가 버려 막힌 족보를 blocked로 표시한다.
 */
export function scoreOf(st, p) {
  const mine = [], oppLocked = [];
  st.cells.forEach(function (c) {
    if (!c) return;
    if (c.owner === p) mine.push(CARD[c.id]);
    else if (c.locked) oppLocked.push(CARD[c.id]);
  });
  const has = function (f) { return mine.filter(f).length; };
  const blockedBy = function (f) { return oppLocked.some(f); };
  const gw = mine.filter(function (c) { return c.type === 'gwang'; });
  const gwN = gw.length, bi = gw.some(function (c) { return c.bi; });
  const gwPts = gwN >= 5 ? 15 : gwN === 4 ? 4 : gwN === 3 ? (bi ? 2 : 3) : 0;
  const birds = has(function (c) { return c.bird; });
  const red = has(function (c) { return c.tti === 'red'; });
  const blue = has(function (c) { return c.tti === 'blue'; });
  const cho = has(function (c) { return c.tti === 'cho'; });
  const tti = has(function (c) { return c.type === 'tti'; });
  const yeol = has(function (c) { return c.type === 'yeol'; });
  const piV = mine.reduce(function (s, c) { return s + (c.type === 'pi' ? c.pi : 0); }, 0);
  const runs = runsOf(st.cells, p);
  const byMonth = {};
  mine.forEach(function (c) { byMonth[c.m] = (byMonth[c.m] || 0) + 1; });
  const fullMonths = Object.keys(byMonth).filter(function (k) { return byMonth[k] === 4; }).length;
  const maxMonth = Math.max(0, ...Object.values(byMonth));

  const items = [
    { key: 'gwang', label: '광', have: gwN, need: 3, pts: gwPts },
    { key: 'godori', label: '고도리', have: birds, need: 3, pts: birds === 3 ? 5 : 0, blocked: blockedBy(function (c) { return c.bird; }) },
    { key: 'hong', label: '홍단', have: red, need: 3, pts: red === 3 ? 3 : 0, blocked: blockedBy(function (c) { return c.tti === 'red'; }) },
    { key: 'cheong', label: '청단', have: blue, need: 3, pts: blue === 3 ? 3 : 0, blocked: blockedBy(function (c) { return c.tti === 'blue'; }) },
    { key: 'cho', label: '초단', have: cho, need: 3, pts: cho === 3 ? 3 : 0, blocked: blockedBy(function (c) { return c.tti === 'cho'; }) },
    { key: 'omok', label: '오목', have: runs.longest, need: 5, pts: runs.fives * 3, count: runs.fives },
    { key: 'chong', label: '총통', have: maxMonth, need: 4, pts: fullMonths * 2, count: fullMonths },
    { key: 'tti', label: '띠', have: tti, need: 5, pts: Math.max(0, tti - 4) },
    { key: 'yeol', label: '열끗', have: yeol, need: 5, pts: Math.max(0, yeol - 4) },
    { key: 'pi', label: '피', have: piV, need: 10, pts: Math.max(0, piV - 9) }
  ];
  const total = items.reduce(function (s, it) { return s + it.pts; }, 0);
  return { total: total, items: items, gwang: gwN, piValue: piV, fiveCells: runs.fiveCells, owned: mine.length };
}

// ---------- 진행 ----------

function err(reason) { return { ok: false, reason: reason }; }

export function playCard(st, player, cardId, cell) {
  if (st.status !== 'playing') return err('game_over');
  if (st.pending) return err('pending');
  if (player !== st.turn) return err('not_your_turn');
  const hi = st.hands[player].indexOf(cardId);
  if (hi < 0) return err('not_in_hand');
  if (legalCells(st).indexOf(cell) < 0) return err(st.plays === 0 ? 'first_center' : st.cells[cell] ? 'occupied' : 'not_adjacent');

  const before = [scoreOf(st, 0), scoreOf(st, 1)];
  const s = clone(st);
  s.hands[player].splice(hi, 1);
  s.cells[cell] = { id: cardId, owner: player, locked: false };
  const m = CARD[cardId].m, steals = [], locks = [];
  for (const n of NB[cell]) {
    const c = s.cells[n];
    if (!c || CARD[c.id].m !== m) continue;
    if (c.owner !== player && !c.locked) { c.owner = player; steals.push(n); }
    if (c.owner === player) { if (!c.locked) locks.push(n); c.locked = true; }
  }
  if (locks.length || steals.length) s.cells[cell].locked = true;
  s.plays++;

  const after = [scoreOf(s, 0), scoreOf(s, 1)];
  const gained = after[player].items.filter(function (it, k) { return it.pts > before[player].items[k].pts; }).map(function (it) { return it.key; });
  const lost = after[1 - player].items.filter(function (it, k) { return it.pts < before[1 - player].items[k].pts; }).map(function (it) { return it.key; });
  s.last = { player: player, cell: cell, cardId: cardId, steals: steals, locks: locks, gained: gained, lost: lost, scores: [after[0].total, after[1].total] };

  const sc = after[player].total;
  if (sc >= GOAL && sc > s.goScore[player]) {
    s.pending = { player: player, score: sc };
    return { ok: true, state: s };
  }
  return { ok: true, state: advance(s) };
}

function advance(s) {
  const p = s.turn;
  if (s.deck.length) s.hands[p].push(s.deck.shift());
  const q = 1 - p;
  if (s.hands[q].length) s.turn = q;
  else if (s.hands[p].length) s.turn = p;
  else return endOfDeck(s);
  if (!legalCells(s).length) return endOfDeck(s);
  return s;
}

/** 고 또는 스톱. */
export function decide(st, player, choice) {
  if (!st.pending || st.pending.player !== player) return err('no_pending');
  const s = clone(st);
  if (choice === 'stop') return { ok: true, state: settle(s, player, 'stop') };
  s.go[player]++;
  s.goScore[player] = s.pending.score;
  s.pending = null;
  s.last = Object.assign({}, s.last, { go: s.go[player] });
  return { ok: true, state: advance(s) };
}

function endOfDeck(s) {
  const a = scoreOf(s, 0).total, b = scoreOf(s, 1).total;
  if (Math.max(a, b) >= GOAL && a !== b) return settle(s, a > b ? 0 : 1, 'deck');
  s.status = 'ended'; s.pending = null;
  s.result = { winner: null, reason: 'nagari', final: 0, scores: [a, b] };
  return s;
}

function settle(s, w, reason) {
  const L = 1 - w, sw = scoreOf(s, w), sl = scoreOf(s, L);
  const g = s.go[w];
  const lines = [{ label: '족보 점수', value: '+' + sw.total }];
  let pts = sw.total;
  if (g > 0) { pts += Math.min(g, 2); lines.push({ label: g + '고', value: '+' + Math.min(g, 2) }); }
  let mult = 1;
  if (g >= 3) { mult *= Math.pow(2, g - 2); lines.push({ label: g + '고 배수', value: '×' + Math.pow(2, g - 2) }); }
  if (s.shaken[w].length) { const k = Math.pow(2, s.shaken[w].length); mult *= k; lines.push({ label: '흔들기 ' + s.shaken[w].length + '번', value: '×' + k }); }
  if (sw.piValue >= 10 && sl.piValue < 6) { mult *= 2; lines.push({ label: '피박', value: '×2' }); }
  if (sw.gwang >= 3 && sl.gwang === 0) { mult *= 2; lines.push({ label: '광박', value: '×2' }); }
  if (reason === 'stop' && s.go[L] > 0) { mult *= 2; lines.push({ label: '고박(상대가 고를 외쳤다 막힘)', value: '×2' }); }
  s.status = 'ended'; s.pending = null;
  s.result = { winner: w, reason: reason, base: sw.total, final: pts * mult, lines: lines, items: sw.items.filter(function (i) { return i.pts > 0; }), scores: [scoreOf(s, 0).total, scoreOf(s, 1).total] };
  return s;
}

// ---------- 흔들기 ----------
/** 손에 같은 달 3장 이상이면 흔들 수 있다(내 차례, 그 달은 한 번만). 이기면 흔든 횟수만큼 두 배. */
export function shakeable(st, player) {
  if (st.status !== 'playing' || st.pending || st.turn !== player) return [];
  const cnt = {};
  st.hands[player].forEach(function (id) { const m = CARD[id].m; cnt[m] = (cnt[m] || 0) + 1; });
  return Object.keys(cnt).map(Number).filter(function (m) { return cnt[m] >= 3 && st.shaken[player].indexOf(m) < 0; });
}
export function shake(st, player, month) {
  if (shakeable(st, player).indexOf(month) < 0) return err('cannot_shake');
  const s = clone(st);
  s.shaken[player].push(month);
  s.last = { player: player, shake: month, steals: [], locks: [], gained: [], lost: [], cell: -1 };
  return { ok: true, state: s };
}

export const REASON_TEXT = {
  first_center: '첫 패는 가운데에 내요',
  occupied: '이미 패가 있는 칸이에요',
  not_adjacent: '놓인 패 옆 칸에만 낼 수 있어요',
  not_your_turn: '상대 차례예요',
  pending: '먼저 고/스톱을 골라요',
  game_over: '이미 끝난 판이에요',
  not_in_hand: '손에 없는 패예요'
};
