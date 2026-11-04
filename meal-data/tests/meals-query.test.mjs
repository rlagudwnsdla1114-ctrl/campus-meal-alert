import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { getDailyMeals } from '../db/meals.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO cafeterias(id,name)
    VALUES ('c1','학식A'),('c2','학식B');

    INSERT INTO foods(id,name,normalized_name,category)
    VALUES
      ('f1','백미밥','백미밥','staple'),
      ('f2','계란말이','계란말이','side');

    INSERT INTO meals(id,cafeteria_id,date,meal_type,status)
    VALUES
      ('m1','c1','2026-11-04','breakfast','closed'),
      ('m2','c1','2026-11-04','lunch','available'),
      ('m3','c1','2026-11-04','dinner','unknown');

    INSERT INTO meal_items(id,meal_id,food_id,raw_text,sort_order)
    VALUES
      ('i2','m2','f2','계란말이',1),
      ('i1','m2','f1','백미밥',0);
  `);
  return db;
}

test('날짜별 음식 배열과 운영 상태를 구분하고 식단 순서 유지', () => {
  const db = setup();
  try {
    assert.deepEqual(
      getDailyMeals(db, {cafeteriaId:'c1', date:'2026-11-04'}),
      {
        ok: true,
        data: {
          cafeteriaId:'c1',
          date:'2026-11-04',
          meals:{
            breakfast:[], lunch:['백미밥','계란말이'], dinner:[]
          },
          mealStatus:{
            breakfast:'closed', lunch:'available', dinner:'unknown'
          }
        }
      }
    );
  } finally { db.close(); }
});

test('식당·날짜별 데이터 격리와 미등록 상태 반환', () => {
  const db = setup();
  try {
    for (const input of [
      {cafeteriaId:'c2', date:'2026-11-04'},
      {cafeteriaId:'c1', date:'2026-11-05'}
    ]) {
      const result = getDailyMeals(db, input);
      assert.equal(result.ok, true);
      assert.deepEqual(result.data.meals, {
        breakfast:[], lunch:[], dinner:[]
      });
      assert.deepEqual(result.data.mealStatus, {
        breakfast:'not_registered',
        lunch:'not_registered',
        dinner:'not_registered'
      });
    }
  } finally { db.close(); }
});

test('없는 식당·잘못된 날짜·빈 식당 ID 처리', () => {
  const db = setup();
  try {
    assert.equal(getDailyMeals(db, {
      cafeteriaId:'missing',date:'2026-11-04'
    }).error.code, 'NOT_FOUND');

    assert.equal(getDailyMeals(db, {
      cafeteriaId:'c1',date:'2026-02-30'
    }).error.code, 'INVALID_INPUT');

    assert.equal(getDailyMeals(db, {
      cafeteriaId:'',date:'2026-11-04'
    }).error.code, 'INVALID_INPUT');
  } finally { db.close(); }
});