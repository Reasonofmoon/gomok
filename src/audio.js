/**
 * 소리 엔진(Web Audio).
 * - 효과음·목소리는 assets/sfx/*.mp3 (ElevenLabs로 만든 샘플). 첫 터치 뒤에 받아서 풀어 둔다.
 * - 입체감: 패를 놓은 칸의 열에 따라 좌우(StereoPanner), 앞줄일수록 크게. 상대(훈장님) 목소리는 살짝 멀리(잔향 더).
 * - 배경 음악은 목소리가 나올 때 잠깐 줄인다(더킹).
 * - 설정: 효과음 / 목소리 / 배경 음악을 따로 켜고 끈다(localStorage 'gomok.audio').
 */
const BASE = 'assets/sfx/';
const SFX_NAMES = ['slap1', 'slap2', 'slap3', 'flip', 'draw', 'lock', 'steal', 'ssak', 'yaku', 'gwang', 'omok', 'go', 'stop', 'shake', 'bak', 'win', 'lose', 'nagari', 'deal', 'tick', 'chime'];
export const VOICE_KEYS = ['jjak', 'ttadak', 'ssak', 'lock', 'samgwang', 'bisamgwang', 'sagwang', 'ogwang', 'godori', 'hongdan', 'cheongdan', 'chodan', 'omok', 'chongtong', 'tti', 'yeol', 'pi',
  'go1', 'go2', 'go3', 'go4', 'go5', 'stop', 'shake', 'broken', 'ouch', 'pibak', 'gwangbak', 'gobak', 'nagari', 'win', 'lose'];
const O_ONLY = ['start', 'think'];

const KEY = 'gomok.audio';
function loadPrefs() {
  const d = { sfx: true, voice: true, music: true, vol: 0.9 };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return d; }
}
export const prefs = loadPrefs();
export function setPrefs(p) {
  Object.assign(prefs, p);
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* 없음 */ }
  if (master) master.gain.value = prefs.vol;
  if (musicGain) musicGain.gain.value = prefs.music && !globalMute ? MUSIC_LEVEL : 0;
  if (prefs.music && !globalMute) startMusic(); else stopMusic();
}

let ctx = null, master = null, comp = null, verbIn = null, musicGain = null, musicSrc = null;
let globalMute = false;
const MUSIC_LEVEL = 0.16;
const buffers = {}, pending = {};
// 확인용 계수(개발 도구에서 window.__gomokAudio 로 본다)
const stats = { sfx: 0, voice: 0, last: [] };
if (typeof window !== 'undefined') window.__gomokAudio = { stats: stats, state: function () { return ctx ? ctx.state : 'none'; }, loaded: function () { return Object.keys(buffers).length; } };

export function setMuted(m) { globalMute = m; if (master) master.gain.value = m ? 0 : prefs.vol; if (m) stopMusic(); else if (prefs.music) startMusic(); }
export function audioCtx() { return ctx; }

function impulse(c, sec, decay) {
  const len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = globalMute ? 0 : prefs.vol;
  master.connect(comp); comp.connect(ctx.destination);
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 1.6, 3.2);
  verbIn = ctx.createGain(); verbIn.gain.value = 1; const wet = ctx.createGain(); wet.gain.value = 0.32;
  verbIn.connect(conv); conv.connect(wet); wet.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
  return ctx;
}

function load(path) {
  if (buffers[path]) return Promise.resolve(buffers[path]);
  if (pending[path]) return pending[path];
  const c = ensure(); if (!c) return Promise.reject(new Error('no audio'));
  pending[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function (ab) { return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); }); })
    .then(function (b) { buffers[path] = b; return b; });
  pending[path].catch(function () { delete pending[path]; });
  return pending[path];
}

let warmed = false;
/** 첫 터치 때 부른다: 오디오를 깨우고 샘플을 조용히 받아 둔다. */
export function unlock() {
  const c = ensure(); if (!c) return;
  if (warmed) return; warmed = true;
  const all = SFX_NAMES.map(function (n) { return n + '.mp3'; })
    .concat(VOICE_KEYS.map(function (k) { return 'v/p_' + k + '.mp3'; }), VOICE_KEYS.concat(O_ONLY).map(function (k) { return 'v/o_' + k + '.mp3'; }));
  let i = 0;
  const next = function () { if (i >= all.length) return; const p = all[i++]; load(p).catch(function () { }).then(next); };
  for (let k = 0; k < 4; k++) next();
  if (prefs.music && !globalMute) startMusic();
}

function route(opts) {
  const c = ctx, g = c.createGain(); g.gain.value = opts.gain == null ? 1 : opts.gain;
  let out = g;
  if (c.createStereoPanner && opts.pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); g.connect(p); out = p; }
  out.connect(master);
  if (opts.verb) { const s = c.createGain(); s.gain.value = opts.verb; out.connect(s); s.connect(verbIn); }
  return g;
}

/** 효과음. 샘플이 아직 없으면 false(부른 쪽이 합성음으로 대신한다). */
export function play(name, opts) {
  opts = opts || {};
  if (globalMute || !prefs.sfx) return true;
  const c = ensure(); if (!c) return false;
  const b = buffers[name + '.mp3'];
  if (!b) { load(name + '.mp3').catch(function () { }); return false; }
  const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = opts.rate || (0.96 + Math.random() * 0.08);
  src.connect(route(opts)); src.start(c.currentTime + (opts.delay || 0));
  stats.sfx++; stats.last.push(name); if (stats.last.length > 12) stats.last.shift();
  return true;
}

// 목소리는 겹치지 않게 줄 세운다(최대 2개 대기).
let vq = [], vBusyUntil = 0;
function duck(sec) {
  if (!musicGain || !prefs.music) return;
  const t = ctx.currentTime; musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setTargetAtTime(MUSIC_LEVEL * 0.3, t, 0.05); musicGain.gain.setTargetAtTime(MUSIC_LEVEL, t + sec, 0.4);
}
function pump() {
  if (!vq.length || !ctx) return;
  const now = ctx.currentTime;
  if (now < vBusyUntil - 0.15) { setTimeout(pump, (vBusyUntil - now) * 1000); return; }
  const v = vq.shift(), b = buffers[v.path];
  if (!b) { pump(); return; }
  const src = ctx.createBufferSource(); src.buffer = b;
  src.connect(route({ pan: v.pan, gain: v.gain, verb: v.verb })); src.start();
  vBusyUntil = now + b.duration; duck(b.duration + 0.1);
  stats.voice++; stats.last.push(v.path); if (stats.last.length > 12) stats.last.shift();
  if (vq.length) setTimeout(pump, b.duration * 1000 - 120);
}
/**
 * say('p'|'o', 키, {pan}). p = 나(밝은 목소리), o = 훈장님/상대.
 * 상대 목소리는 왼쪽 위에서 들리는 느낌으로 살짝 왼쪽 + 잔향.
 */
export function say(who, key, opts) {
  opts = opts || {};
  if (globalMute || !prefs.voice) return;
  const c = ensure(); if (!c) return;
  const path = 'v/' + who + '_' + key + '.mp3';
  const item = { path: path, pan: opts.pan != null ? opts.pan : (who === 'o' ? -0.28 : 0.12), gain: opts.gain || 1, verb: who === 'o' ? 0.55 : 0.18 };
  if (vq.length >= 2) vq.shift();
  const go = function () { vq.push(item); pump(); };
  if (buffers[path]) setTimeout(go, opts.delay || 0);
  else load(path).then(function () { setTimeout(go, opts.delay || 0); }, function () { });
}

function startMusic() {
  if (!ctx || musicSrc) return;
  load('bgm.mp3').then(function (b) {
    if (musicSrc || !prefs.music || globalMute) return;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(musicGain); s.start();
    musicSrc = s;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime); musicGain.gain.linearRampToValueAtTime(MUSIC_LEVEL, ctx.currentTime + 2.5);
  }, function () { });
}
function stopMusic() { if (musicSrc) { try { musicSrc.stop(); } catch (e) { /* 없음 */ } musicSrc = null; } }

/** 칸 번호 → 좌우·크기(앞줄이 크게). */
export function cellPos(cell) {
  if (cell == null || cell < 0) return { pan: 0, gain: 1 };
  const x = cell % 7, y = (cell / 7) | 0;
  return { pan: (x - 3) / 3 * 0.75, gain: 0.72 + y / 6 * 0.4 };
}
