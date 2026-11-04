import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  savePreference, updateLikedFood, listPreferences, getAllergyProfile
} from '../db/preferences.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../db/002_allergies.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO users(id,nickname) VALUES ('u1','회원1'),('u2','회원2');
    INSERT INTO foods(id,name,normalized_name,category)
    VALUES
      ('f1','계란말이','계란말이','side'),
      ('f2','돈까스','돈까스','main'),
      ('f3','테스트음식','테스트음식','unknown');
    INSERT INTO allergens(id,name) VALUES ('a1','테스트성분');
  `);
  assert.equal(savePreference(db, {userId:'u1'}, {
    foodId:'f1', preference:'liked'
  }).ok, true);
  return db;
}

test('선호 음식 변경·동일 음식 재요청·회원 알레르기 보존', () => {
  const db = setup();
  try {
    assert.equal(savePreference(db, {userId:'u1'}, {
      foodId:'f3', preference:'disliked',
      reason:'allergy', allergenIds:['a1']
    }).ok, true);

    const result = updateLikedFood(db, {userId:'u1'}, {
      previousFoodId:'f1', foodId:'f2'
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.food.id, 'f2');

    const preferences = listPreferences(db, {userId:'u1'}).data;
    assert.ok(!preferences.some(p => p.food.id === 'f1'));
    assert.ok(preferences.some(p => p.food.id === 'f2' && p.preference === 'liked'));

    assert.deepEqual(
      getAllergyProfile(db, {userId:'u1'}).data.allergenIds, ['a1']
    );
    assert.equal(updateLikedFood(db, {userId:'u1'}, {
      previousFoodId:'f2', foodId:'f2'
    }).ok, true);
  } finally { db.close(); }
});

test('이미 등록된 선호·비선호 음식으로 변경하면 기존 목록 유지', () => {
  for (const kind of ['liked', 'disliked']) {
    const db = setup();
    try {
      const input = kind === 'liked'
        ? {foodId:'f2', preference:'liked'}
        : {foodId:'f2', preference:'disliked', reason:'taste_texture'};
      assert.equal(savePreference(db, {userId:'u1'}, input).ok, true);

      const before = listPreferences(db, {userId:'u1'});
      const result = updateLikedFood(db, {userId:'u1'}, {
        previousFoodId:'f1', foodId:'f2'
      });
      assert.equal(result.error.code, 'CONFLICT');
      assert.deepEqual(listPreferences(db, {userId:'u1'}), before);
    } finally { db.close(); }
  }
});

test('타인 취향·없는 음식·비선호 음식 변경 차단', () => {
  const db = setup();
  try {
    assert.equal(updateLikedFood(db, {userId:'u2'}, {
      previousFoodId:'f1', foodId:'f2'
    }).error.code, 'NOT_FOUND');

    assert.equal(updateLikedFood(db, {userId:'u1'}, {
      previousFoodId:'f1', foodId:'missing'
    }).error.code, 'NOT_FOUND');

    assert.equal(updateLikedFood(db, {userId:'missing'}, {
      previousFoodId:'f1', foodId:'f2'
    }).error.code, 'UNAUTHENTICATED');

    savePreference(db, {userId:'u1'}, {
      foodId:'f3', preference:'disliked', reason:'taste_texture'
    });
    assert.equal(updateLikedFood(db, {userId:'u1'}, {
      previousFoodId:'f3', foodId:'f2'
    }).error.code, 'INVALID_INPUT');

    assert.ok(listPreferences(db, {userId:'u1'}).data.some(
      p => p.food.id === 'f1' && p.preference === 'liked'
    ));
  } finally { db.close(); }
});