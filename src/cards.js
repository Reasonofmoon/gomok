/**
 * 화투패 그림.
 * 앞면: Wikimedia Commons "SVG Hwatu" 48장(CC BY-SA 4.0, 파일 수정 없음, 이름만 m월-번호로 바꿈).
 *   개별 SVG: Spenĉjo · 한국식 화투 원본 디자인: Marcus Richert · 일부 Hanafuda 그래픽 기반: Louie Mantia, Jr.
 *   https://commons.wikimedia.org/wiki/Category:SVG_Hwatu  (자세한 고지: assets/hwatu/ATTRIBUTION.txt)
 * 뒷면·더미·부채꼴 손패: 이 게임에서 직접 그린 SVG.
 */
import { html } from './h.js';
import { CARD, MONTHS } from './hwatu.js';

const f2 = function (n) { return Math.round(n * 100) / 100; };
const pad = function (n) { return (n < 10 ? '0' : '') + n; };

/** 카드 id(0~47) → 그림 파일. 한 달 안의 순서(광/열끗 → 띠 → 피, 11월 쌍피, 12월 쌍피)가 원본 번호와 같다. */
export function cardSrc(id) { const c = CARD[id]; return 'assets/hwatu/m' + pad(c.m) + '-' + pad(id - (c.m - 1) * 4 + 1) + '.svg'; }

/** 뒷면용 정의(문서에 한 번 깔아 둔다). */
export function CardDefs() {
  return html`<svg width="0" height="0" style=${{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true" focusable="false"><defs>
    <linearGradient id="hw-gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45" /><stop offset=".32" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".08" /></linearGradient>
    <linearGradient id="hw-back-classic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d22e22" /><stop offset=".55" stop-color="#a81c15" /><stop offset="1" stop-color="#76100b" /></linearGradient>
    <linearGradient id="hw-back-indigo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a5aa0" /><stop offset="1" stop-color="#15244a" /></linearGradient>
    <linearGradient id="hw-back-jade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8a6b" /><stop offset="1" stop-color="#103d2d" /></linearGradient>
    <pattern id="hw-weave" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4 L4 0" stroke="#000" stroke-opacity=".08" stroke-width=".8" /></pattern>
  </defs></svg>`;
}

// 처음 받는 화면이 덜 깜빡이게 48장을 미리 데워 둔다(서비스 워커가 있으면 그 뒤로는 저장본).
let warmed = false;
export function warmCards() {
  if (warmed || typeof Image === 'undefined') return;
  warmed = true;
  CARD.forEach(function (c) { const im = new Image(); im.decoding = 'async'; im.src = cardSrc(c.id); });
}

export function CardFace(props) {
  const c = CARD[props.id];
  return html`<span class="card-svg card-face" role="img" aria-label=${c.label} title=${props.noTitle ? undefined : c.label}>
    <img src=${cardSrc(c.id)} alt="" draggable="false" decoding="async" />
    ${props.plain ? null : html`<i class="mb" aria-hidden="true">${c.m}</i>`}
  </span>`;
}

const BACK = { classic: '#b3221a', indigo: '#24407a', jade: '#1f6a52' };
export function CardBack(props) {
  const skin = BACK[props.skin] ? props.skin : 'classic';
  return html`<svg class="card-svg card-back" viewBox="0 0 103 168" aria-hidden="true">
    <rect width="103" height="168" rx="8" fill=${'url(#hw-back-' + skin + ') ' + BACK[skin]} />
    <rect width="103" height="168" rx="8" fill="url(#hw-weave)" />
    <rect x="6" y="6" width="91" height="156" rx="5" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1.4" />
    <rect x="7.6" y="7.6" width="87.8" height="152.8" rx="4" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" />
    <rect width="103" height="168" rx="8" fill="url(#hw-gloss)" />
  </svg>`;
}

/** 엎어 쌓아 둔 더미. 장수만큼 두께가 줄고, 한 장 뽑힐 때마다 맨 윗장이 손 쪽으로 날아간다. */
export function DeckPile(props) {
  const n = props.count, layers = n ? Math.min(12, 2 + Math.ceil(n / 4)) : 0;
  const J = [0, .6, -.5, .3, -.7, .4, -.2, .7, -.4, .2, -.6, .5];
  const cards = [];
  for (let k = 0; k < layers; k++) {
    cards.push(html`<span key=${k} class="dp-card" style=${{ transform: 'translate(' + f2(-k * 0.35 + J[k] * 0.6) + 'px,' + f2(-k * 1.15) + 'px) rotate(' + f2(J[k] * 1.6) + 'deg)', zIndex: k }}><${CardBack} skin=${props.skin} /></span>`);
  }
  return html`<div class=${'deck-pile' + (n ? '' : ' empty')} role="img" aria-label=${'더미 ' + n + '장'} title=${'더미 ' + n + '장'} data-tut="deck">
    ${cards}
    ${props.flyKey ? html`<span key=${'fly' + props.flyKey} class=${'dp-fly ' + (props.flyTo || 'down')}><${CardBack} skin=${props.skin} /></span>` : null}
    <b class="dp-n">${n}</b>
  </div>`;
}

/** 상대 손패: 부채꼴로 편 뒷면. */
export function MiniFan(props) {
  const n = props.count, mid = (n - 1) / 2;
  return html`<div class="mini-fan" aria-label=${'상대 손패 ' + n + '장'}>${Array.from({ length: n }, function (_, k) {
    return html`<span key=${k} style=${{ transform: 'rotate(' + f2((k - mid) * 9) + 'deg) translateY(' + f2(Math.abs(k - mid) * 1.4) + 'px)' }}><${CardBack} skin=${props.skin} /></span>`;
  })}</div>`;
}

export function monthName(m) { return MONTHS[m].name; }

export const CARD_CREDIT = {
  title: '화투패 그림',
  lines: ['개별 SVG: Spenĉjo', '한국식 화투 원본 디자인: Marcus Richert', '일부 Hanafuda 그래픽 기반: Louie Mantia, Jr.'],
  source: 'https://commons.wikimedia.org/wiki/Category:SVG_Hwatu',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  note: '파일은 수정하지 않고 이름만 바꿔 썼어요.'
};
