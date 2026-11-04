import type { DatabaseSync } from 'node:sqlite';
import type { AuthContext, Result } from '../design/contracts.ts';
import type {
  MealType, RecommendInput
} from '../../ai-recommendation/src/types.ts';

export function getRecommendationInput(
  db: DatabaseSync,
  ctx: AuthContext,
  input: { cafeteriaId: string; date: string }
): Result<RecommendInput> {
  const fail = (
    code: 'INVALID_INPUT' | 'UNAUTHENTICATED' |
          'NOT_FOUND' | 'REVIEW_REQUIRED',
    message: string
  ): Result<RecommendInput> => ({
    ok: false, error: { code, message }
  });

  if (!ctx?.userId) {
    return fail('UNAUTHENTICATED', '로그인이 필요합니다.');
  }

  if (
    !input ||
    typeof input.cafeteriaId !== 'string' ||
    !input.cafeteriaId.trim() ||
    typeof input.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
  ) {
    return fail('INVALID_INPUT', '식당과 날짜를 확인하세요.');
  }

  const parsed = new Date(input.date + 'T00:00:00Z');
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== input.date
  ) {
    return fail('INVALID_INPUT', '존재하지 않는 날짜입니다.');
  }

  let transactionStarted = false;

  try {
    // 여러 조회가 같은 DB 상태를 보도록 읽기 트랜잭션을 사용합니다.
    db.exec('BEGIN');
    transactionStarted = true;

    const abort = (
      code: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'REVIEW_REQUIRED',
      message: string
    ): Result<RecommendInput> => {
      db.exec('ROLLBACK');
      transactionStarted = false;
      return fail(code, message);
    };

    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(ctx.userId)) {
      return abort('UNAUTHENTICATED', '등록된 회원이 아닙니다.');
    }

    if (!db.prepare(
      'SELECT id FROM cafeterias WHERE id = ?'
    ).get(input.cafeteriaId)) {
      return abort('NOT_FOUND', '식당을 찾을 수 없습니다.');
    }

    const entries = db.prepare(`
      SELECT id, meal_type, status
      FROM meals
      WHERE cafeteria_id = ? AND date = ?
    `).all(input.cafeteriaId, input.date);

    if (entries.length === 0) {
      return abort('NOT_FOUND', '해당 날짜의 식단이 없습니다.');
    }

    const order: MealType[] = ['breakfast', 'lunch', 'dinner'];

    // 미등록과 휴무를 혼동하지 않습니다.
    for (const type of order) {
      const entry = entries.find(row => row.meal_type === type);
      if (!entry || entry.status === 'unknown') {
        return abort('REVIEW_REQUIRED', `${type} 운영 상태를 확인하세요.`);
      }
    }

    const meals: Record<MealType, string[]> = {
      breakfast: [], lunch: [], dinner: []
    };

    for (const type of order) {
      const entry = entries.find(row => row.meal_type === type)!;

      // 방학 등 미운영 끼니는 DB에 closed로 명시합니다.
      if (entry.status === 'closed') continue;

      const foods = db.prepare(`
        SELECT f.name, f.review_status
        FROM meal_items i
        JOIN foods f ON f.id = i.food_id
        WHERE i.meal_id = ?
        ORDER BY i.sort_order
      `).all(entry.id);

      if (
        foods.length === 0 ||
        foods.some(food => food.review_status !== 'confirmed')
      ) {
        return abort('REVIEW_REQUIRED', `${type} 메뉴 검토가 필요합니다.`);
      }

      meals[type] = foods.map(food => String(food.name));
    }

    const preferences = db.prepare(`
      SELECT f.name, p.preference
      FROM user_food_preferences p
      JOIN foods f ON f.id = p.food_id
      WHERE p.user_id = ?
      ORDER BY f.name, f.id
    `).all(ctx.userId);

    const result: RecommendInput = {
      date: input.date,
      meals,
      liked: preferences
        .filter(row => row.preference === 'liked')
        .map(row => String(row.name)),
      disliked: preferences
        .filter(row => row.preference === 'disliked')
        .map(row => String(row.name))
    };

    db.exec('COMMIT');
    transactionStarted = false;

    return { ok: true, data: result };
  } catch {
    if (transactionStarted) {
      try { db.exec('ROLLBACK'); } catch {}
    }

    return {
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: '추천 입력 조회에 실패했습니다.'
      }
    };
  }
}