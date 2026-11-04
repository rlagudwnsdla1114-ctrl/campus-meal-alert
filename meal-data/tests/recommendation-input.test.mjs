import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { getRecommendationInput } from '../db/recommendation-input.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));

  db.exec(`
    INSERT INTO users(id,nickname) VALUES ('u1','회원1'),('u2','회원2');
    INSERT INTO cafeterias(id,name) VALUES ('c1','학식');

    INSERT INTO foods
      (id,name,normalized_name,category,review_status)
    VALUES
      ('f1','계란말이','계란말이','side','confirmed'),
      ('f2','가지볶음','가지볶음','side','confirmed');

    INSERT INTO user_food_preferences(user_id,food_id,preference)
    VALUES
      ('u1','f1','liked'),
      ('u1','f2','disliked'),
      ('u2','f2','liked');

    INSERT INTO meals(id,cafeteria_id,date,meal_type,status)
    VALUES
      ('m1','c1','2026-11-04','breakfast','closed'),
      ('m2','c1','2026-11-04','lunch','available'),
      ('m3','c1','2026-11-04','dinner','closed');

    INSERT INTO meal_items(id,meal_id,food_id,raw_text,sort_order)
    VALUES ('i1','m2','f1','계란말이',0);
  `);
  return db;
}

const request = { cafeteriaId: 'c1', date: '2026-11-04' };

test('회원별 취향과 공통 식단을 기존 AI 형식으로 반환', () => {
  const db = setup();
  try {
    assert.deepEqual(
      getRecommendationInput(db, { userId: 'u1' }, request),
      {
        ok: true,
        data: {
          date: '2026-11-04',
          meals: { breakfast: [], lunch: ['계란말이'], dinner: [] },
          liked: ['계란말이'],
          disliked: ['가지볶음']
        }
      }
    );

    const other = getRecommendationInput(db, { userId: 'u2' }, request);
    assert.deepEqual(other.data.liked, ['가지볶음']);
    assert.deepEqual(other.data.disliked, []);
  } finally { db.close(); }
});

test('없는 회원·식당·날짜와 잘못된 날짜 처리', () => {
  const db = setup();
  try {
    assert.equal(
      getRecommendationInput(db, { userId: 'missing' }, request).error.code,
      'UNAUTHENTICATED'
    );
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, {
        ...request, cafeteriaId: 'missing'
      }).error.code,
      'NOT_FOUND'
    );
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, {
        ...request, date: '2026-11-05'
      }).error.code,
      'NOT_FOUND'
    );
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, {
        ...request, date: '2026-02-30'
      }).error.code,
      'INVALID_INPUT'
    );
  } finally { db.close(); }
});

test('끼니 미등록·운영 미확인·미검토 음식은 추천 입력 생성 차단', () => {
  const db = setup();
  try {
    db.exec("UPDATE meals SET status='unknown' WHERE id='m1'");
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, request).error.code,
      'REVIEW_REQUIRED'
    );

    db.exec("UPDATE meals SET status='closed' WHERE id='m1'");
    db.exec("UPDATE foods SET review_status='pending' WHERE id='f1'");
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, request).error.code,
      'REVIEW_REQUIRED'
    );

    db.exec("UPDATE foods SET review_status='confirmed' WHERE id='f1'");
    db.exec("DELETE FROM meals WHERE id='m3'");
    assert.equal(
      getRecommendationInput(db, { userId: 'u1' }, request).error.code,
      'REVIEW_REQUIRED'
    );
  } finally { db.close(); }
});