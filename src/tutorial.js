/**
 * 1분 튜토리얼: 짜 둔 판에서 훈장님이 한 수씩 짚어 준다.
 * - 스포트라이트: 지금 눌러야 할 곳만 밝히고 나머지는 어둡게.
 * - 행동 유도: 눌러야 할 곳에 물결(탭) 표시 + "여기!" 꼬리표, 다른 곳을 누르면 살짝 흔들며 다시 안내.
 * - 버튼 단계(읽기)와 행동 단계(직접 고르고 놓기)를 번갈아 둔다.
 */
import { html, React } from './h.js';
import { CARD } from './hwatu.js';
import { playCard, legalCells, previewSteal, scoreOf, CENTER, GOAL } from './engine.js';
import { Board, Seat, Hand, Toasts, Rail, drawFly } from './App.js';
import { Avatar, useMoods, charOf } from './avatars.js';
import { sfx, buzz } from './fx.js';

const { useState, useEffect, useLayoutEffect, useRef } = React;
const DONE_KEY = 'gomok.tutorial.v1';
export function tutorialDone() { try { return localStorage.getItem(DONE_KEY) === 'done'; } catch (e) { return false; } }
function markDone() { try { localStorage.setItem(DONE_KEY, 'done'); } catch (e) { /* 없음 */ } }

function mk(o) {
  return Object.assign({ cells: new Array(49).fill(null), deck: [], hands: [[], []], turn: 0, plays: 0, status: 'playing', go: [0, 0], goScore: [0, 0], shaken: [[], []], pending: null, result: null, last: null, seed: 1 }, o);
}
function rest(used, first) {
  const all = CARD.map(function (c) { return c.id; }).filter(function (id) { return used.indexOf(id) < 0 && first.indexOf(id) < 0; });
  return first.concat(all);
}
// 1막: 빈 판. 내 손 [송학 광, 2월 피, 6월 피, 9월 청단, 12월 제비], 상대 손에 2월 매조(새)
const H0 = [0, 6, 22, 33, 45], H1 = [4, 38, 15, 27, 43];
function scene1() { return mk({ hands: [H0.slice(), H1.slice()], deck: rest(H0.concat(H1), [3, 30, 10, 26]) }); }
// 2막: 가로로 내 패 4칸(22~25). 양 끝(21, 26)에 놓으면 오목
function scene2() {
  const cells = new Array(49).fill(null);
  [[22, 3], [23, 7], [24, 11], [25, 14]].forEach(function (p) { cells[p[0]] = { id: p[1], owner: 0, locked: false }; });
  [[17, 19], [30, 23], [31, 27]].forEach(function (p) { cells[p[0]] = { id: p[1], owner: 1, locked: false }; });
  const mine = [34, 39, 42, 46, 35], theirs = [2, 10, 18, 26, 31];
  const used = [3, 7, 11, 14, 19, 23, 27].concat(mine, theirs);
  return mk({ cells: cells, hands: [mine, theirs], deck: rest(used, []), plays: 7 });
}

const STEPS = [
  { id: 'intro', kind: 'info', pos: 'center', mood: 'happy', title: '어서 와요, 고목 한 판 배워 볼까요?',
    text: '고목은 오목판 위에서 치는 고스톱이에요. 판에 남은 내 패로 점수를 내요. 딱 1분, 제가 한 수씩 짚어 드릴게요.', cta: '좋아요, 시작!' },
  { id: 'pick1', kind: 'pick', pos: 'top', mood: 'idle', title: '① 손패에서 한 장 고르기',
    text: '맨 아래가 내 손패예요. 반짝이는 송학 광(1월)을 눌러 보세요.', allow: function (id) { return id === 0; }, targets: function () { return ['[data-card="0"]']; } },
  { id: 'place1', kind: 'place', pos: 'top', mood: 'idle', title: '② 첫 패는 한가운데',
    text: '첫 패는 늘 판 한가운데에 놓아요. 빛나는 가운데 칸을 누르세요.', allow: function (i) { return i === CENTER; }, targets: function () { return ['[data-cell="' + CENTER + '"]']; } },
  { id: 'adjacent', kind: 'info', pos: 'bottom', mood: 'think', title: '③ 그다음부턴 옆 칸에만',
    text: '이제 놓인 패의 가로·세로·대각선 옆 칸에만 낼 수 있어요. 점선이 숨 쉬는 칸들이 낼 수 있는 자리예요. 방금 저도 2월 매조(새)를 옆에 냈죠.',
    previewSel: 22, targets: function () { return ['.board']; }, cta: '알겠어요' },
  { id: 'pick2', kind: 'pick', pos: 'top', mood: 'smug', title: '④ 짝 뺏기 준비',
    text: '제 2월 매조가 보이죠? 손에도 2월 패(매화 피)가 있어요. 그 패를 눌러 고르세요.',
    allow: function (id) { return id === 6; }, targets: function () { return ['[data-card="6"]']; } },
  { id: 'place2', kind: 'place', pos: 'bottom', mood: 'nervous', title: '⑤ "짝" 칸에 내기',
    text: '"짝" 표시가 뜬 칸에 내면, 옆의 같은 달 상대 패를 뒤집어서 내 것으로 가져와요. 하나 골라 누르세요.',
    allow: function (i, st) { return previewSteal(st, 0, 6, i).length > 0; },
    targets: function (st) { return legalCells(st).filter(function (i) { return previewSteal(st, 0, 6, i).length > 0; }).map(function (i) { return '[data-cell="' + i + '"]'; }); } },
  { id: 'locked', kind: 'info', pos: 'bottom', mood: 'shock', title: '뺏었어요! 그리고 잠금(結)',
    text: '같은 달 내 패끼리 붙으면 結 매듭으로 잠겨요. 잠긴 패는 다시 못 뺏어요. 한 번에 둘을 뺏으면 따닥, 셋 이상이면 싹쓸이!',
    targets: function (st) { return st.last ? ['[data-cell="' + st.last.cell + '"]', '[data-cell="25"]'] : []; }, cta: '좋아요' },
  { id: 'chips', kind: 'info', pos: 'top', mood: 'idle', title: '⑥ 점수는 판 위 내 패로',
    text: '여기 칩이 족보 진행도예요. 광 3장, 고도리(새 3마리), 홍단·청단·초단, 피 10장… 하나 남으면 노랗게 빛나요. 방금 뺏은 새 덕에 고도리 1/3!',
    targets: function () { return ['.seat.bottom']; }, cta: '다음' },
  { id: 'pick3', kind: 'pick', pos: 'top', mood: 'think', title: '⑦ 오목도 족보예요',
    text: '판을 바꿨어요. 내 패 4칸이 가로로 이어져 있죠? 5칸이 되면 줄마다 3점! 아무 패나 하나 골라요.',
    scene: scene2, allow: function () { return true; }, targets: function () { return ['.hand']; } },
  { id: 'place3', kind: 'place', pos: 'top', mood: 'nervous', title: '⑧ 줄 끝에 놓아 다섯 칸',
    text: '가로줄 양 끝의 빛나는 칸 중 하나에 놓아 오목을 완성하세요.',
    allow: function (i) { return i === 21 || i === 26; }, targets: function () { return ['[data-cell="21"]', '[data-cell="26"]']; } },
  { id: 'omokDone', kind: 'info', pos: 'top', mood: 'cheer', title: '오목 완성, 3점!',
    text: '다섯 칸이 이어지니 줄이 그어졌죠? 아래 내 칩에 "오목 3점"이 켜졌어요. 이렇게 판 위 내 패로 점수가 쌓여요.',
    targets: function (st) { return st.last ? [21, 22, 23, 24, 25, 26].filter(function (i) { return st.cells[i] && st.cells[i].owner === 0; }).map(function (i) { return '[data-cell="' + i + '"]'; }) : []; }, cta: '다음' },
  { id: 'gostop', kind: 'gostop', pos: 'center', mood: 'think', title: '⑨ ' + GOAL + '점이 넘으면 고? 스톱?',
    text: '점수가 ' + GOAL + '점을 넘는 순간 골라야 해요. 둘 중 하나를 눌러 보세요.' },
  { id: 'done', kind: 'done', pos: 'center', mood: 'cheer', title: '다 배웠어요!',
    text: '내기 → 짝 뺏기 → 잠금 → 족보·오목 → 고/스톱. 이제 순한 맛 훈장님과 진짜 한 판 해 볼까요?' }
];

/** 지금 눌러야 할 곳만 밝히는 조명 + 물결. */
function Spotlight(props) {
  const [rect, setRect] = useState(null);
  const [first, setFirst] = useState(null);
  const sig = props.selectors.join('|');
  useLayoutEffect(function () {
    let alive = true, t = null;
    const measure = function () {
      if (!alive) return;
      const els = [];
      props.selectors.forEach(function (s) { document.querySelectorAll(s).forEach(function (e) { els.push(e); }); });
      if (!els.length) setRect(null);
      else {
        let l = 1e9, tp = 1e9, r = -1e9, b = -1e9;
        els.forEach(function (e) { const q = e.getBoundingClientRect(); l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
        setRect(function (p) { return p && Math.abs(p.l - l) < 0.5 && Math.abs(p.t - tp) < 0.5 && Math.abs(p.r - r) < 0.5 && Math.abs(p.b - b) < 0.5 ? p : { l: l, t: tp, r: r, b: b }; });
        const q0 = els[0].getBoundingClientRect(), fx = Math.round(q0.left + q0.width / 2), fy = Math.round(q0.top + q0.height / 2);
        setFirst(function (p) { return p && p.x === fx && p.y === fy ? p : { x: fx, y: fy }; });
      }
      t = setTimeout(measure, 200);
    };
    measure();
    return function () { alive = false; clearTimeout(t); };
  }, [sig]);
  if (!rect) return html`<div class="spot-dim"></div>`;
  const pad = 6;
  return html`<div class=${'spot' + (props.tap ? ' act' : '')} style=${{ left: rect.l - pad + 'px', top: rect.t - pad + 'px', width: rect.r - rect.l + pad * 2 + 'px', height: rect.b - rect.t + pad * 2 + 'px' }}>
    ${props.tap && first ? html`<span class="tap" aria-hidden="true" style=${{ left: first.x - rect.l + pad + 'px', top: first.y - rect.t + pad + 'px' }}><i></i><i></i><b>${props.tapLabel || '여기!'}</b></span>` : null}
  </div>`;
}

export function Tutorial(props) {
  const [k, setK] = useState(0);
  const [st, setSt] = useState(scene1);
  const [sel, setSel] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [gs, setGs] = useState(null);
  const step = STEPS[k];
  const face = useMoods(st, -1);
  const myChar = charOf(props.ledger.avatar);
  const timers = useRef([]);
  useEffect(function () { return function () { timers.current.forEach(clearTimeout); }; }, []);
  const later = function (fn, ms) { timers.current.push(setTimeout(fn, ms)); };

  const toast = function (text, tone) {
    const id = Math.random();
    setToasts(function (t) { return t.concat([{ id: id, text: text, tone: tone }]).slice(-2); });
    later(function () { setToasts(function (t) { return t.filter(function (x) { return x.id !== id; }); }); }, 1600);
  };
  const go = function (n) {
    const s = STEPS[n];
    if (s.scene) { setSt(s.scene()); }
    setSel(s.previewSel != null ? s.previewSel : null);
    setK(n);
    if (s.kind === 'done') markDone();
  };
  const next = function () { sfx.tick(); go(k + 1); };
  const nudge = function (msg) { setShakeKey(shakeKey + 1); buzz(30); toast(msg || '빛나는 곳을 눌러 주세요', 'bad'); };
  const oppMove = function (s, id, cell, then) {
    later(function () {
      const r = playCard(s, 1, id, cell);
      if (r.ok) { sfx.slap(); setSt(r.state); }
      later(function () { setBusy(false); if (then) then(r.ok ? r.state : s); }, 700);
    }, 650);
  };

  const onPick = function (id) {
    if (busy || step.kind !== 'pick') return nudge(step.kind === 'place' ? '이제 판의 빛나는 칸을 눌러요' : '먼저 위의 버튼을 눌러 주세요');
    if (id == null) return;
    if (!step.allow(id, st)) return nudge('반짝이는 패를 골라 주세요');
    sfx.tick(); setSel(id); setK(k + 1);
  };
  const onCell = function (i) {
    if (busy || step.kind !== 'place' || sel == null) return nudge(step.kind === 'info' ? '위의 버튼을 눌러 계속해요' : null);
    if (!step.allow(i, st)) return nudge('빛나는 칸에 놓아 주세요');
    const r = playCard(st, 0, sel, i);
    if (!r.ok) return nudge();
    sfx.slap();
    const L = r.state.last;
    if (L.steals.length) { toast('짝!', 'good'); later(sfx.steal, 90); buzz(40); }
    if (L.gained.length) { toast(L.gained.indexOf('omok') >= 0 ? '오목! +3점' : '족보!', 'gold'); later(sfx.yaku, 200); }
    setSt(r.state); setSel(null); setBusy(true);
    if (step.id === 'place1') oppMove(r.state, 4, 25, function () { go(k + 1); });
    else later(function () { setBusy(false); go(k + 1); }, step.id === 'place3' ? 1300 : 800);
  };
  const onCta = function () {
    if (step.id === 'locked') {   // 상대 한 수 더 두고 점수 설명으로
      setBusy(true); oppMove(st, 38, 23, function () { go(k + 1); }); setK(k); sfx.tick(); return;
    }
    next();
  };
  const skip = function () { markDone(); props.onExit(); };

  const isAct = step.kind === 'pick' || step.kind === 'place';
  const targets = step.targets ? step.targets(st) : [];
  const canPlay = !busy && (step.kind === 'pick' || step.kind === 'place' || step.previewSel != null);
  const status = step.kind === 'pick' ? '손패를 눌러 고르세요' : step.kind === 'place' ? '빛나는 칸에 내세요' : '훈장님 설명을 읽고 버튼을 눌러요';
  const fly = drawFly(st, 0);
  const coachMood = busy ? 'think' : step.mood;

  return html`<section class="game tut">
    <header class="topbar">
      <button class="icon-btn" onClick=${skip} aria-label="튜토리얼 나가기">‹</button>
      <div class="tb-mid"><b>1분 배우기</b><small>${k + 1} / ${STEPS.length}</small></div>
      <div class="tb-right"><button class="pill" onClick=${skip}>건너뛰기</button></div>
    </header>
    <${Seat} seat=${1} top=${true} name="훈장님" char="grandpa" mood=${face.moods[1]} say=${face.says[1]} score=${scoreOf(st, 1)} go=${0} shakes=${0} active=${st.turn === 1} fan=${st.hands[1].length} skin=${props.ledger.back} />
    <${Board} st=${st} sel=${sel} me=${0} canPlay=${canPlay} onCell=${onCell} />
    <${Rail} deck=${st.deck.length} skin=${props.ledger.back} flyKey=${fly.key} flyTo=${fly.to} status=${status} cue=${isAct} />
    <${Seat} seat=${0} name="나" char=${myChar} mood=${face.moods[0]} say=${face.says[0]} score=${scoreOf(st, 0)} go=${0} shakes=${0} active=${st.turn === 0} />
    <${Hand} cards=${st.hands[0]} sel=${sel} onPick=${onPick} canPlay=${!busy} skin=${props.ledger.back} nudge=${step.kind === 'pick'} />
    <${Toasts} items=${toasts} />

    ${busy ? null : html`<${Spotlight} selectors=${targets} tap=${isAct} tapLabel=${step.kind === 'pick' ? '눌러서 고르기' : '여기에 놓기'} />`}

    <div class=${'coach ' + step.pos + (step.pos === 'center' ? ' modalish' : '')} key=${'c' + k + '-' + shakeKey} role="dialog" aria-live="polite" aria-label=${step.title}>
      <div class="coach-face"><${Avatar} char="grandpa" mood=${coachMood} size=${step.pos === 'center' ? 'xl' : 'lg'} /></div>
      <div class="coach-body">
        <p class="coach-title">${step.title}</p>
        <p class="coach-text">${step.text}</p>
        ${step.kind === 'info' ? html`<div class="coach-row"><button class="btn primary cta" disabled=${busy} onClick=${onCta}>${step.cta || '다음'} <span class="arr">›</span></button></div>` : null}
        ${step.kind === 'gostop' ? html`<div class="coach-gs">
          <div class="row"><button class=${'btn go' + (gs ? '' : ' cta')} onClick=${function () { sfx.go(); setGs('go'); }}>고!</button><button class=${'btn stop' + (gs ? '' : ' cta')} onClick=${function () { sfx.stop(); setGs('stop'); }}>스톱</button></div>
          ${gs === 'go' ? html`<p class="gs-say"><b>고!</b> 계속 쳐서 점수를 더 올려요. 1·2고는 +1점, 3고부터 두 배. 대신 상대가 먼저 나서 스톱하면 <b>고박</b>, 두 배로 물어요.</p>` : null}
          ${gs === 'stop' ? html`<p class="gs-say"><b>스톱!</b> 지금 점수로 바로 이겨요. 안전하지만 더 큰 판은 놓쳐요.</p>` : null}
          ${gs ? html`<div class="coach-row"><button class="btn primary cta" onClick=${next}>알겠어요 <span class="arr">›</span></button></div>` : null}
        </div>` : null}
        ${step.kind === 'done' ? html`<div class="coach-row col">
          <button class="btn primary big cta" onClick=${function () { props.onPlay('cpu', 'easy'); }}>훈장님과 한 판 <span class="arr">›</span></button>
          <button class="btn" onClick=${props.onExit}>처음 화면으로</button></div>` : null}
        <div class="dots" aria-hidden="true">${STEPS.map(function (_, i) { return html`<i key=${i} class=${i < k ? 'done' : i === k ? 'now' : ''}></i>`; })}</div>
      </div>
    </div>
  </section>`;
}
