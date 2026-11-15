/**
 * 화면 효과: 군용 담요 질감(캔버스로 생성, 외부 텍스처 파일 없음)과 Web Audio 효과음(오디오 파일 없음).
 */
let feltDone = false;
export function ensureFelt() {
  if (feltDone || typeof document === 'undefined') return;
  feltDone = true;
  const size = 512, c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#2d5a3a'; x.fillRect(0, 0, size, size);
  const img = x.getImageData(0, 0, size, size), d = img.data;
  let s = 13;
  const rnd = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 34, fiber = ((i / 4) % size) % 3 === 0 ? 5 : 0;
    d[i] = Math.max(0, d[i] + n * 0.6); d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n + fiber)); d[i + 2] = Math.max(0, d[i + 2] + n * 0.7);
  }
  x.putImageData(img, 0, 0);
  for (let k = 0; k < 900; k++) {
    x.strokeStyle = 'rgba(' + (rnd() < 0.5 ? '18,40,26' : '84,128,92') + ',' + (0.05 + rnd() * 0.12) + ')';
    x.lineWidth = 0.6;
    const px = rnd() * size, py = rnd() * size, a = rnd() * 6.28, l = 3 + rnd() * 7;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const st = document.createElement('style');
  st.textContent = ':root{--felt:url(' + c.toDataURL('image/jpeg', 0.85) + ')}';
  document.head.appendChild(st);
}

let AC = null;
export const sound = { muted: false };
function ctx() {
  if (sound.muted) return null;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; }
  return AC;
}
function noiseHit(freq, dur, gain) {
  const a = ctx(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
function tone(freqs, dur, type) {
  const a = ctx(); if (!a) return;
  freqs.forEach(function (fq, i) {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * dur * 0.8;
    o.type = type || 'triangle'; o.frequency.value = fq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  });
}
export const sfx = {
  slap: function () { noiseHit(1800, 0.09, 0.9); },          // 패 내리치는 "탁"
  steal: function () { noiseHit(3200, 0.06, 0.6); setTimeout(function () { noiseHit(2600, 0.06, 0.5); }, 70); },
  yaku: function () { tone([523, 659, 784], 0.14); },
  go: function () { tone([392, 523, 659, 880], 0.12, 'square'); },
  stop: function () { tone([659, 440], 0.2, 'sawtooth'); },
  win: function () { tone([523, 659, 784, 1047], 0.18); },
  lose: function () { tone([392, 330, 262], 0.24); },
  tick: function () { noiseHit(5000, 0.02, 0.25); }
};
export function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 진동 없음 */ } }
