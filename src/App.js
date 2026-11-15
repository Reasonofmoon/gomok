/**
 * 고목(GO·MOK) 화면. React 18 + htm(빌드 없이 JSX 대신 태그 템플릿).
 * 판 상태는 engine.js가 정본이다. 온라인 방에서는 서버(Apps Script)가 같은 engine을 돌리고 화면은 받은 상태를 그린다.
 */
import { html, React } from './h.js';
import { CARD } from './hwatu.js';
import { newGame, playCard, decide, legalCells, previewSteal, scoreOf, shakeable, shake, REASON_TEXT, SIZE, GOAL } from './engine.js';
import { chooseMove, chooseGo } from './ai.js';
import { CardFace, CardBack, CardDefs, DeckPile, MiniFan, monthName, warmCards, CARD_CREDIT } from './cards.js';
import { Avatar, useMoods, charOf } from './avatars.js';
import { ensureFelt, sfx, sound, buzz } from './fx.js';
import { loadLedger, saveLedger, settleLedger, SHOP, STAKES, buy, equip } from './ledger.js';
import { Online } from './Online.js';
import { Tutorial, tutorialDone } from './tutorial.js';

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const won = function (n) { return n.toLocaleString('ko-KR') + '원'; };
const LEVEL_KO = { easy: '순한 맛', normal: '보통', hard: '얍삽이' };

// ---------- 작은 조각 ----------

export function Toasts(props) {
  return html`<div class="toasts" aria-live="polite">${props.items.map(function (t) {
    return html`<div key=${t.id} class=${'toast ' + (t.tone || '')}>${t.text}</div>`;
  })}</div>`;
}

function Chips(props) {
  const sc = props.score;
  const shown = sc.items.filter(function (it) { return it.pts > 0 || it.have > 0; });
  return html`<div class="chips">${shown.length ? shown.map(function (it) {
    const near = !it.pts && !it.blocked && it.have === it.need - 1;
    const cls = 'chip' + (it.pts ? ' on' : '') + (near ? ' near' : '') + (it.blocked && !it.pts ? ' dead' : '');
    const txt = it.pts ? it.label + (it.count > 1 ? '×' + it.count : '') + ' ' + it.pts + '점' : it.label + ' ' + it.have + '/' + it.need;
    return html`<span key=${it.key} class=${cls} title=${it.blocked ? '상대가 잠가서 막혔어요' : ''}>${txt}</span>`;
  }) : html`<span class="chip ghost">아직 족보 없음</span>`}</div>`;
}

/** 자리: 아바타(표정·말풍선) + 이름 + 족보 칩 + 점수. 위쪽 자리는 상대 손패를 부채꼴로 보여 준다. */
export function Seat(props) {
  const p = props;
  return html`<div class=${'seat ' + (p.active ? 'active ' : '') + (p.top ? 'top' : 'bottom')}>
    <div class="av-wrap">
      <${Avatar} char=${p.char} mood=${p.mood} seat=${p.seat} active=${p.active} />
      ${p.say ? html`<span key=${p.say.key} class="say">${p.say.text}</span>` : null}
    </div>
    <div class="seat-main">
      <div class="seat-name">${p.name}${p.go ? html`<span class="go-badge">${p.go}고</span>` : null}${p.shakes ? html`<span class="go-badge shake">흔듦×${p.shakes}</span>` : null}</div>
      <${Chips} score=${p.score} />
    </div>
    ${p.fan != null ? html`<${MiniFan} count=${p.fan} skin=${p.skin} />` : null}
    <div class=${'seat-score' + (p.score.total >= GOAL ? ' hot' : '')}><b>${p.score.total}</b><small>점</small></div>
  </div>`;
}

/** 판 아래 줄: 엎어 쌓은 더미 + 지금 할 일. */
export function Rail(props) {
  return html`<div class="rail">
    <${DeckPile} count=${props.deck} skin=${props.skin} flyKey=${props.flyKey} flyTo=${props.flyTo} />
    <p class=${'status' + (props.cue ? ' cue' : '')} role="status">${props.status}</p>
  </div>`;
}
export function drawFly(st, me) {
  if (!st || !st.last || st.last.shake || st.deck.length >= 38) return { key: null, to: 'down' };
  return { key: 'd' + st.deck.length, to: st.last.player === me ? 'down' : 'up' };
}

export function Board(props) {
  const st = props.st, sel = props.sel, me = props.me;
  const legal = useMemo(function () { return sel != null && props.canPlay ? legalCells(st) : []; }, [st, sel, props.canPlay]);
  const lastCell = st.last && st.last.cell >= 0 ? st.last.cell : -1;
  const steals = st.last ? st.last.steals : [];
  const lines = useMemo(function () {
    const out = [];
    [0, 1].forEach(function (p) { scoreOf(st, p).fiveCells.forEach(function (run) { out.push({ p: p, a: run[0], b: run[run.length - 1] }); }); });
    return out;
  }, [st]);
  const xy = function (i) { return [i % SIZE + 0.5, ((i / SIZE) | 0) + 0.5]; };
  return html`<div class="board-frame"><div class="board" role="grid" aria-label="7줄 담요 판">
    <svg class="grid" viewBox=${'0 0 ' + SIZE + ' ' + SIZE} preserveAspectRatio="none" aria-hidden="true">${Array.from({ length: SIZE }, function (_, k) { return html`<g key=${k}><line x1="0.5" x2=${SIZE - 0.5} y1=${k + 0.5} y2=${k + 0.5} /><line y1="0.5" y2=${SIZE - 0.5} x1=${k + 0.5} x2=${k + 0.5} /></g>`; })}<circle cx="3.5" cy="3.5" r=".07" /><circle cx="1.5" cy="1.5" r=".05" /><circle cx="5.5" cy="1.5" r=".05" /><circle cx="1.5" cy="5.5" r=".05" /><circle cx="5.5" cy="5.5" r=".05" /></svg>
    ${st.cells.map(function (c, i) {
      const isLegal = legal.indexOf(i) >= 0;
      const st2 = isLegal ? previewSteal(st, me, sel, i).length : 0;
      const hint = props.hint && props.hint.cell === i;
      let cls = 'cell';
      if (c) cls += ' has o' + c.owner + (c.locked ? ' locked' : '') + (i === lastCell ? ' drop' : '') + (steals.indexOf(i) >= 0 ? ' flip' : '');
      if (isLegal) cls += ' legal' + (st2 ? ' steal' : '');
      if (hint) cls += ' hint';
      const label = c ? CARD[c.id].label + (c.owner === me ? ' (내 패' : ' (상대 패') + (c.locked ? ', 잠김)' : ')') : isLegal ? '빈 칸, 낼 수 있음' : '빈 칸';
      return html`<button key=${i + ':' + (c ? c.id + '-' + c.owner + '-' + st.plays : 'e')} class=${cls} aria-label=${label} data-cell=${i}
        onClick=${function () { props.onCell(i); }} disabled=${!isLegal}>
        ${c ? html`<span class="plate"><${CardFace} id=${c.id} noTitle=${true} /></span>` : null}
        ${c && c.locked ? html`<span class="knot" aria-hidden="true">結</span>` : null}
        ${st2 ? html`<span class="steal-n">짝${st2 > 1 ? ' ' + st2 : ''}</span>` : null}
      </button>`;
    })}
    <svg class="lines" viewBox=${'0 0 ' + SIZE + ' ' + SIZE} preserveAspectRatio="none" aria-hidden="true">
      ${lines.map(function (l, k) { const a = xy(l.a), b = xy(l.b); return html`<line key=${k} class=${'five p' + l.p} x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} />`; })}
    </svg>
  </div></div>`;
}

export function Hand(props) {
  return html`<div class=${'hand' + (props.hidden ? ' hidden' : '') + (props.nudge ? ' nudge' : '')}>${props.cards.map(function (id, k) {
    if (props.hidden || id < 0) return html`<div key=${'b' + k} class="hcard back"><${CardBack} skin=${props.skin} /></div>`;
    const on = props.sel === id, hint = props.hint && props.hint.id === id;
    return html`<button key=${id} class=${'hcard' + (on ? ' sel' : '') + (hint ? ' hint' : '')} aria-pressed=${on} aria-label=${CARD[id].label} data-card=${id}
      style=${{ animationDelay: (k * 0.12) + 's' }}
      onClick=${function () { props.onPick(on ? null : id); }} disabled=${!props.canPlay}><${CardFace} id=${id} /></button>`;
  })}</div>`;
}

export function Modal(props) {
  return html`<div class="modal-bg" role="dialog" aria-modal="true" aria-label=${props.label || ''}><div class=${'modal ' + (props.cls || '')}>${props.children}</div></div>`;
}

/** 판 도중 "?" : 한눈 규칙 + 튜토리얼로 가는 버튼. */
export function QuickHelp(props) {
  return html`<${Modal} label="한눈 규칙" cls="quick">
    <h2>한눈에 보는 규칙</h2>
    <ol class="qh">
      <li><b>내기</b><span>첫 패는 가운데, 그다음은 놓인 패 <em>옆 8칸</em>에만.</span></li>
      <li><b>짝 뺏기</b><span>옆에 같은 달 <em>상대 패</em>가 있으면 뒤집어서 내 것.</span></li>
      <li><b>잠금 結</b><span>같은 달 <em>내 패</em>끼리 붙으면 잠겨서 못 뺏겨요.</span></li>
      <li><b>점수</b><span>판 위 내 패로 족보. 5칸 이으면 <em>오목 3점</em>.</span></li>
      <li><b>고/스톱</b><span>${GOAL}점부터. 고는 더, 스톱은 지금 점수로 끝.</span></li>
    </ol>
    <div class="row">${props.onTutorial ? html`<button class="btn primary" onClick=${props.onTutorial}>직접 해 보며 배우기</button>` : null}<button class="btn" onClick=${props.onClose}>계속하기</button></div>
  <//>`;
}

// ---------- 선 정하기 (엎어 둔 패에서 한 장) ----------
function PickFirst(props) {
  const pool = useMemo(function () {
    const ids = CARD.map(function (c) { return c.id; }).sort(function () { return Math.random() - 0.5; });
    return ids.slice(0, 6);
  }, []);
  const [picked, setPicked] = useState(null);
  const other = picked == null ? null : pool.filter(function (id) { return id !== picked; })[Math.floor(Math.random() * 5)];
  const oppRef = useRef(null);
  if (picked != null && oppRef.current == null) oppRef.current = other;
  const opp = oppRef.current;
  const res = picked == null ? null : CARD[picked].m === CARD[opp].m ? (picked < opp ? 0 : 1) : CARD[picked].m > CARD[opp].m ? 0 : 1;
  return html`<${Modal} label="선 정하기" cls="pick">
    <h2>선 정하기</h2><p class="lead">엎어 둔 패 중 한 장을 고르세요. 높은 달이 먼저 칩니다.</p>
    <div class=${'pick-row' + (picked == null ? ' nudge' : '')}>${pool.map(function (id, k) {
      const open = picked != null && (id === picked || id === opp);
      return html`<button key=${id} class=${'hcard' + (id === picked ? ' sel' : '') + (id === opp ? ' opp' : '')} disabled=${picked != null} style=${{ animationDelay: (k * 0.1) + 's' }}
        onClick=${function () { sfx.slap(); setPicked(id); }} aria-label="엎어 둔 패">${open ? html`<${CardFace} id=${id} />` : html`<${CardBack} skin=${props.skin} />`}</button>`;
    })}</div>
    ${res != null ? html`<p class="pick-res">나 ${CARD[picked].m}월 · ${props.oppName} ${CARD[opp].m}월 → <b>${res === 0 ? '내가' : props.oppName + '가'} 선</b></p>
      <button class="btn primary big cta" onClick=${function () { props.onDone(res); }}>시작</button>` : null}
  <//>`;
}

// ---------- 한 판 (컴퓨터 / 한 화면 둘이서) ----------
function Game(props) {
  const mode = props.mode, ledger = props.ledger;
  const [st, setSt] = useState(null);
  const [sel, setSel] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [cover, setCover] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [help, setHelp] = useState(false);
  const settled = useRef(false);
  const names = mode === 'cpu' ? ['나', '훈장님'] : ['1번', '2번'];
  const chars = mode === 'cpu' ? [charOf(ledger.avatar), 'grandpa'] : [charOf(ledger.avatar), charOf(ledger.avatar) === 'granny' ? 'grandpa' : 'granny'];
  const face = useMoods(st, mode === 'cpu' ? 1 : -1);

  // 한 화면 둘이서: 아래쪽은 지금 차례인 사람
  const me = !st ? 0 : mode === 'local' ? (st.pending ? st.pending.player : st.turn) : 0;
  const opp = 1 - me;

  const toast = useCallback(function (text, tone) {
    const id = Math.random();
    setToasts(function (t) { return t.concat([{ id: id, text: text, tone: tone }]).slice(-3); });
    setTimeout(function () { setToasts(function (t) { return t.filter(function (x) { return x.id !== id; }); }); }, 1700);
  }, []);

  const announce = useCallback(function (s) {
    const L = s.last; if (!L) return;
    const LABEL = { gwang: '광', godori: '고도리!', hong: '홍단!', cheong: '청단!', cho: '초단!', omok: '오목!', chong: '총통!', tti: '띠', yeol: '열끗', pi: '피' };
    if (L.shake) { toast(names[L.player] + ' 흔들기! ' + L.shake + '월', 'gold'); sfx.go(); return; }
    sfx.slap();
    if (L.steals.length) { toast(L.steals.length >= 3 ? '싹쓸이!' : L.steals.length === 2 ? '따닥!' : '짝!', L.player === 0 && mode === 'cpu' ? 'good' : 'bad'); setTimeout(sfx.steal, 90); buzz(40); }
    if (L.gained.length) { toast(L.gained.map(function (k) { return LABEL[k]; }).join(' · '), 'gold'); setTimeout(sfx.yaku, 200); }
    if (L.lost.length) toast(names[1 - L.player] + ' ' + L.lost.map(function (k) { return LABEL[k].replace('!', ''); }).join('·') + ' 깨짐', 'bad');
    if (L.go) { toast(names[L.player] + ' ' + L.go + '고!', 'gold'); sfx.go(); }
  }, [toast, mode]);

  const commit = useCallback(function (res) {
    if (!res.ok) { toast(REASON_TEXT[res.reason] || '둘 수 없어요', 'bad'); return; }
    announce(res.state);
    setSt(res.state);
    setSel(null);
    if (mode === 'local' && res.state.status === 'playing' && !res.state.pending && res.state.turn !== (st.pending ? st.pending.player : st.turn)) setCover(true);
  }, [announce, toast, mode, st]);

  // 컴퓨터 차례
  useEffect(function () {
    if (!st || mode !== 'cpu' || st.status !== 'playing') return;
    if (st.pending && st.pending.player === 1) {
      const t = setTimeout(function () {
        const go = chooseGo(st, 1, props.level);
        if (!go) { sfx.stop(); toast('훈장님 스톱!', 'bad'); }
        commit(decide(st, 1, go ? 'go' : 'stop'));
      }, 1100);
      return function () { clearTimeout(t); };
    }
    if (st.pending || st.turn !== 1) return;
    const t = setTimeout(function () {
      const sh = shakeable(st, 1);
      if (sh.length && props.level !== 'easy') { commit(shake(st, 1, sh[0])); return; }
      const mv = chooseMove(st, 1, props.level);
      if (mv) commit(playCard(st, 1, mv.id, mv.cell));
    }, 900);
    return function () { clearTimeout(t); };
  }, [st, mode, props.level, commit, toast]);

  // 끝나면 장부에 적기
  useEffect(function () {
    if (!st || st.status !== 'ended' || settled.current) return;
    settled.current = true;
    if (mode === 'cpu') {
      props.onSettle(st.result);
      if (st.result.winner === 0) sfx.win(); else if (st.result.winner === 1) sfx.lose();
    } else sfx.win();
  }, [st]);

  const hint = useMemo(function () {
    if (!hintOn || !st || st.status !== 'playing' || st.pending || st.turn !== me || (mode === 'cpu' && me !== 0)) return null;
    return chooseMove(st, me, 'hard', function () { return 0.5; });
  }, [hintOn, st, me, mode]);

  if (!st) return html`<${PickFirst} skin=${ledger.back} oppName=${names[1]} onDone=${function (first) { settled.current = false; setSt(newGame({ first: first })); }} />`;

  const canPlay = st.status === 'playing' && !st.pending && !cover && (mode === 'local' || st.turn === 0);
  const myScore = scoreOf(st, me), oppScore = scoreOf(st, opp);
  const onCell = function (i) {
    if (!canPlay || sel == null) return;
    commit(playCard(st, me, sel, i));
  };
  const shakes = canPlay ? shakeable(st, me) : [];
  const status = st.status === 'ended' ? '판이 끝났어요'
    : st.pending ? (mode === 'cpu' && st.pending.player === 1 ? '훈장님이 고/스톱을 고르는 중…' : '고? 스톱?')
    : mode === 'cpu' && st.turn === 1 ? '훈장님이 생각 중…'
    : sel == null ? (st.plays === 0 ? '아래 패를 눌러 고른 뒤 가운데에 내세요' : '낼 패를 눌러 고르세요') : '빛나는 칸에 내세요 · "짝" 칸은 상대 패를 뺏어요';
  const myHand = st.hands[me];
  const fly = drawFly(st, me);

  return html`<section class=${'game felt-' + ledger.felt}>
    <header class="topbar">
      <button class="icon-btn" onClick=${props.onExit} aria-label="나가기">‹</button>
      <div class="tb-mid"><b>${mode === 'cpu' ? '훈장님(' + LEVEL_KO[props.level] + ')과 한 판' : '둘이서 한 화면'}</b>
        ${mode === 'cpu' ? html`<small>점당 ${won(ledger.stake)}${ledger.carry > 1 ? ' · 나가리 ×' + ledger.carry : ''}</small>` : null}</div>
      <div class="tb-right">
        <button class="pill" onClick=${function () { setHelp(true); }} aria-label="규칙 도움말">?</button>
        <button class=${'pill' + (hintOn ? ' on' : '')} onClick=${function () { setHintOn(!hintOn); }} aria-pressed=${hintOn} title="뭘 낼지 알려 줘요">훈수</button>
      </div>
    </header>
    <${Seat} seat=${opp} top=${true} name=${names[opp]} char=${chars[opp]} mood=${face.moods[opp]} say=${face.says[opp]} score=${oppScore} go=${st.go[opp]} shakes=${st.shaken[opp].length}
      active=${st.turn === opp && st.status === 'playing'} fan=${st.hands[opp].length} skin=${ledger.back} />
    <${Board} st=${st} sel=${sel} me=${me} canPlay=${canPlay} onCell=${onCell} hint=${hint} />
    <${Rail} deck=${st.deck.length} skin=${ledger.back} flyKey=${fly.key} flyTo=${fly.to} status=${status} cue=${canPlay && sel == null} />
    <${Seat} seat=${me} name=${names[me]} char=${chars[me]} mood=${face.moods[me]} say=${face.says[me]} score=${myScore} go=${st.go[me]} shakes=${st.shaken[me].length} active=${st.turn === me && st.status === 'playing'} />
    ${shakes.length ? html`<div class="shake-row">${shakes.map(function (m) {
      return html`<button key=${m} class="btn small gold" onClick=${function () { commit(shake(st, me, m)); }}>${m}월 ${monthName(m)} 흔들기 (이기면 ×2)</button>`;
    })}</div>` : null}
    <${Hand} cards=${myHand} sel=${sel} onPick=${setSel} canPlay=${canPlay} hint=${hint} hidden=${cover} skin=${ledger.back} nudge=${canPlay && sel == null && st.plays < 4} />
    <${Toasts} items=${toasts} />

    ${help ? html`<${QuickHelp} onClose=${function () { setHelp(false); }} onTutorial=${props.onTutorial} />` : null}

    ${cover ? html`<${Modal} label="차례 넘기기" cls="cover"><h2>${names[st.turn]} 차례</h2><p class="lead">상대에게 화면이 안 보이게 넘긴 뒤 누르세요.</p>
      <button class="btn primary big cta" onClick=${function () { setCover(false); }}>내 패 보기</button><//>` : null}

    ${st.pending && (mode === 'local' || st.pending.player === 0) ? html`<${Modal} label="고 스톱" cls="gostop">
      <div class="gs-face"><${Avatar} char=${chars[st.pending.player]} mood="think" size="lg" /></div>
      <p class="big">${st.pending.score}점</p><p class="lead">${st.go[st.pending.player] ? '점수가 또 났어요. 더 갈까요?' : '났어요! 더 갈까요, 멈출까요?'}</p>
      <p class="fine">고: 1·2고는 +1점씩, 3고부터 두 배. 대신 상대가 먼저 나서 스톱하면 고박(두 배로 물어요).<br/>상대 지금 ${scoreOf(st, 1 - st.pending.player).total}점 · 남은 패 ${st.deck.length}장</p>
      <div class="row"><button class="btn go" onClick=${function () { commit(decide(st, st.pending.player, 'go')); }}>고!</button>
        <button class="btn stop" onClick=${function () { sfx.stop(); commit(decide(st, st.pending.player, 'stop')); }}>스톱</button></div>
    <//>` : null}

    ${st.status === 'ended' ? html`<${Result} st=${st} names=${names} chars=${chars} mode=${mode} ledger=${ledger} onAgain=${function () { settled.current = false; setSt(null); }} onExit=${props.onExit} />` : null}
  </section>`;
}

function Result(props) {
  const r = props.st.result, names = props.names, L = props.ledger;
  const iWon = r.winner === 0;
  const title = r.winner == null ? '나가리' : props.mode === 'cpu' ? (iWon ? '이겼다!' : '졌다…') : names[r.winner] + ' 승리';
  return html`<${Modal} label="결과" cls=${'result ' + (r.winner == null ? 'draw' : iWon || props.mode !== 'cpu' ? 'win' : 'lose')}>
    <div class="res-faces">
      <${Avatar} char=${props.chars[0]} mood=${r.winner == null ? 'shock' : r.winner === 0 ? 'cheer' : 'sad'} size="lg" />
      <span class="vs">vs</span>
      <${Avatar} char=${props.chars[1]} mood=${r.winner == null ? 'shock' : r.winner === 1 ? 'cheer' : 'sad'} size="lg" seat=${1} />
    </div>
    <h2>${title}</h2>
    ${r.winner == null ? html`<p class="lead">아무도 ${GOAL}점을 못 냈어요(${r.scores[0]} : ${r.scores[1]}).${props.mode === 'cpu' ? ' 다음 판 판돈 두 배!' : ''}</p>` : html`
      <p class="lead">${r.reason === 'stop' ? names[r.winner] + ' 스톱' : '패를 다 써서 점수로 정산'}</p>
      <ul class="items">${r.items.map(function (it) { return html`<li key=${it.key}><span>${it.label}${it.count > 1 ? '×' + it.count : ''}</span><b>${it.pts}점</b></li>`; })}</ul>
      <ul class="calc">${r.lines.slice(1).map(function (l, k) { return html`<li key=${k}><span>${l.label}</span><b>${l.value}</b></li>`; })}</ul>
      <p class="final">${r.final}점</p>
      ${props.mode === 'cpu' ? html`<p class=${'money ' + (L.lastDelta >= 0 ? 'plus' : 'minus')}>${L.lastDelta >= 0 ? '+' : ''}${won(L.lastDelta || 0)} · 지갑 ${won(L.money)}</p>
        ${L.bailout ? html`<p class="fine">빈털터리가 돼서 3,000원 지원금이 들어왔어요.</p>` : null}` : null}`}
    <div class="row"><button class="btn primary cta" onClick=${props.onAgain}>한 판 더</button><button class="btn" onClick=${props.onExit}>처음으로</button></div>
  <//>`;
}

// ---------- 상점 ----------
function Shop(props) {
  const L = props.ledger;
  return html`<section class="page">
    <header class="topbar"><button class="icon-btn" onClick=${props.onExit} aria-label="뒤로">‹</button><div class="tb-mid"><b>상점</b><small>지갑 ${won(L.money)}</small></div><span class="tb-right"></span></header>
    <div class="shop">${SHOP.map(function (it) {
      const own = L.owned.indexOf(it.id) >= 0;
      const using = (it.kind === 'back' && L.back === it.value) || (it.kind === 'avatar' && L.avatar === it.value) || (it.kind === 'felt' && L.felt === it.value);
      return html`<div key=${it.id} class=${'item' + (own ? ' own' : ' locked')}>
        <div class="thumb">${it.kind === 'back' ? html`<${CardBack} skin=${it.value} />` : it.kind === 'avatar' ? html`<${Avatar} char=${charOf(it.value)} mood=${own ? 'happy' : 'idle'} size="lg" />` : html`<div class="felt-swatch night"></div>`}</div>
        <p class="nm">${it.name}</p>
        ${own ? html`<button class=${'btn small' + (using ? ' primary' : '')} onClick=${function () { props.onLedger(equip(L, it)); }}>${using ? '쓰는 중' : '쓰기'}</button>`
          : html`<button class="btn small" disabled=${L.money < it.price} onClick=${function () { sfx.yaku(); props.onLedger(buy(L, it)); }}>${won(it.price)}</button>`}
      </div>`;
    })}</div></section>`;
}

// ---------- 규칙 ----------
function Rules(props) {
  return html`<section class="page">
    <header class="topbar"><button class="icon-btn" onClick=${props.onExit} aria-label="뒤로">‹</button><div class="tb-mid"><b>규칙</b></div><span class="tb-right"></span></header>
    <button class="cta-learn" onClick=${props.onTutorial}><span class="cl-face"><${Avatar} char="grandpa" mood="happy" /></span><span class="cl-txt"><b>읽기보다 해 보기</b><small>훈장님과 1분 따라 하기</small></span><span class="cl-go">시작 ›</span></button>
    <div class="paper rules">
      <h3>한 줄 요약</h3><p>7×7 담요 위에 화투를 한 장씩 내려놓아, <b>판 위에 남은 내 패</b>로 고스톱 족보를 만든다. 오목도 족보다.</p>
      <h3>한 수</h3><ol>
        <li>손패(5장)에서 한 장을 빈 칸에 낸다. 첫 패는 가운데, 그다음부터는 <b>이미 놓인 패 옆(8방향)</b>에만.</li>
        <li><b>짝 뺏기</b>: 옆에 같은 달 상대 패가 있으면 내 것으로 뒤집는다. 둘이면 따닥, 셋 이상이면 싹쓸이.</li>
        <li><b>짝 잠금(結)</b>: 같은 달 내 패끼리 붙으면 둘 다 잠긴다. 잠긴 패는 다시 못 뺏는다.</li>
        <li>더미에서 한 장 뽑고 차례를 넘긴다.</li></ol>
      <h3>족보(판 위 내 패 기준)</h3><ul>
        <li>광 3장 3점(비광 끼면 2점) · 4장 4점 · 5장 15점</li>
        <li>고도리(2·4·8월 새) 5점 · 홍단/청단/초단 각 3점</li>
        <li>띠 5장 1점, 열끗 5장 1점, 피 10장 1점(넘으면 한 장마다 +1, 쌍피는 2장)</li>
        <li><b>오목</b>: 내 패 5칸이 가로·세로·대각선으로 이어지면 줄마다 3점</li>
        <li><b>총통</b>: 한 달 4장을 모두 가지면 2점</li></ul>
      <h3>고 / 스톱</h3><p>${GOAL}점 이상이 되면 고 또는 스톱. 고를 했다면 점수가 더 올라야 다시 고를 고를 수 있다. 1·2고 +1점, 3고부터 ×2, ×4…
        상대가 고를 외친 뒤 내가 스톱하면 <b>고박</b>(×2). 피박(내 피 10장 이상, 상대 6장 미만) ×2, 광박(내 광 점수, 상대 광 0장) ×2.
        패가 다 떨어지면 ${GOAL}점 이상인 높은 쪽이 이기고, 아니면 <b>나가리</b>(다음 판 판돈 두 배).</p>
      <h3>흔들기</h3><p>손에 같은 달이 3장 있으면 흔들 수 있다. 이기면 흔든 횟수마다 ×2.</p>
      <h3>왜 이게 재밌나</h3><p>오목은 "이어 붙이기", 고스톱은 "같은 달 짝짓기"다. 이 판에서는 이어 붙이려고 놓은 패가 상대에게 짝을 내준다. 잠가서 지킬지, 열어 두고 오목을 노릴지가 매 수의 고민이다.</p>
      <h3>${CARD_CREDIT.title}</h3><p class="fine">${CARD_CREDIT.lines.join(' · ')}<br/>출처 <a href=${CARD_CREDIT.source} target="_blank" rel="noopener">Wikimedia Commons · SVG Hwatu</a> ·
        <a href=${CARD_CREDIT.licenseUrl} target="_blank" rel="noopener">${CARD_CREDIT.license}</a>. ${CARD_CREDIT.note}</p>
    </div></section>`;
}

// ---------- 처음 화면 ----------
function Home(props) {
  const L = props.ledger;
  const [level, setLevel] = useState(props.level);
  const [poke, setPoke] = useState(0);
  const learned = tutorialDone();
  const POKE = ['idle', 'happy', 'smug', 'shock', 'cheer', 'think'];
  return html`<section class="home">
    <div class="hero">
      <div class="logo-cards" aria-hidden="true"><span class="lc a"><${CardFace} id=${0} plain=${true} noTitle=${true} /></span><span class="lc b"><${CardFace} id=${28} plain=${true} noTitle=${true} /></span><span class="lc c"><${CardFace} id=${8} plain=${true} noTitle=${true} /></span></div>
      <h1 class="logo">고목<small>GO·MOK</small></h1>
      <p class="tag">오목판 위에서 치는 고스톱</p>
    </div>
    ${learned ? null : html`<button class="cta-learn hot" onClick=${props.onTutorial}>
      <span class="cl-face"><${Avatar} char="grandpa" mood="happy" /></span>
      <span class="cl-txt"><b>처음이세요? 1분 배우기</b><small>훈장님이 한 수씩 짚어 드려요</small></span><span class="cl-go">시작 ›</span></button>`}
    <div class="wallet"><button class="wallet-av" onClick=${function () { setPoke(poke + 1); }} aria-label="내 캐릭터 표정 바꾸기"><${Avatar} char=${charOf(L.avatar)} mood=${POKE[poke % POKE.length]} size="lg" /></button>
      <div><b>${won(L.money)}</b><small>${L.played}판 ${L.wins}승 ${L.losses}패 ${L.nagari}나가리</small></div></div>
    <div class="menu">
      <div class="seg" role="radiogroup" aria-label="컴퓨터 실력">${['easy', 'normal', 'hard'].map(function (k) {
        return html`<button key=${k} role="radio" aria-checked=${level === k} class=${level === k ? 'on' : ''} onClick=${function () { setLevel(k); }}>${LEVEL_KO[k]}</button>`;
      })}</div>
      <div class="seg stake" role="radiogroup" aria-label="점당 판돈">${STAKES.map(function (s) {
        return html`<button key=${s} role="radio" aria-checked=${L.stake === s} class=${L.stake === s ? 'on' : ''} disabled=${s * 20 > L.money}
          onClick=${function () { props.onLedger(Object.assign({}, L, { stake: s })); }}>${s >= 1000 ? s / 1000 + '천' : s}</button>`;
      })}</div>
      <button class=${'btn primary big' + (learned ? ' cta' : '')} onClick=${function () { props.onPlay('cpu', level); }}>훈장님과 한 판</button>
      <button class="btn big" onClick=${function () { props.onPlay('local', level); }}>둘이서 한 화면</button>
      <button class="btn big ghost" onClick=${function () { props.go('online'); }}>친구와 링크로</button>
      <nav class="sub"><button onClick=${props.onTutorial}>배우기</button><button onClick=${function () { props.go('rules'); }}>규칙</button><button onClick=${function () { props.go('shop'); }}>상점</button>
        <button onClick=${props.onMute}>${props.muted ? '소리 켜기' : '소리 끄기'}</button></nav>
    </div>
  </section>`;
}

export function App() {
  const [ledger, setLedger] = useState(loadLedger);
  const [screen, setScreen] = useState(function () { return /[?&#]r=/.test(location.search + location.hash) ? 'online' : 'home'; });
  const [mode, setMode] = useState('cpu');
  const [level, setLevel] = useState('normal');
  const [muted, setMuted] = useState(function () { try { return localStorage.getItem('gomok.muted') === '1'; } catch (e) { return false; } });
  const [gameKey, setGameKey] = useState(0);
  useEffect(ensureFelt, []);
  useEffect(warmCards, []);
  useEffect(function () { sound.muted = muted; try { localStorage.setItem('gomok.muted', muted ? '1' : '0'); } catch (e) { /* 없음 */ } }, [muted]);
  const upd = function (l) { setLedger(l); saveLedger(l); };
  const exit = function () { setScreen('home'); };
  const play = function (m, lv) { setMode(m); setLevel(lv); setGameKey(gameKey + 1); setScreen('game'); };
  const tut = function () { setScreen('tutorial'); };
  let body;
  if (screen === 'game') body = html`<${Game} key=${gameKey} mode=${mode} level=${level} ledger=${ledger} onExit=${exit} onTutorial=${tut}
    onSettle=${function (r) { setLedger(function (l) { const n = settleLedger(l, r, 0); saveLedger(n); return n; }); }} />`;
  else if (screen === 'tutorial') body = html`<${Tutorial} ledger=${ledger} onExit=${exit} onPlay=${play} />`;
  else if (screen === 'shop') body = html`<${Shop} ledger=${ledger} onLedger=${upd} onExit=${exit} />`;
  else if (screen === 'rules') body = html`<${Rules} onExit=${exit} onTutorial=${tut} />`;
  else if (screen === 'online') body = html`<${Online} onExit=${exit} />`;
  else body = html`<${Home} ledger=${ledger} level=${level} muted=${muted} onMute=${function () { setMuted(!muted); }} onLedger=${upd} go=${setScreen} onTutorial=${tut} onPlay=${play} />`;
  return html`<${React.Fragment}><${CardDefs} />${body}<//>`;
}
