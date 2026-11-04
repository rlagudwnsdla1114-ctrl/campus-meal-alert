import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { saveManualMeal, deleteManualMeal } from '../db/meals-write.ts';
import { getDailyMeals } from '../db/meals.ts';

const request = {
  cafeteriaId:'c1', date:'2026-11-04',
  mealType:'lunch', editReason:'잘못 등록한 식단 삭제'
};

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../db/002_allergies.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO users(id,nickname) VALUES ('u1','회원');
    INSERT INTO cafeterias(id,name) VALUES ('c1','학식');
    INSERT INTO foods(id,name,normalized_name,category)
      VALUES ('f1','백미밥','백미밥','staple');
    INSERT INTO user_food_preferences(user_id,food_id,preference)
      VALUES ('u1','f1','liked');
    INSERT INTO allergens(id,name) VALUES ('a1','테스트성분');
    INSERT INTO user_allergy_profiles(user_id,status)
      VALUES ('u1','registered');
    INSERT INTO user_allergens(user_id,allergen_id) VALUES ('u1','a1');
  `);
  assert.equal(saveManualMeal(db, {
    ...request,
    status:'available',
    items:[{foodId:'f1',rawText:'백미밥'}],
    servingStyle:'normal',
    notes:['프로젝트용 식단']
  }).ok, true);
  return db;
}

test('식단 삭제·이력 보존·회원 데이터와 음식 사전 유지', () => {
  const db = setup();
  try {
    const result = deleteManualMeal(db, request);
    assert.equal(result.ok, true);
    assert.equal(result.data.removed, true);

    const view = getDailyMeals(db, request).data;
    assert.equal(view.mealStatus.lunch, 'not_registered');
    assert.deepEqual(view.meals.lunch, []);

    assert.equal(db.prepare('SELECT count(*) AS n FROM meal_items').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM meal_details').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM foods').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM user_food_preferences').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM user_allergens').get().n, 1);

    const history = db.prepare('SELECT * FROM meal_delete_log').get();
    const before = JSON.parse(history.before_json);
    assert.equal(before.items[0].food_name, '백미밥');
    assert.equal(history.reason, request.editReason);
  } finally { db.close(); }
});

test('날짜가 다른 요청·재삭제·잘못된 입력 처리', () => {
  const db = setup();
  try {
    assert.equal(deleteManualMeal(db, {
      ...request, date:'2026-11-05'
    }).data.removed, false);

    assert.equal(db.prepare('SELECT count(*) AS n FROM meals').get().n, 1);

    assert.equal(deleteManualMeal(db, {
      ...request, editReason:''
    }).error.code, 'INVALID_INPUT');

    assert.equal(deleteManualMeal(db, {
      ...request, date:'2026-02-30'
    }).error.code, 'INVALID_INPUT');

    assert.equal(deleteManualMeal(db, {
      ...request, cafeteriaId:'missing'
    }).error.code, 'NOT_FOUND');

    assert.equal(deleteManualMeal(db, request).data.removed, true);
    assert.equal(deleteManualMeal(db, request).data.removed, false);
    assert.equal(db.prepare('SELECT count(*) AS n FROM meal_delete_log').get().n, 1);
  } finally { db.close(); }
});

test('삭제 실패 시 식단과 이력 변경 전체 취소', () => {
  const db = setup();
  try {
    db.exec(`
      CREATE TABLE meal_delete_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        before_json TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TRIGGER force_delete_failure BEFORE DELETE ON meals
      BEGIN SELECT RAISE(ABORT, 'test failure'); END;
    `);
    const result = deleteManualMeal(db, request);
    assert.equal(result.error.code, 'STORAGE_ERROR');
    assert.equal(db.prepare('SELECT count(*) AS n FROM meals').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM meal_items').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM meal_delete_log').get().n, 0);
  } finally { db.close(); }
});