/**
 * 화투 48장 데이터. 화면·규칙·AI가 함께 쓴다(DOM 없음, Node에서도 돈다).
 * type: gwang(광) | yeol(열끗) | tti(띠) | pi(피)
 * tti: red(홍단) | blue(청단) | cho(초단) | plain(비띠, 단 조합 없음)
 * bird: 고도리 새(2·4·8월 열끗), bi: 비광, pi: 피 값(쌍피 2)
 */
export const MONTHS = [
  null,
  { m: 1, name: '송학', hanja: '一' },
  { m: 2, name: '매조', hanja: '二' },
  { m: 3, name: '벚꽃', hanja: '三' },
  { m: 4, name: '흑싸리', hanja: '四' },
  { m: 5, name: '난초', hanja: '五' },
  { m: 6, name: '모란', hanja: '六' },
  { m: 7, name: '홍싸리', hanja: '七' },
  { m: 8, name: '공산', hanja: '八' },
  { m: 9, name: '국진', hanja: '九' },
  { m: 10, name: '단풍', hanja: '十' },
  { m: 11, name: '오동', hanja: '十一' },
  { m: 12, name: '비', hanja: '十二' }
];

// [월, 종류, 추가 속성]
const RAW = [
  [1, 'gwang'], [1, 'tti', { tti: 'red' }], [1, 'pi'], [1, 'pi'],
  [2, 'yeol', { bird: true, glyph: '鳥' }], [2, 'tti', { tti: 'red' }], [2, 'pi'], [2, 'pi'],
  [3, 'gwang'], [3, 'tti', { tti: 'red' }], [3, 'pi'], [3, 'pi'],
  [4, 'yeol', { bird: true, glyph: '鳥' }], [4, 'tti', { tti: 'cho' }], [4, 'pi'], [4, 'pi'],
  [5, 'yeol', { glyph: '橋' }], [5, 'tti', { tti: 'cho' }], [5, 'pi'], [5, 'pi'],
  [6, 'yeol', { glyph: '蝶' }], [6, 'tti', { tti: 'blue' }], [6, 'pi'], [6, 'pi'],
  [7, 'yeol', { glyph: '猪' }], [7, 'tti', { tti: 'cho' }], [7, 'pi'], [7, 'pi'],
  [8, 'gwang'], [8, 'yeol', { bird: true, glyph: '雁' }], [8, 'pi'], [8, 'pi'],
  [9, 'yeol', { glyph: '杯' }], [9, 'tti', { tti: 'blue' }], [9, 'pi'], [9, 'pi'],
  [10, 'yeol', { glyph: '鹿' }], [10, 'tti', { tti: 'blue' }], [10, 'pi'], [10, 'pi'],
  [11, 'gwang'], [11, 'pi', { pi: 2 }], [11, 'pi'], [11, 'pi'],
  [12, 'gwang', { bi: true }], [12, 'yeol', { glyph: '燕' }], [12, 'tti', { tti: 'plain' }], [12, 'pi', { pi: 2 }]
];

const TYPE_KO = { gwang: '광', yeol: '열끗', tti: '띠', pi: '피' };
const TTI_KO = { red: '홍단', blue: '청단', cho: '초단', plain: '띠' };

export const DECK = RAW.map(function (r, i) {
  const extra = r[2] || {};
  const c = { id: i, m: r[0], type: r[1], tti: null, bird: false, bi: false, pi: 0, glyph: null };
  Object.assign(c, extra);
  if (c.type === 'pi' && !c.pi) c.pi = 1;
  const kind = c.type === 'tti' ? TTI_KO[c.tti] : c.type === 'pi' && c.pi === 2 ? '쌍피' : c.bi ? '비광' : TYPE_KO[c.type];
  c.label = c.m + '월 ' + MONTHS[c.m].name + ' ' + kind;
  return c;
});

export const CARD = DECK; // id === index
