/**
 * 화투 그림: 외부 이미지 없이 SVG 도형만으로 그린다.
 * viewBox 0 0 40 60. 월 = 바탕 식물, 종류 = 위에 얹는 표식(光 · 띠 · 동물 글자 · 雙).
 */
import { html } from './h.js';
import { CARD, MONTHS } from './hwatu.js';

const INK = '#1d1a17', RED = '#c3261f', BLUE = '#1f4e9c';

function blossoms(pts, fill, r) {
  return pts.map(function (p, i) {
    return html`<g key=${i}><circle cx=${p[0]} cy=${p[1]} r=${r} fill=${fill} /><circle cx=${p[0]} cy=${p[1]} r=${r * 0.35} fill="#fff4c4" /></g>`;
  });
}
function hangs(x0, color) {
  const out = [];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) out.push(html`<ellipse key=${k + '-' + j} cx=${x0 + k * 6 + (j % 2)} cy=${12 + j * 6} rx="1.6" ry="2.4" fill=${color} />`);
  return out;
}

const MOTIF = {
  1: function () {
    return html`<g><path d="M20 58 L20 30" stroke="#6b3d1c" stroke-width="2.4" />
      <ellipse cx="12" cy="40" rx="10" ry="5" fill="#1f5b3a" /><ellipse cx="28" cy="34" rx="11" ry="5" fill="#1f5b3a" /><ellipse cx="17" cy="27" rx="8" ry="4" fill="#2c7a4d" /></g>`;
  },
  2: function () {
    return html`<g><path d="M4 50 C14 40 18 30 34 22" stroke="#4a2c17" stroke-width="2" fill="none" />${blossoms([[10, 44], [17, 36], [24, 30], [31, 24], [20, 40]], '#d23c5a', 3)}</g>`;
  },
  3: function () {
    return html`<g>${blossoms([[8, 16], [16, 12], [24, 15], [32, 12], [12, 22], [28, 21], [20, 20]], '#f09bb0', 3.4)}</g>`;
  },
  4: function () { return html`<g><path d="M6 8 L34 8" stroke="#3b2a1a" stroke-width="1.4" />${hangs(10, INK)}</g>`; },
  5: function () {
    return html`<g><path d="M10 58 L14 24 M18 58 L20 20 M26 58 L24 26" stroke="#2f6b3c" stroke-width="2" />
      <path d="M12 26 l-4 -5 l6 1 z M20 21 l-3 -6 l6 2 z M25 27 l2 -6 l3 5 z" fill="#5b3fa8" /></g>`;
  },
  6: function () {
    return html`<g><ellipse cx="11" cy="46" rx="7" ry="4" fill="#2f6b3c" /><ellipse cx="30" cy="48" rx="7" ry="4" fill="#2f6b3c" />
      <circle cx="20" cy="36" r="9" fill="#b81d3a" /><circle cx="20" cy="36" r="5.5" fill="#e0475f" /><circle cx="20" cy="36" r="2" fill="#ffd36b" /></g>`;
  },
  7: function () { return html`<g><path d="M6 8 L34 8" stroke="#3b2a1a" stroke-width="1.4" />${hangs(10, '#b8322c')}</g>`; },
  8: function () { return html`<g><path d="M0 46 Q20 30 40 46 L40 60 L0 60 Z" fill=${INK} /></g>`; },
  9: function () {
    const petals = [];
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; petals.push(html`<ellipse key=${k} cx=${20 + Math.cos(a) * 6} cy=${30 + Math.sin(a) * 6} rx="3.4" ry="1.6" transform=${'rotate(' + k * 30 + ' ' + (20 + Math.cos(a) * 6) + ' ' + (30 + Math.sin(a) * 6) + ')'} fill="#e3a72a" />`); }
    return html`<g>${petals}<circle cx="20" cy="30" r="3.4" fill="#b8661c" /></g>`;
  },
  10: function () {
    const leaf = function (x, y, s, k) { return html`<path key=${k} transform=${'translate(' + x + ' ' + y + ') scale(' + s + ')'} d="M0 -6 L1.6 -2 L6 -3 L3 1 L5 5 L0 3 L-5 5 L-3 1 L-6 -3 L-1.6 -2 Z" fill="#d9531e" />`; };
    return html`<g>${leaf(11, 14, 1.1, 1)}${leaf(27, 12, 1, 2)}${leaf(20, 24, 1.2, 3)}${leaf(9, 32, 0.9, 4)}${leaf(30, 30, 1, 5)}</g>`;
  },
  11: function () {
    return html`<g><ellipse cx="13" cy="44" rx="9" ry="6" fill="#3d2a4f" /><ellipse cx="27" cy="46" rx="9" ry="6" fill="#3d2a4f" /><ellipse cx="20" cy="38" rx="8" ry="5" fill="#57406e" /></g>`;
  },
  12: function () {
    return html`<g><path d="M8 4 C12 20 6 32 10 50 M16 4 C20 22 14 34 18 52 M30 4 C26 22 32 34 28 52" stroke="#3f6b2a" stroke-width="1.4" fill="none" />
      <path d="M0 8 L40 8" stroke=${INK} stroke-width="0.6" stroke-dasharray="1 2" /></g>`;
  }
};

function overlay(c) {
  if (c.type === 'gwang') {
    const extra = c.m === 8 ? html`<circle cx="20" cy="26" r="11" fill="#fff6dc" stroke="#e7c97c" stroke-width="1" />`
      : c.m === 12 ? html`<path d="M10 30 Q20 18 30 30 Z" fill=${RED} /><path d="M20 30 L20 44" stroke=${INK} stroke-width="1.4" />`
      : c.m === 1 ? html`<circle cx="30" cy="14" r="5" fill=${RED} />` : null;
    return html`<g>${extra}<circle cx="32" cy="9" r="6" fill=${RED} stroke="#fff" stroke-width="1" /><text x="32" y="11.6" font-size="7.5" text-anchor="middle" fill="#fff" font-weight="800">光</text></g>`;
  }
  if (c.type === 'tti') {
    const fill = c.tti === 'blue' ? BLUE : c.tti === 'plain' ? '#8a3a24' : RED;
    const word = c.tti === 'red' ? '홍단' : c.tti === 'blue' ? '청단' : '';
    return html`<g><g transform="rotate(-8 20 30)"><rect x="5" y="25" width="30" height="9" rx="1.5" fill=${fill} stroke="#fff" stroke-width=".8" />
      ${word ? html`<text x="20" y="32" font-size="6" text-anchor="middle" fill="#fff" font-weight="700">${word}</text>` : null}</g></g>`;
  }
  if (c.type === 'yeol') {
    return html`<g><circle cx="20" cy="30" r="8" fill=${c.bird ? '#f5d35b' : '#f3e3b5'} stroke=${INK} stroke-width="1" />
      <text x="20" y="33.4" font-size="9" text-anchor="middle" fill=${INK} font-weight="800">${c.glyph}</text></g>`;
  }
  if (c.pi === 2) return html`<g><rect x="25" y="47" width="12" height="9" rx="2" fill=${INK} /><text x="31" y="54" font-size="6" text-anchor="middle" fill="#f6e7c1" font-weight="800">雙</text></g>`;
  return null;
}

export function CardFace(props) {
  const c = CARD[props.id];
  return html`<svg class="card-svg" viewBox="0 0 40 60" role="img" aria-label=${c.label}>
    <rect x=".6" y=".6" width="38.8" height="58.8" rx="3.2" fill="#fbf3df" stroke="#a8221a" stroke-width="1.2" />
    <rect x="2.6" y="2.6" width="34.8" height="54.8" rx="2" fill="none" stroke="#e9d6ab" stroke-width=".6" />
    ${MOTIF[c.m]()}
    ${overlay(c)}
    <g><rect x="2" y="2" width=${c.m >= 10 ? 13 : 9} height="9" rx="2" fill=${INK} opacity=".88" />
      <text x=${c.m >= 10 ? 8.5 : 6.5} y="9.2" font-size="7" text-anchor="middle" fill="#fbf3df" font-weight="800">${c.m}</text></g>
  </svg>`;
}

export function CardBack(props) {
  const skin = props.skin || 'classic';
  const fill = skin === 'indigo' ? '#233a6b' : skin === 'jade' ? '#1f5e4a' : '#a8221a';
  return html`<svg class="card-svg" viewBox="0 0 40 60" aria-hidden="true">
    <rect x=".6" y=".6" width="38.8" height="58.8" rx="3.2" fill=${fill} stroke="#5d130e" stroke-width="1" />
    <rect x="4" y="4" width="32" height="52" rx="2" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8" />
    <circle cx="20" cy="30" r="9" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1" />
    <text x="20" y="33.5" font-size="9" text-anchor="middle" fill="rgba(255,255,255,.7)" font-weight="800">木</text>
  </svg>`;
}

export function monthName(m) { return MONTHS[m].name; }
