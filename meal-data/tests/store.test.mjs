import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MealDataStore, MemoryStorage } from '../index.ts';

test('등록, 수정, 삭제와 새 인스턴스에서 재조회', async () => {
  const storage = new MemoryStorage();
  const store = new MealDataStore(storage);
  await store.addFood('liked', ' 제육볶음 ');
  await store.updateFood('liked', '제육볶음', '돈까스');
  assert.deepEqual(await new MealDataStore(storage).getPreferences(), { liked: ['돈까스'], disliked: [] });
  await store.removeFood('liked', '돈까스');
  assert.deepEqual((await store.getPreferences()).liked, []);
});
test('공백 중복, 빈 이름, 비선호 이동 및 수정 충돌', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await store.addFood('liked', '제육 볶음');
  await assert.rejects(store.addFood('liked', '제육볶음'), /이미/);
  await assert.rejects(store.addFood('liked', ' '), /입력/);
  await store.addFood('disliked', '제육볶음');
  assert.deepEqual(await store.getPreferences(), { liked: [], disliked: ['제육볶음'] });
  await store.addFood('liked', '돈까스');
  await assert.rejects(store.updateFood('liked', '돈까스', '제육볶음'), /이미/);
  await assert.rejects(store.updateFood('liked', '없는음식', '김치'), /찾을/);
});
test('날짜와 끼니별 저장, 중복 정리, 삭제, AI 입력 형식', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await store.addFood('liked', '계란말이');
  await store.setMeal('2026-11-04', 'breakfast', ['계란말이', ' 계란 말이 ']);
  await store.setMeal('2026-11-05', 'lunch', ['돈까스']);
  assert.deepEqual(await store.getRecommendInput('2026-11-04'), {
    date: '2026-11-04', liked: ['계란말이'], disliked: [],
    meals: { breakfast: ['계란말이'], lunch: [], dinner: [] },
  });
  await store.removeMeal('2026-11-04', 'breakfast');
  assert.deepEqual((await store.getMeals('2026-11-04')).breakfast, []);
  assert.deepEqual((await store.getMeals('2026-11-05')).lunch, ['돈까스']);
  await assert.rejects(store.setMeal('2026-02-30', 'lunch', []), /존재/);
  await assert.rejects(store.setMeal('2026-11-04', 'snack', []), /끼니/);
});
test('동시 등록 유실 방지 및 실패 후 다음 작업 정상 처리', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await Promise.all(['김치', '돈까스', '불고기'].map(food => store.addFood('liked', food)));
  await assert.rejects(store.addFood('liked', '김치'));
  await store.addFood('liked', '계란말이');
  assert.equal((await store.getPreferences()).liked.length, 4);
});
test('시연 식단은 기존 식단을 덮어쓰지 않으며 반환 데이터는 격리', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await store.seedDemoMeals('2026-11-04');
  const menus = await store.getMeals('2026-11-04');
  menus.lunch.push('외부 수정');
  assert.ok(!(await store.getMeals('2026-11-04')).lunch.includes('외부 수정'));
  await store.setMeal('2026-11-04', 'lunch', ['사용자 식단']);
  await store.seedDemoMeals('2026-11-04');
  assert.deepEqual((await store.getMeals('2026-11-04')).lunch, ['사용자 식단']);
});
test('저장소 실패와 손상 데이터는 숨기거나 덮어쓰지 않는다', async () => {
  const store = new MealDataStore({ getItem: async () => '{bad', setItem: async () => assert.fail('덮어쓰기 금지') });
  await assert.rejects(store.addFood('liked', '김치'));
  const broken = new MealDataStore({ getItem: async () => null, setItem: async () => { throw new Error('저장 실패'); } });
  await assert.rejects(broken.addFood('liked', '김치'), /저장 실패/);
});
