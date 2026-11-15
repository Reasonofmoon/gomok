/**
 * 컴퓨터 상대. 손패 x 둘 수 있는 칸을 모두 한 수씩 둬 보고, 판 평가가 가장 좋은 수를 고른다.
 * 상대 손패는 모르는 것으로 친다(보이지 않는 패 수로 위험도를 어림한다).
 */
import { CARD } from './hwatu.js';
import { legalCells, playCard, scoreOf, neighbors, GOAL } from './engine.js';

function unseenByMonth(st, me) {
  const seen = {};
  st.cells.forEach(function (c) { if (c) seen[c.id] = 1; });
  st.hands[me].forEach(function (id) { seen[id] = 1; });
  const cnt = {};
  CARD.forEach(function (c) { if (!seen[c.id]) cnt[c.m] = (cnt[c.m] || 0) + 1; });
  return cnt;
}

/** p 입장의 판 가치(점수 + 족보 진행도 + 안전도). */
export function evaluate(st, p, unseen) {
  const sc = scoreOf(st, p);
  let v = sc.total * 10;
  for (const it of sc.items) {
    if (it.pts > 0 || it.blocked) continue;
    const r = it.have / it.need;
    const w = { gwang: 9, godori: 11, hong: 7, cheong: 7, cho: 7, omok: 12, chong: 4, tti: 3, yeol: 3, pi: 4 }[it.key] || 3;
    v += w * r * r;
  }
  // 뺏길 위험: 잠기지 않은 내 패 옆 빈 칸 x 아직 안 보인 같은 달 패
  let risk = 0, locked = 0;
  st.cells.forEach(function (c, i) {
    if (!c || c.owner !== p) return;
    if (c.locked) { locked++; return; }
    const open = neighbors(i).some(function (n) { return !st.cells[n]; });
    if (open) {
      const card = CARD[c.id];
      const weight = card.type === 'gwang' ? 2.2 : card.bird || card.tti === 'red' || card.tti === 'blue' || card.tti === 'cho' ? 1.6 : 1;
      risk += (unseen[card.m] || 0) * weight;
    }
  });
  return v - risk * 0.9 + locked * 0.8;
}

const LEVEL = { easy: { noise: 14, oppW: 0.4 }, normal: { noise: 2.5, oppW: 0.9 }, hard: { noise: 0.3, oppW: 1.05 } };

export function chooseMove(st, me, level, rand) {
  const L = LEVEL[level] || LEVEL.normal, r = rand || Math.random;
  const cells = legalCells(st);
  const unseenMe = unseenByMonth(st, me);
  let best = null;
  for (const id of st.hands[me]) {
    for (const cell of cells) {
      const res = playCard(st, me, id, cell);
      if (!res.ok) continue;
      const s = res.state;
      const val = evaluate(s, me, unseenMe) - L.oppW * evaluate(s, 1 - me, unseenMe) + (r() - 0.5) * L.noise;
      if (!best || val > best.val) best = { id: id, cell: cell, val: val };
    }
  }
  return best;
}

/** 고(true) / 스톱(false). */
export function chooseGo(st, me, level) {
  const mine = st.pending ? st.pending.score : scoreOf(st, me).total;
  const opp = scoreOf(st, 1 - me).total;
  const left = st.deck.length + st.hands[1 - me].length;
  if (level === 'easy') return st.go[me] < 1 && left > 16;
  if (st.go[me] >= 2) return false;
  if (opp >= GOAL - 2) return false;
  if (left < 14) return false;
  return mine < GOAL + 4;
}
