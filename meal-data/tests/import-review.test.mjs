import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFoodCell, validateImportDraft } from '../design/import-review.ts';
const draft = () => ({ sourceId: 's1', cafeteriaId: 'c1', yearConfirmed: true, meals: [{ date: '2026-11-04', mealType: 'lunch', items: [{rawText:'갈 치 구 이', name:'갈치구이',category:'main',reviewReasons:[]}] }] });
test('음식 셀 원문 보존 및 복합 메뉴 검토 요구', () => {
 const food = parseFoodCell(' 너비아니*소스 ');
 assert.equal(food.rawText, ' 너비아니*소스 ');
 assert.equal(food.name, '너비아니*소스');
 assert.equal(food.category, 'unknown');
 assert.ok(food.reviewReasons.some(x => x.includes('소스')));
 assert.throws(() => parseFoodCell('  '));
});
test('연도 미확인, 검토 미완료, 날짜 오류 및 중복 차단', () => {
 const data = draft(); data.yearConfirmed = false;
 data.meals[0].items = [parseFoodCell('우유&커피')];
 data.meals[0].date = '2026-02-30';
 data.meals.push(data.meals[0]);
 const errors = validateImportDraft(data);
 assert.ok(errors.some(x => x.includes('연도')));
 assert.ok(errors.some(x => x.includes('검토')));
 assert.ok(errors.some(x => x.includes('날짜')));
 assert.ok(errors.some(x => x.includes('중복')));
});
test('검토 완료 식단은 통과하고 빈 식단은 차단', () => {
 assert.deepEqual(validateImportDraft(draft()), []);
 const data = draft(); data.meals[0].items = [];
 assert.ok(validateImportDraft(data).some(x => x.includes('빈 식단')));
});
