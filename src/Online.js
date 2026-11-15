/**
 * 친구와 링크로: Apps Script 서버(server/Api.gs)에 붙는 온라인 방.
 * 판 정본은 서버. 화면은 받은 판(엔진 모양, 숨긴 패는 -1)을 같은 부품으로 그린다.
 */
import { html, React } from './h.js';
import { scoreOf, shakeable, REASON_TEXT } from './engine.js';
import { sfx, buzz } from './fx.js';
import { createApi, serverUrl } from './net.js';
import { Board, Seat, Hand, Toasts, Modal } from './App.js';

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const LABEL_KO = { gwang: '광', godori: '고도리!', hong: '홍단!', cheong: '청단!', cho: '초단!', omok: '오목!', chong: '총통!', tti: '띠', yeol: '열끗', pi: '피' };
export function roomFromUrl() { const m = /[?&#]r=([A-Za-z0-9_-]{6,40})/.exec(location.search + location.hash); return m ? m[1] : null; }
const tokenKey = function (r) { return 'gomok.room.' + r; };
const getToken = function (r) { try { return localStorage.getItem(tokenKey(r)); } catch (e) { return null; } };

export function Online(props) {
  const url = serverUrl();
  const api = useMemo(function () { return url ? createApi(url) : null; }, [url]);
  const [name, setName] = useState(function () { try { return localStorage.getItem('gomok.name') || ''; } catch (e) { return ''; } });
  const [room, setRoom] = useState(roomFromUrl);
  const [view, setView] = useState(null);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [toasts, setToasts] = useState([]);
  const lastPlays = useRef(-1), viewRef = useRef(null), stopRef = useRef(false);
  viewRef.current = view;

  const toast = function (text, tone) {
    const id = Math.random();
    setToasts(function (t) { return t.concat([{ id: id, text: text, tone: tone }]).slice(-3); });
    setTimeout(function () { setToasts(function (t) { return t.filter(function (x) { return x.id !== id; }); }); }, 1700);
  };

  const accept = useCallback(function (d) {
    if (!d || !d.room || d.same) return;
    if (d.token) try { localStorage.setItem(tokenKey(d.room), d.token); } catch (e) { /* 없음 */ }
    const g = d.game;
    if (g && g.last && g.plays !== lastPlays.current && lastPlays.current >= 0) {
      const L = g.last, mine = L.player === d.seat;
      if (L.shake) { toast((mine ? '내' : '상대') + ' 흔들기! ' + L.shake + '월', 'gold'); sfx.go(); }
      else {
        sfx.slap();
        if (L.steals.length) { toast(L.steals.length >= 3 ? '싹쓸이!' : L.steals.length === 2 ? '따닥!' : '짝!', mine ? 'good' : 'bad'); setTimeout(sfx.steal, 90); if (!mine) buzz([60, 40, 60]); }
        if (L.gained.length) { toast(L.gained.map(function (k) { return LABEL_KO[k]; }).join(' · '), 'gold'); setTimeout(sfx.yaku, 200); }
        if (L.go) { toast((mine ? '내가 ' : '상대 ') + L.go + '고!', 'gold'); sfx.go(); }
      }
      if (g.status === 'ended') { if (g.result.winner === d.seat) sfx.win(); else if (g.result.winner != null) sfx.lose(); }
    }
    if (g) lastPlays.current = g.plays;
    setView(d);
  }, []);

  // 방 주소가 있으면 들어가기(저장해 둔 토큰이 있으면 같은 자리로)
  useEffect(function () {
    if (!api || !room || view) return;
    api.call('join', { room: room, token: getToken(room), name: name || '손님' }, { rid: true }).then(function (d) {
      if (!d.ok) { setMsg(d.error === 'no_room' ? '없거나 끝난 방이에요' : '들어가지 못했어요(' + d.error + ')'); return; }
      try { history.replaceState(null, '', '?r=' + d.room); } catch (e) { /* 없음 */ }
      accept(d);
    }, function (e) { setMsg('서버에 닿지 않아요(' + e.code + ')'); });
  }, [api, room]);

  // 롱폴링: 상대 차례·대기 중엔 서버가 붙잡고(최대 4초), 내 차례엔 3초마다
  useEffect(function () {
    if (!api || !view) return;
    stopRef.current = false;
    let t = null;
    const loop = function () {
      const v = viewRef.current; if (!v || stopRef.current) return;
      const g = v.game, myTurn = !!g && g.status === 'playing' && ((g.pending && g.pending.player === v.seat) || (!g.pending && g.turn === v.seat));
      api.call('poll', { room: v.room, token: getToken(v.room), v: v.v, wait: myTurn ? 0 : 4000 }, { tries: 2 }).then(function (d) {
        if (d.ok && !d.same) accept(d);
        t = setTimeout(loop, myTurn ? 3000 : d.same ? 400 : 300);
      }, function () { t = setTimeout(loop, 4000); });
    };
    t = setTimeout(loop, 300);
    return function () { stopRef.current = true; clearTimeout(t); };
  }, [api, view && view.room]);

  const send = function (action, params) {
    if (busy) return;
    setBusy(true);
    api.call(action, Object.assign({ room: view.room, token: getToken(view.room), v: view.v }, params), { rid: true }).then(function (d) {
      setBusy(false); setSel(null);
      if (!d.ok) toast(REASON_TEXT[d.error] || (d.error === 'stale' ? '판이 바뀌었어요. 다시 골라요' : '안 돼요(' + d.error + ')'), 'bad');
      if (d.room) accept(d);
    }, function (e) { setBusy(false); toast('연결이 불안해요(' + e.code + ')', 'bad'); });
  };

  const create = function () {
    try { localStorage.setItem('gomok.name', name); } catch (e) { /* 없음 */ }
    setBusy(true);
    api.call('createRoom', { name: name || '손님' }, { rid: true }).then(function (d) {
      setBusy(false);
      if (!d.ok) { setMsg('방을 못 만들었어요(' + d.error + ')'); return; }
      try { history.replaceState(null, '', '?r=' + d.room); } catch (e) { /* 없음 */ }
      setRoom(d.room); accept(d);
    }, function (e) { setBusy(false); setMsg('서버에 닿지 않아요(' + e.code + ')'); });
  };

  const link = view ? location.origin + location.pathname + '?r=' + view.room : '';
  const share = function () {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: '고목 한 판?', text: '오목판 위에서 고스톱 한 판 쳐요. 링크 누르면 바로 같은 판.', url: link }).catch(function () { }); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('링크를 복사했어요', 'good'); }, function () { prompt('이 링크를 보내세요', link); });
  };
  const exit = function () { stopRef.current = true; try { history.replaceState(null, '', location.pathname); } catch (e) { /* 없음 */ } props.onExit(); };
  const header = html`<header class="topbar"><button class="icon-btn" onClick=${exit} aria-label="뒤로">‹</button><div class="tb-mid"><b>친구와 링크로</b>${view ? html`<small>방 ${view.room}</small>` : null}</div><span></span></header>`;

  if (!url) return html`<section class="page">${header}<div class="paper">
    <h3>아직 서버가 연결되지 않았어요</h3>
    <p>온라인 방은 <b>Google Apps Script 웹 앱 + Google 시트</b>로 돌아가요. 시트가 판을 적어 두는 숨은 칸이고, Apps Script가 브라우저와 같은 규칙 파일로 수를 검사해요.</p>
    <ol><li><code>server/</code>의 Rules.gs · Api.gs · appsscript.json을 시트에 붙은 Apps Script 프로젝트에 넣기</li><li><code>setup()</code> 한 번 실행 → 웹 앱으로 배포(실행: 나, 액세스: 모든 사용자)</li><li><code>config.js</code>의 <code>api</code>에 /exec 주소 넣기</li></ol></div></section>`;

  if (!view) return html`<section class="page">${header}<div class="paper lobby">
    ${room ? html`<p>방 <b>${room}</b>에 들어가는 중…</p>` : html`
      <label>내 이름<input value=${name} maxLength="12" placeholder="손님" onInput=${function (e) { setName(e.target.value); }} /></label>
      <button class="btn primary big" disabled=${busy} onClick=${create}>방 만들고 링크 받기</button>`}
    ${msg ? html`<p class="bad-msg">${msg}</p>` : null}</div><${Toasts} items=${toasts} /></section>`;

  const g = view.game, seat = view.seat, spectator = seat < 0;
  if (!g) return html`<section class="page">${header}<div class="paper lobby">
    <h3>친구를 기다리는 중</h3><p>이 링크를 보내면 누르는 순간 같은 판에서 만나요.</p>
    <p class="linkbox"><code>${link}</code></p><button class="btn primary big" onClick=${share}>링크 보내기</button></div><${Toasts} items=${toasts} /></section>`;

  const me = spectator ? 0 : seat, opp = 1 - me;
  const myTurn = !spectator && g.status === 'playing' && !g.pending && g.turn === me;
  const canPlay = myTurn && !busy;
  const nm = function (s) { return view.names[s] || '손님'; };
  const shakes = canPlay ? shakeable(g, me) : [];
  const status = spectator ? '구경 중' : g.status === 'ended' ? '판이 끝났어요'
    : g.pending ? (g.pending.player === me ? '고? 스톱?' : nm(opp) + ' 님이 고/스톱을 고르는 중…')
    : myTurn ? (sel == null ? '낼 패를 고르세요' : '빛나는 칸에 내세요') : nm(opp) + ' 님 차례 · 기다리는 중…';
  const r = g.result;
  return html`<section class="game">
    ${header}
    <${Seat} seat=${opp} top=${true} name=${nm(opp)} avatar=${opp === 0 ? '甲' : '乙'} score=${scoreOf(g, opp)} go=${g.go[opp]} shakes=${g.shaken[opp].length} active=${g.turn === opp && g.status === 'playing'} extra=${'손패 ' + g.hands[opp].length + ' · 더미 ' + g.deck.length} />
    <${Board} st=${g} sel=${sel} me=${me} canPlay=${canPlay} onCell=${function (i) { if (canPlay && sel != null) send('play', { cardId: sel, cell: i }); }} />
    <${Seat} seat=${me} name=${spectator ? nm(0) : nm(me) + ' (나)'} avatar=${me === 0 ? '甲' : '乙'} score=${scoreOf(g, me)} go=${g.go[me]} shakes=${g.shaken[me].length} active=${g.turn === me && g.status === 'playing'} />
    <p class="status" role="status">${status}</p>
    ${shakes.length ? html`<div class="shake-row">${shakes.map(function (m) { return html`<button key=${m} class="btn small gold" onClick=${function () { send('shake', { month: m }); }}>${m}월 흔들기 (이기면 ×2)</button>`; })}</div>` : null}
    <${Hand} cards=${g.hands[me]} sel=${sel} onPick=${setSel} canPlay=${canPlay} hidden=${spectator} />
    <${Toasts} items=${toasts} />
    ${g.pending && g.pending.player === me && !spectator ? html`<${Modal} label="고 스톱" cls="gostop">
      <p class="big">${g.pending.score}점</p><p class="lead">더 갈까요, 멈출까요?</p>
      <p class="fine">상대 지금 ${scoreOf(g, opp).total}점 · 남은 패 ${g.deck.length}장</p>
      <div class="row"><button class="btn go" disabled=${busy} onClick=${function () { send('decide', { choice: 'go' }); }}>고!</button>
        <button class="btn stop" disabled=${busy} onClick=${function () { sfx.stop(); send('decide', { choice: 'stop' }); }}>스톱</button></div><//>` : null}
    ${g.status === 'ended' ? html`<${Modal} label="결과" cls=${'result ' + (r.winner === me ? 'win' : 'lose')}>
      <h2>${r.winner == null ? '나가리' : r.winner === me && !spectator ? '이겼다!' : nm(r.winner) + ' 승리'}</h2>
      ${r.winner != null ? html`<ul class="calc">${r.lines.map(function (l, k) { return html`<li key=${k}><span>${l.label}</span><b>${l.value}</b></li>`; })}</ul><p class="final">${r.final}점</p>` : null}
      ${!spectator ? html`<div class="row"><button class="btn primary" disabled=${view.rematch[me]} onClick=${function () { send('rematch', {}); }}>${view.rematch[me] ? '상대를 기다리는 중' : view.rematch[opp] ? '상대가 한 판 더! 받기' : '한 판 더'}</button><button class="btn" onClick=${exit}>나가기</button></div>` : null}
    <//>` : null}
  </section>`;
}
