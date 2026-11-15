/**
 * 장부(돈·판돈·상점 해금·전적). 숨은 칸에 돈을 적어 두듯,
 * 혼자 두기에서는 localStorage 한 칸에, 온라인에서는 서버의 Google 시트에 같은 모양으로 적는다.
 */
const KEY = 'gomok.ledger.v1';

export const SHOP = [
  { id: 'back-classic', kind: 'back', name: '주홍 뒷면', price: 0, value: 'classic' },
  { id: 'back-indigo', kind: 'back', name: '쪽빛 뒷면', price: 3000, value: 'indigo' },
  { id: 'back-jade', kind: 'back', name: '비취 뒷면', price: 6000, value: 'jade' },
  { id: 'av-moon', kind: 'avatar', name: '달', price: 0, value: '月' },
  { id: 'av-crane', kind: 'avatar', name: '학', price: 2000, value: '鶴' },
  { id: 'av-granny', kind: 'avatar', name: '할매', price: 3000, value: '婆' },
  { id: 'av-grandpa', kind: 'avatar', name: '훈장님', price: 4000, value: '翁' },
  { id: 'av-tiger', kind: 'avatar', name: '범', price: 5000, value: '虎' },
  { id: 'av-dragon', kind: 'avatar', name: '용', price: 12000, value: '龍' },
  { id: 'felt-night', kind: 'felt', name: '밤 담요', price: 8000, value: 'night' }
];

export const STAKES = [100, 200, 500, 1000, 2000, 5000];

function fresh() {
  return { money: 10000, stake: 100, owned: ['back-classic', 'av-moon'], back: 'classic', avatar: '月', felt: 'green',
    played: 0, wins: 0, losses: 0, nagari: 0, carry: 1, best: 0 };
}

export function loadLedger() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.money === 'number') return Object.assign(fresh(), v); } catch (e) { /* 새 장부 */ }
  return fresh();
}
export function saveLedger(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* 저장 못 해도 이번 판은 그대로 */ } }

/** 판 결과를 장부에 적는다. 나가리면 다음 판 배수(carry)를 두 배로. me = 내 자리 번호. */
export function settleLedger(l, result, me) {
  const n = Object.assign({}, l);
  n.played++;
  if (result.winner == null) { n.nagari++; n.carry = Math.min(8, n.carry * 2); n.lastDelta = 0; return n; }
  const amount = result.final * n.stake * n.carry;
  if (result.winner === me) { n.wins++; n.money += amount; n.lastDelta = amount; n.best = Math.max(n.best, result.final); }
  else { n.losses++; n.money = Math.max(0, n.money - amount); n.lastDelta = -amount; }
  n.carry = 1;
  if (n.money < STAKES[0] * 10) { n.money += 3000; n.bailout = true; } else n.bailout = false;   // 파산 방지 지원금
  return n;
}

export function buy(l, item) {
  if (l.owned.indexOf(item.id) >= 0 || l.money < item.price) return l;
  return Object.assign({}, l, { money: l.money - item.price, owned: l.owned.concat([item.id]) });
}
export function equip(l, item) {
  if (l.owned.indexOf(item.id) < 0) return l;
  const n = Object.assign({}, l);
  if (item.kind === 'back') n.back = item.value;
  if (item.kind === 'avatar') n.avatar = item.value;
  if (item.kind === 'felt') n.felt = n.felt === item.value ? 'green' : item.value;
  return n;
}
