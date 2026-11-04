import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { saveManualMeal } from '../db/meals-write.ts';
import { getDailyMeals } from '../db/meals.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO cafeterias(id,name) VALUES ('c1','학식');
    INSERT INTO foods(id,name,normalized_name,category)
    VALUES ('f1','백미밥','백미밥','staple'),
           ('f2','계란말이','계란말이','side');
  `);
  return db;
}

function input() {
  return {
    cafeteriaId:'c1', date:'2026-11-04', mealType:'lunch',
    status:'available', servingStyle:'normal',
    items:[{foodId:'f1',rawText:'백미밥'}],
    notes:[], editReason:'프로젝트 식단 등록'
  };
}

test('식단 등록·중복 차단·명시적 수정·변경 기록', () => {
  const db = setup();
  try {
    const first = saveManualMeal(db, input());
    assert.equal(first.ok, true);
    assert.equal(saveManualMeal(db, input()).error.code, 'CONFLICT');

    const changed = saveManualMeal(db, {
      ...input(), replaceExisting:true,
      items:[{foodId:'f2',rawText:'계란말이'}],
      servingStyle:'bento', notes:['도시락 제공'],
      editReason:'시연용 메뉴 변경'
    });
    assert.equal(changed.ok, true);
    assert.equal(changed.data.id, first.data.id);
    assert.deepEqual(getDailyMeals(db, {
      cafeteriaId:'c1',date:'2026-11-04'
    }).data.meals.lunch, ['계란말이']);

    const logs = db.prepare(
      'SELECT * FROM meal_write_log ORDER BY id'
    ).all();
    assert.equal(logs.length, 2);
    assert.equal(JSON.parse(logs[1].before_json).items[0].food_id, 'f1');
  } finally { db.close(); }
});

test('중복 음식·없는 음식·잘못된 날짜는 기존 식단 유지', () => {
  const db = setup();
  try {
    assert.equal(saveManualMeal(db, input()).ok, true);

    const requests = [
      {...input(), replaceExisting:true, items:[
        {foodId:'f2',rawText:'계란말이'},
        {foodId:'f2',rawText:'계란말이'}
      ]},
      {...input(), replaceExisting:true,
        items:[{foodId:'missing',rawText:'없는음식'}]},
      {...input(), date:'2026-02-30'}
    ];
    for (const request of requests) {
      assert.equal(saveManualMeal(db, request).ok, false);
    }
    assert.deepEqual(getDailyMeals(db, {
      cafeteriaId:'c1',date:'2026-11-04'
    }).data.meals.lunch, ['백미밥']);
  } finally { db.close(); }
});

test('휴무 전환과 저장 중 오류 발생 시 전체 롤백', () => {
  const db = setup();
  try {
    assert.equal(saveManualMeal(db, input()).ok, true);
    db.exec(`
      CREATE TRIGGER force_failure BEFORE INSERT ON meal_items
      WHEN NEW.food_id='f2'
      BEGIN SELECT RAISE(ABORT, 'test failure'); END;
    `);
    const failed = saveManualMeal(db, {
      ...input(), replaceExisting:true,
      items:[{foodId:'f2',rawText:'계란말이'}]
    });
    assert.equal(failed.error.code, 'STORAGE_ERROR');
    assert.deepEqual(getDailyMeals(db, {
      cafeteriaId:'c1',date:'2026-11-04'
    }).data.meals.lunch, ['백미밥']);

    assert.equal(saveManualMeal(db, {
      ...input(), replaceExisting:true, status:'closed',
      items:[], notes:['휴무'], editReason:'휴무 처리'
    }).ok, true);
    const result = getDailyMeals(db, {
      cafeteriaId:'c1',date:'2026-11-04'
    });
    assert.equal(result.data.mealStatus.lunch, 'closed');
    assert.deepEqual(result.data.meals.lunch, []);
    assert.equal(db.prepare('SELECT count(*) AS n FROM foods').get().n, 2);
  } finally { db.close(); }
});