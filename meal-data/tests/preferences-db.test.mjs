import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { savePreference } from '../db/preferences.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../db/002_allergies.sql', import.meta.url), 'utf8'));

  // 실제 사용자 정보나 공식 성분 목록이 아닌 테스트 자료입니다.
  db.exec(`
    INSERT INTO users(id,nickname) VALUES ('u1','회원1'),('u2','회원2');
    INSERT INTO foods(id,name,normalized_name,category)
      VALUES ('f1','테스트음식','테스트음식','main');
    INSERT INTO allergens(id,name) VALUES ('a1','테스트성분');
  `);
  return db;
}

test('회원별 취향 분리 및 알레르기 동시 저장', () => {
  const db = setup();
  try {
    const first = savePreference(db, { userId: 'u1' }, {
      foodId: 'f1',
      preference: 'disliked',
      reason: 'allergy',
      allergenIds: ['a1', 'a1']
    });
    assert.equal(first.ok, true);
    assert.deepEqual(first.data.allergenIds, ['a1']);

    const second = savePreference(db, { userId: 'u2' }, {
      foodId: 'f1', preference: 'liked'
    });
    assert.equal(second.ok, true);

    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_allergens').get().n, 1
    );
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_food_preferences').get().n, 2
    );

    savePreference(db, { userId: 'u1' }, {
      foodId: 'f1', preference: 'liked'
    });

    assert.equal(
      db.prepare('SELECT count(*) AS n FROM preference_allergens').get().n, 0
    );
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_allergens').get().n, 1
    );
  } finally {
    db.close();
  }
});

test('빈 성분·존재하지 않는 성분은 저장하지 않는다', () => {
  const db = setup();
  try {
    for (const ids of [[], ['missing']]) {
      const result = savePreference(db, { userId: 'u1' }, {
        foodId: 'f1', preference: 'disliked',
        reason: 'allergy', allergenIds: ids
      });
      assert.equal(result.ok, false);
    }
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_food_preferences').get().n, 0
    );
  } finally {
    db.close();
  }
});

test('알레르기 저장 중 실패하면 음식 취향까지 롤백', () => {
  const db = setup();
  try {
    db.exec(`
      CREATE TRIGGER simulate_failure BEFORE INSERT ON user_allergens
      BEGIN SELECT RAISE(ABORT, 'test failure'); END;
    `);

    const result = savePreference(db, { userId: 'u1' }, {
      foodId: 'f1', preference: 'disliked',
      reason: 'allergy', allergenIds: ['a1']
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_ERROR');
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_food_preferences').get().n, 0
    );
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM user_allergy_profiles').get().n, 0
    );
  } finally {
    db.close();
  }
});