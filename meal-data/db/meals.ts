import type { DatabaseSync } from 'node:sqlite';
import type { MealType } from '../../ai-recommendation/src/types.ts';
import type { Result } from '../design/contracts.ts';

export type MealStatus =
  | 'available'
  | 'closed'
  | 'unknown'
  | 'not_registered';

export interface DailyMealView {
  cafeteriaId: string;
  date: string;
  meals: Record<MealType, string[]>;
  mealStatus: Record<MealType, MealStatus>;
}

export function getDailyMeals(
  db: DatabaseSync,
  input: { cafeteriaId: string; date: string }
): Result<DailyMealView> {
  if (
    !input ||
    typeof input.cafeteriaId !== 'string' ||
    !input.cafeteriaId.trim() ||
    typeof input.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
  ) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: '식당과 날짜를 확인하세요.' }
    };
  }

  const date = new Date(input.date + 'T00:00:00Z');

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.date
  ) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: '존재하지 않는 날짜입니다.' }
    };
  }

  let started = false;

  try {
    db.exec('BEGIN');
    started = true;

    const cafeteria = db.prepare(
      'SELECT id FROM cafeterias WHERE id=?'
    ).get(input.cafeteriaId);

    if (!cafeteria) {
      db.exec('ROLLBACK');
      started = false;
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: '식당을 찾을 수 없습니다.' }
      };
    }

    const result: DailyMealView = {
      cafeteriaId: input.cafeteriaId,
      date: input.date,
      meals: { breakfast: [], lunch: [], dinner: [] },
      mealStatus: {
        breakfast: 'not_registered',
        lunch: 'not_registered',
        dinner: 'not_registered'
      }
    };

    const entries = db.prepare(`
      SELECT id, meal_type, status
      FROM meals
      WHERE cafeteria_id=? AND date=?
    `).all(input.cafeteriaId, input.date);

    for (const entry of entries) {
      const kind = entry.meal_type as MealType;
      const status = entry.status as MealStatus;

      result.mealStatus[kind] = status;

      // 휴무·운영 미확인은 빈 음식 배열로 반환합니다.
      // 빈 배열의 의미는 반드시 mealStatus와 함께 해석합니다.
      if (status !== 'available') continue;

      result.meals[kind] = db.prepare(`
        SELECT f.name
        FROM meal_items i
        JOIN foods f ON f.id=i.food_id
        WHERE i.meal_id=?
        ORDER BY i.sort_order
      `).all(entry.id).map(food => String(food.name));
    }

    db.exec('COMMIT');
    started = false;

    return { ok: true, data: result };
  } catch {
    if (started) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '식단 조회에 실패했습니다.' }
    };
  }
}