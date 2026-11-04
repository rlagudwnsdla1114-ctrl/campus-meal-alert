import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  savePreference, listPreferences,
  getAllergyProfile, removePreference
} from '../db/preferences.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../db/002_allergies.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO users(id,nickname) VALUES ('u1','회원1'),('u2','회원2');
    INSERT INTO foods(id,name,normalized_name,category)
      VALUES ('f1','테스트음식','테스트음식','main');
    INSERT INTO allergens(id,name) VALUES ('a1','테스트성분');
  `);
  return db;
}

function register(db) {
  const result = savePreference(db, { userId: 'u1' }, {
    foodId: 'f1',
    preference: 'disliked',
    reason: 'allergy',
    allergenIds: ['a1'],
    note: '사용자가 직접 선택'
  });
  assert.equal(result.ok, true);
}

test('취향과 알레르기는 해당 회원에게만 조회된다', () => {
  const db = setup();
  try {
    register(db);
    const result = listPreferences(db, { userId: 'u1' });
    assert.equal(result.ok, true);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].reason, 'allergy');
    assert.equal(result.data[0].note, '사용자가 직접 선택');
    assert.deepEqual(result.data[0].allergenIds, ['a1']);

    assert.deepEqual(listPreferences(db, { userId: 'u2' }).data, []);
    assert.deepEqual(getAllergyProfile(db, { userId: 'u1' }).data, {
      userId: 'u1', status: 'registered', allergenIds: ['a1']
    });
    assert.deepEqual(getAllergyProfile(db, { userId: 'u2' }).data, {
      userId: 'u2', status: 'not_set', allergenIds: []
    });
  } finally {
    db.close();
  }
});

test('다른 회원은 취향을 삭제할 수 없고 삭제 후 회원 알레르기는 유지', () => {
  const db = setup();
  try {
    register(db);
    assert.deepEqual(removePreference(db, { userId: 'u2' }, 'f1').data, {
      removed: false
    });
    assert.equal(listPreferences(db, { userId: 'u1' }).data.length, 1);

    assert.deepEqual(removePreference(db, { userId: 'u1' }, 'f1').data, {
      removed: true
    });
    assert.deepEqual(listPreferences(db, { userId: 'u1' }).data, []);
    assert.deepEqual(getAllergyProfile(db, { userId: 'u1' }).data.allergenIds, ['a1']);
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM preference_allergens').get().n, 0
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM foods').get().n, 1);
    assert.equal(removePreference(db, { userId: 'u1' }, 'f1').data.removed, false);
  } finally {
    db.close();
  }
});

test('없는 회원과 빈 음식 ID는 거부한다', () => {
  const db = setup();
  try {
    assert.equal(listPreferences(db, { userId: 'missing' }).error.code,
      'UNAUTHENTICATED');
    assert.equal(getAllergyProfile(db, { userId: 'missing' }).error.code,
      'UNAUTHENTICATED');
    assert.equal(removePreference(db, { userId: 'missing' }, 'f1').error.code,
      'UNAUTHENTICATED');
    assert.equal(removePreference(db, { userId: 'u1' }, '').error.code,
      'INVALID_INPUT');
  } finally {
    db.close();
  }
});