import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareComparison, finalizeRecommendations
} from '../recommendation/core.ts';

function input() {
  return {
    date:'2026-11-04',
    meals:{
      breakfast:['계란말이'],
      lunch:['크리미어니언꼬마돈까스','고추장 돼지불고기'],
      dinner:['계란말이','가지볶음']
    },
    liked:['계란말이','돈까스','제육볶음'],
    disliked:['가지볶음']
  };
}
function candidate(changes = {}) {
  return {
    meal:'lunch', menu:'고추장 돼지불고기',
    matchedFood:'제육볶음', type:'similar',
    score:0.85, reason:'비슷한 돼지고기 볶음',
    ...changes
  };
}

test('완전·부분 일치와 AI에 넘길 나머지 메뉴 분리', () => {
  const result = prepareComparison(input());
  assert.equal(result.basic.length, 3);
  assert.equal(result.basic.find(r => r.type === 'exact').score, 1);
  assert.equal(result.basic.find(r => r.type === 'partial').score, 0.9);
  assert.deepEqual(result.aiInput.meals.lunch, ['고추장 돼지불고기']);
  assert.deepEqual(result.aiInput.meals.dinner, []);
});

test('비선호 우선 및 완전·포함 제외 기준', () => {
  // 선호와 비선호가 정확히 겹치면 어떤 모드에서도 비선호 우선.
  const overlap = input();
  overlap.disliked.push('계란말이', '돈까스');

  assert.equal(prepareComparison(overlap).basic.length, 0);
  assert.equal(prepareComparison(overlap, {
    dislikedMatch: 'exact'
  }).basic.length, 0);

  // 선호 이름과 비선호 이름은 다르지만 실제 메뉴에 비선호가 포함된 경우.
  const data = input();
  data.disliked.push('꼬마돈까스');

  // 포함 제외: 크리미어니언꼬마돈까스를 제외.
  assert.ok(!prepareComparison(data).basic.some(
    r => r.menu === '크리미어니언꼬마돈까스'
  ));

  // 완전 일치만 제외: 이름이 다르므로 돈까스 부분 일치 추천 유지.
  assert.ok(prepareComparison(data, {
    dislikedMatch: 'exact'
  }).basic.some(
    r => r.menu === '크리미어니언꼬마돈까스' && r.type === 'partial'
  ));
});

test('유사도 최소 기준은 AI 유사 추천에 적용', () => {
  const results = finalizeRecommendations(input(), [candidate()], {
    minSimilarityScore:0.9
  });
  assert.equal(results.length, 3);
  assert.ok(!results.some(r => r.type === 'similar'));
  assert.ok(results.some(r => r.type === 'partial'));
});

test('중복 AI 후보는 최고 점수 하나, 정렬 기준 적용', () => {
  const candidates = [candidate(), candidate({score:0.95})];
  const normal = finalizeRecommendations(input(), candidates);
  assert.equal(normal.length, 4);
  assert.equal(normal[0].meal, 'breakfast');
  assert.equal(normal.filter(r => r.type === 'similar').length, 1);

  const sorted = finalizeRecommendations(input(), candidates, {
    sortBy:'score_desc'
  });
  assert.deepEqual(sorted.map(r => r.score), [1,1,0.95,0.9]);
});

test('없는 메뉴·없는 선호·잘못된 점수·비선호 재추천 차단', () => {
  const data = input();
  data.disliked.push('고추장 돼지불고기');
  const results = finalizeRecommendations(data, [
    candidate(),
    candidate({menu:'없는음식'}),
    candidate({matchedFood:'없는선호'}),
    candidate({score:NaN}),
    candidate({score:2})
  ]);
  assert.equal(results.length, 3);
  assert.ok(!results.some(r => r.type === 'similar'));
});

test('잘못된 추천 기준 거부 및 입력 데이터 보존', () => {
  const data = input();
  const before = JSON.stringify(data);
  finalizeRecommendations(data, [candidate()]);
  assert.equal(JSON.stringify(data), before);
  assert.throws(() => prepareComparison(data, {
    minSimilarityScore:1.5
  }));
});