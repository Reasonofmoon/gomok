/**
 * 학습 모드: 실제 판을 두면서 훈장님이 매 순간 "지금 무엇을, 왜"를 설명한다.
 *  - 진행 단계 막대: ① 패 고르기 → ② 칸에 내기 → ③ 뺏기·잠금(자동) → ④ 더미에서 한 장
 *  - 추천 수와 이유(뺏기·잠금·족보·오목·막기), 고른 패 설명, 방금 일어난 일 풀이
 *  - 위험(상대 족보 한 장 전) / 기회(내 족보 한 장 전) 알림 + 판 위 칸 표시
 *  - 족보 칩을 누르면 필요한 패 그림과 규칙
 *  - 학습 목표 체크리스트(기기에 저장)
 */
import { html, React } from './h.js';
import { CARD, MONTHS } from './hwatu.js';
import { scoreOf, playCard, legalCells, previewSteal, GOAL, SIZE } from './engine.js';
import { chooseGo } from './ai.js';
import { CardFace } from './cards.js';
import { Avatar } from './avatars.js';

const { useState } = React;

// ---------- 족보 안내 ----------
export const GUIDE = {
  gwang: { name: '광', rule: '光 표시가 있는 패(1·3·8·11·12월). 3장 3점(비광이 끼면 2점), 4장 4점, 5장 15점.', cards: [0, 8, 28, 40, 44] },
  godori: { name: '고도리', rule: '새 그림 3장(2월 꾀꼬리 · 4월 두견 · 8월 기러기)을 모으면 5점.', cards: [4, 12, 29] },
  hong: { name: '홍단', rule: '글씨가 있는 붉은 띠 3장(1·2·3월). 3점.', cards: [1, 5, 9] },
  cheong: { name: '청단', rule: '파란 띠 3장(6·9·10월). 3점.', cards: [21, 33, 37] },
  cho: { name: '초단', rule: '글씨 없는 붉은 띠 3장(4·5·7월). 3점.', cards: [13, 17, 25] },
  omok: { name: '오목', rule: '내 패 5칸이 가로·세로·대각선으로 한 줄이 되면 줄마다 3점. 오목판 위라서 생긴 이 게임만의 족보예요.' },
  chong: { name: '총통', rule: '같은 달 4장을 모두 판 위에 내 패로 가지면 2점.' },
  tti: { name: '띠', rule: '띠(리본) 패 5장부터 1점, 한 장 늘 때마다 +1점.', of: function (c) { return c.type === 'tti'; } },
  yeol: { name: '열끗', rule: '동물·물건 그림 패 5장부터 1점, 한 장 늘 때마다 +1점.', of: function (c) { return c.type === 'yeol'; } },
  pi: { name: '피', rule: '꽃만 있는 패. 10장부터 1점, 한 장 늘 때마다 +1점. 쌍피(雙)는 2장으로 쳐요.', of: function (c) { return c.type === 'pi'; } }
};
const BIG = ['gwang', 'godori', 'hong', 'cheong', 'cho'];
const KIND = function (c) { return c.type === 'gwang' ? (c.bi ? '비광' : '광') : c.type === 'yeol' ? (c.bird ? '새(열끗)' : '열끗') : c.type === 'tti' ? ({ red: '홍단 띠', blue: '청단 띠', cho: '초단 띠', plain: '띠' })[c.tti] : c.pi === 2 ? '쌍피' : '피'; };
export function cardName(id) { const c = CARD[id]; return c.m + '월 ' + MONTHS[c.m].name + ' ' + KIND(c); }
const subj = function (w) { return w === '나' ? '내가' : josa(w, '이', '가'); };
const poss = function (w) { return w === '나' ? '내' : w + '의'; };
const josa = function (w, a, b) { const ch = w.charCodeAt(w.length - 1); return w + ((ch - 0xac00) % 28 > 0 ? a : b); };

function yakuOfCard(c) {
  const out = [];
  BIG.forEach(function (k) { if (GUIDE[k].cards.indexOf(c.id) >= 0) out.push(GUIDE[k].name); });
  if (c.type === 'tti') out.push('띠'); if (c.type === 'yeol') out.push('열끗'); if (c.type === 'pi') out.push(c.pi === 2 ? '피(2장 몫)' : '피');
  return out;
}

/** 칸에 가상의 p 패를 놓으면 오목이 새로 생기는 칸들. */
function fiveCells(st, p) {
  const base = scoreOf(st, p).fiveCells.length, out = [];
  st.cells.forEach(function (c, i) {
    if (c) return;
    const cells = st.cells.slice(); cells[i] = { id: 2, owner: p, locked: false };
    if (scoreOf(Object.assign({}, st, { cells: cells }), p).fiveCells.length > base) out.push(i);
  });
  return out;
}

/** p의 "한 장 남은" 족보와 그 족보에 남은 패. */
function nearYaku(st, p) {
  const sc = scoreOf(st, p), out = [];
  sc.items.forEach(function (it) {
    if (BIG.indexOf(it.key) < 0 || it.pts || it.blocked) return;
    if (it.key === 'gwang' ? it.have !== 2 : it.have !== it.need - 1) return;
    const mineIds = {}; st.cells.forEach(function (c) { if (c && c.owner === p) mineIds[c.id] = 1; });
    out.push({ key: it.key, have: it.have, need: it.need, missing: GUIDE[it.key].cards.filter(function (id) { return !mineIds[id]; }) });
  });
  return out;
}

/** 이 수를 두면 무엇이 좋은지(사람 말로). */
export function reasons(st, me, id, cell) {
  const r = playCard(st, me, id, cell); if (!r.ok) return [];
  const s = r.state, L = s.last, out = [];
  if (L.gained.length) out.push(L.gained.map(function (k) { return GUIDE[k] ? GUIDE[k].name : k; }).join('·') + ' 완성!');
  if (L.steals.length) out.push('훈장님 패 ' + L.steals.length + '장을 뺏어요' + (L.steals.length >= 3 ? '(싹쓸이)' : L.steals.length === 2 ? '(따닥)' : '(짝)'));
  if (L.lost.length) out.push('훈장님 ' + L.lost.map(function (k) { return GUIDE[k] ? GUIDE[k].name : k; }).join('·') + josa(L.lost.map(function (k) { return GUIDE[k] ? GUIDE[k].name : k; }).join('·'), '을', '를') + ' 깨요');
  const oppFive = fiveCells(st, 1 - me);
  if (oppFive.indexOf(cell) >= 0) out.push('훈장님 오목 자리를 먼저 막아요');
  if (L.locks.length && !L.steals.length) out.push('같은 달 내 패와 붙어 잠겨요(結) — 안 뺏겨요');
  const b = scoreOf(st, me).items.find(function (i) { return i.key === 'omok'; }), a = scoreOf(s, me).items.find(function (i) { return i.key === 'omok'; });
  if (a.have > b.have && a.have >= 3 && !L.gained.length) out.push('내 패 줄이 ' + a.have + '칸으로 길어져요');
  const nb = nearYaku(st, 1 - me), na = nearYaku(s, 1 - me);
  if (na.length < nb.length) out.push('훈장님 족보 하나를 막아요');
  if (!out.length) out.push('뺏길 위험이 적은 무난한 자리예요');
  return out;
}

/** 고른 패 한 장 설명. */
export function aboutCard(st, me, id) {
  const c = CARD[id], m = c.m, lines = [];
  lines.push(cardName(id) + ' — ' + yakuOfCard(c).join(', ') + '에 쓰여요.');
  let oppOpen = 0, oppLocked = 0, mineOpen = 0;
  st.cells.forEach(function (x) { if (!x || CARD[x.id].m !== m) return; if (x.owner !== me) { if (x.locked) oppLocked++; else oppOpen++; } else if (!x.locked) mineOpen++; });
  const legal = legalCells(st), stealCells = legal.filter(function (i) { return previewSteal(st, me, id, i).length; });
  if (stealCells.length) lines.push('"짝" 칸에 내면 훈장님의 ' + m + '월 패를 뺏어 와요.');
  else if (oppOpen) lines.push('훈장님의 ' + m + '월 패가 판에 있지만 지금은 옆 빈칸이 없어요.');
  if (oppLocked) lines.push('훈장님 ' + m + '월 패 ' + oppLocked + '장은 잠겨서(結) 못 뺏어요.');
  if (mineOpen) lines.push('내 ' + m + '월 패 옆에 내면 둘 다 잠겨서 안전해져요.');
  if (!stealCells.length && !mineOpen && !oppOpen) lines.push('판에 같은 달 패가 없어요. 오목 줄을 늘리거나 안전한 곳에 두세요.');
  return lines;
}

/** 방금 일어난 일 풀이. */
export function explainLast(st, me, names) {
  const L = st && st.last; if (!L) return null;
  const who = names[L.player], other = names[1 - L.player], lines = [];
  if (L.shake) return { title: subj(who) + ' 흔들었어요', lines: ['손에 ' + L.shake + '월 패가 3장 있어서 흔들었어요. 흔든 쪽이 이기면 점수가 두 배예요.'] };
  if (L.go) return { title: who + ' ' + L.go + '고!', lines: ['더 쳐서 점수를 올리기로 했어요. 1·2고는 +1점, 3고부터는 두 배.', '대신 상대(' + other + ')가 먼저 ' + GOAL + '점을 내고 스톱하면 고박(두 배로 물기)이에요.'] };
  lines.push(subj(who) + ' ' + josa(cardName(L.cardId), '을', '를') + ' 냈어요.');
  if (L.steals.length) lines.push('옆에 있던 같은 달 ' + (other === '나' ? '내' : other) + ' 패 ' + L.steals.length + '장을 뒤집어 가져갔어요' + (L.steals.length === 2 ? ' — 따닥!' : L.steals.length >= 3 ? ' — 싹쓸이!' : ' — 짝!'));
  if (L.locks.length) lines.push('같은 달 ' + (who === '나' ? '내' : who) + ' 패끼리 붙어서 結로 잠겼어요. 이제 못 뺏어요.');
  if (L.gained.length) L.gained.forEach(function (k) { if (GUIDE[k]) lines.push(GUIDE[k].name + ' 완성: ' + GUIDE[k].rule); });
  if (L.lost.length) { const lw = L.lost.map(function (k) { return GUIDE[k] ? GUIDE[k].name : k; }).join('·'); lines.push(poss(other) + ' ' + josa(lw, '이', '가') + ' 깨졌어요(패를 뺏겨서).'); }
  if (st.status === 'playing' && !st.pending) lines.push('그다음 더미에서 한 장 뽑아 손패를 채우고, 차례가 ' + names[st.turn] + '에게 넘어가요.');
  const title = L.gained.length ? (poss(who) + ' 족보!') : L.steals.length ? (poss(who) + ' 짝 뺏기') : L.locks.length ? (poss(who) + ' 잠금') : (poss(who) + ' 수');
  return { title: title, lines: lines, mine: L.player === me };
}

/** 지금 상황에서 할 일 + 위험/기회. marks: 판에 표시할 칸 */
export function guidance(st, me, sel, hint, names) {
  const out = { phase: 0, title: '', lines: [], marks: { threat: [], chance: [] }, why: null };
  if (!st) return out;
  if (st.status === 'ended') {
    const r = st.result;
    out.phase = -1;
    out.title = r.winner == null ? '나가리' : r.winner === me ? '이겼어요!' : '졌어요';
    out.lines = r.winner == null ? ['아무도 ' + GOAL + '점을 못 내고 패가 다 떨어졌어요. 다음 판은 판돈 두 배.']
      : [names[r.winner] + ' ' + (r.reason === 'stop' ? '스톱으로' : '패를 다 써서') + ' 끝났어요. 족보 ' + r.base + '점 → 최종 ' + r.final + '점.'];
    return out;
  }
  if (st.pending) {
    const p = st.pending.player;
    if (p === me) {
      const goRec = chooseGo(st, me, 'normal'), opp = scoreOf(st, 1 - me).total, left = st.deck.length;
      out.phase = 4; out.title = '③ 고? 스톱?';
      out.lines = [st.pending.score + '점이 났어요. 스톱하면 지금 점수로 바로 이겨요.',
        '고하면 계속 쳐서 더 큰 점수를 노려요(1·2고 +1점, 3고부터 두 배). 대신 훈장님이 먼저 나면 고박이에요.',
        '훈장님 ' + opp + '점 · 남은 더미 ' + left + '장 → 추천: ' + (goRec ? '고 (아직 여유가 있어요)' : '스톱 (위험해요)')];
    } else { out.phase = 4; out.title = '훈장님이 고/스톱을 고르는 중'; out.lines = ['훈장님이 ' + st.pending.score + '점이 났어요. 고하면 판이 이어지고, 스톱하면 여기서 끝나요.']; }
    return out;
  }
  // 위험·기회
  const oppNear = nearYaku(st, 1 - me), myNear = nearYaku(st, me);
  const oppFive = fiveCells(st, 1 - me), myFive = fiveCells(st, me);
  const legal = legalCells(st);
  out.marks.threat = oppFive.filter(function (i) { return legal.indexOf(i) >= 0; });
  out.marks.chance = myFive.filter(function (i) { return legal.indexOf(i) >= 0; });
  const warn = [];
  if (out.marks.threat.length) warn.push('주의 · 훈장님 오목 한 칸 전! 빨간 칸에 먼저 놓으면 막아요.');
  oppNear.forEach(function (n) { warn.push('주의 · 훈장님 ' + GUIDE[n.key].name + ' 한 장 전(' + n.missing.map(function (id) { return CARD[id].m + '월'; }).join('·') + ' 남음). 그 패를 먼저 잡거나 훈장님 패를 뺏으면 막혀요.'); });
  if (out.marks.chance.length) warn.push('기회 · 내 오목 한 칸 전! 금색 칸에 놓으면 오목 3점.');
  myNear.forEach(function (n) { warn.push('기회 · 내 ' + GUIDE[n.key].name + '까지 한 장(' + n.missing.map(function (id) { return CARD[id].m + '월'; }).join('·') + ')!'); });

  if (st.turn !== me) {
    out.phase = 5; out.title = '훈장님 차례';
    out.lines = ['훈장님이 어디에 내는지 지켜봐요. 낸 뒤에 무슨 일이 생겼는지 풀어 드릴게요.'].concat(warn.slice(0, 2));
    return out;
  }
  if (sel == null) {
    out.phase = 0; out.title = '① 손패에서 낼 패를 골라요';
    out.lines = [st.plays === 0 ? '첫 패는 판 한가운데에 내요. 아무 패나 골라도 돼요.' : '내 패는 이미 놓인 패의 옆 8칸에만 낼 수 있어요.'];
    if (hint) { out.lines.push('추천: ' + cardName(hint.id) + ' (하늘색으로 빛나는 패)'); out.why = reasons(st, me, hint.id, hint.cell); }
    out.lines = out.lines.concat(warn.slice(0, 2));
    return out;
  }
  out.phase = 1; out.title = '② 빛나는 칸에 내요';
  out.lines = aboutCard(st, me, sel);
  if (hint && hint.id === sel) { out.lines.push('추천 칸: 하늘색 테두리 칸.'); out.why = reasons(st, me, hint.id, hint.cell); }
  else if (hint) out.lines.push('다른 패를 고르고 싶으면 그 패를 다시 눌러 내려놓아요.');
  out.lines = out.lines.concat(warn.slice(0, 1));
  return out;
}

// ---------- 학습 목표 ----------
const GKEY = 'gomok.learn.goals';
export const GOALS = [
  { id: 'first', text: '첫 패를 가운데에 내기' },
  { id: 'steal', text: '짝 뺏기 — 같은 달 상대 패 뒤집기' },
  { id: 'lock', text: '잠그기(結) — 같은 달 내 패 붙이기' },
  { id: 'yaku', text: '족보 하나 완성하기' },
  { id: 'block', text: '상대 족보 깨기' },
  { id: 'gostop', text: '고 또는 스톱 골라 보기' },
  { id: 'finish', text: '한 판 끝까지 치기' }
];
export function loadGoals() { try { return JSON.parse(localStorage.getItem(GKEY)) || {}; } catch (e) { return {}; } }
export function saveGoals(g) { try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch (e) { /* 없음 */ } }
/** 새 판에서 달성한 목표 id 목록. */
export function goalsFrom(st, me, kind) {
  const L = st.last, out = [];
  if (kind && kind.decide && kind.who === me) out.push('gostop');
  if (L && L.player === me && !L.shake && !(kind && kind.decide)) {
    if (st.plays === 1 || L.cell === 24) out.push('first');
    if (L.steals.length) out.push('steal');
    if (L.locks.length) out.push('lock');
    if (L.gained.length) out.push('yaku');
    if (L.lost.length) out.push('block');
  }
  if (st.status === 'ended') out.push('finish');
  return out;
}

// ---------- 화면 조각 ----------
const FLOW = ['패 고르기', '칸에 내기', '뺏기·잠금', '한 장 뽑기'];
export function FlowBar(props) {
  const ph = props.phase;
  return html`<div class="flow" aria-label="한 수의 순서">${FLOW.map(function (t, i) {
    const on = ph === i || (ph === 2 && i >= 2);
    return html`<span key=${i} class=${'fl' + (on ? ' on' : '') + (ph > i && ph < 4 ? ' done' : '')}><b>${i + 1}</b>${t}</span>`;
  })}${ph === 5 ? html`<span class="fl wait">훈장님 차례</span>` : ph === 4 ? html`<span class="fl on gs">고/스톱</span>` : null}</div>`;
}

export function LearnCoach(props) {
  const g = props.g, ev = props.event;
  const [why, setWhy] = useState(false);
  const show = ev || g;
  return html`<div class=${'learn-coach' + (ev ? ' event' + (ev.mine ? ' mine' : ' theirs') : '')} role="status" aria-live="polite">
    <div class="lc-left">${props.deck}<span class="lc-av"><${Avatar} char="grandpa" mood=${ev ? (ev.mine ? 'happy' : 'smug') : g.phase === 5 ? 'think' : 'idle'} /></span></div>
    <div class="lc-body" key=${show.title}>
      <p class="lc-title">${show.title}</p>
      ${show.lines.slice(0, ev ? 4 : 3).map(function (l, i) { return html`<p key=${i} class=${'lc-line' + (/^주의/.test(l) ? ' warn' : /^기회/.test(l) ? ' good' : '')}>${l}</p>`; })}
      ${!ev && g.why ? html`<button class="lc-why" onClick=${function () { setWhy(!why); }}>${why ? '이유 닫기' : '왜 이 수가 좋아요?'}</button>` : null}
      ${!ev && why && g.why ? html`<ul class="lc-reasons">${g.why.map(function (w, i) { return html`<li key=${i}>${w}</li>`; })}</ul>` : null}
      ${ev ? html`<button class="lc-why" onClick=${props.onDismiss}>알겠어요 ›</button>` : null}
    </div>
  </div>`;
}

export function ChipInfo(props) {
  const k = props.k, G = GUIDE[k], st = props.st, me = props.me;
  if (!G) return null;
  const owner = {}; st.cells.forEach(function (c) { if (c) owner[c.id] = c.owner === me ? 'mine' : 'theirs'; });
  const ids = G.cards || (G.of ? CARD.filter(G.of).map(function (c) { return c.id; }) : []);
  const it = scoreOf(st, me).items.find(function (i) { return i.key === k; });
  return html`<div class="modal-bg" role="dialog" aria-modal="true" aria-label=${G.name + ' 설명'} onClick=${props.onClose}><div class="modal chipinfo" onClick=${function (e) { e.stopPropagation(); }}>
    <h2>${G.name}</h2>
    <p class="lead">${G.rule}</p>
    ${it ? html`<p class="ci-now">지금 내 판: <b>${it.have}${it.need ? ' / ' + it.need : ''}</b>${it.pts ? ' · ' + it.pts + '점' : ''}${it.blocked ? ' · 훈장님이 잠가서 막힘' : ''}</p>` : null}
    ${ids.length ? html`<div class="ci-cards">${ids.map(function (id) {
      return html`<span key=${id} class=${'ci-card ' + (owner[id] || 'none')}><${CardFace} id=${id} /><i>${owner[id] === 'mine' ? '내 것' : owner[id] === 'theirs' ? '훈장님' : '아직'}</i></span>`;
    })}</div>` : html`<p class="fine">판 위 내 패의 배치로 정해져요. 판에서 줄을 확인해 보세요.</p>`}
    <div class="row"><button class="btn primary" onClick=${props.onClose}>알겠어요</button></div>
  </div></div>`;
}

export function GoalSheet(props) {
  const g = props.goals, done = GOALS.filter(function (x) { return g[x.id]; }).length;
  return html`<div class="modal-bg" role="dialog" aria-modal="true" aria-label="학습 목표" onClick=${props.onClose}><div class="modal goals" onClick=${function (e) { e.stopPropagation(); }}>
    <h2>학습 목표 ${done}/${GOALS.length}</h2>
    <p class="lead">한 판 치면서 하나씩 해 보세요. 다 하면 고목 졸업!</p>
    <ul class="gl">${GOALS.map(function (x) { return html`<li key=${x.id} class=${g[x.id] ? 'ok' : ''}><i>${g[x.id] ? '✓' : ''}</i>${x.text}</li>`; })}</ul>
    <div class="row"><button class="btn primary" onClick=${props.onClose}>계속 치기</button></div>
  </div></div>`;
}
