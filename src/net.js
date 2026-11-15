/**
 * Apps Script 서버 호출(온라인 방).
 *  - JSON을 text/plain 으로 POST 해서 CORS 사전 요청을 피한다.
 *  - 한 번 시도 8초. 시간 초과·HTML 오류 화면·모양이 틀린 JSON이면 같은 rid로 다시 보낸다(서버가 rid를 한 번만 반영).
 *  - 상대 차례에는 서버가 판이 바뀔 때까지 최대 4초 붙잡는 롱폴링.
 */
const TIMEOUT = 8000, TRIES = 3, BACKOFF = [500, 1500, 3000];

export function newId(n) {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', r = crypto.getRandomValues(new Uint8Array(n || 20));
  let s = ''; for (let i = 0; i < r.length; i++) s += a[r[i] % a.length]; return s;
}
const delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

export function createApi(url) {
  async function attempt(body) {
    const ctrl = new AbortController(), t = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, signal: ctrl.signal, redirect: 'follow', cache: 'no-store', credentials: 'omit' });
      const text = await res.text();
      let d; try { d = JSON.parse(text); } catch (e) { return { retry: 'not_json' }; }
      if (!d || typeof d.ok !== 'boolean') return { retry: 'bad_shape' };
      if (!d.ok && (d.error === 'busy' || d.error === 'server_error')) return { retry: d.error, data: d };
      return { data: d };
    } catch (e) { return { retry: e.name === 'AbortError' ? 'timeout' : 'network' }; }
    finally { clearTimeout(t); }
  }
  async function call(action, params, opt) {
    const o = opt || {};
    const body = JSON.stringify(Object.assign({ action: action }, params, o.rid ? { rid: newId(20) } : {}));
    let last = null;
    for (let n = 0; n < (o.tries || TRIES); n++) {
      const r = await attempt(body);
      if (!r.retry) return r.data;
      last = r;
      await delay(BACKOFF[Math.min(n, BACKOFF.length - 1)]);
    }
    if (last && last.data) return last.data;
    const e = new Error(last ? last.retry : 'network'); e.code = e.message; throw e;
  }
  return { call: call };
}

export function serverUrl() {
  const c = (typeof window !== 'undefined' && window.GOMOK_CONFIG) || {};
  return c.api || '';
}
