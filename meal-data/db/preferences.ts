import type { DatabaseSync } from 'node:sqlite';
import type {
  AuthContext, SavePreferenceInput, FoodPreference,
  Food, Result
} from '../design/contracts.ts';

export function savePreference(
  db: DatabaseSync,
  ctx: AuthContext,
  input: SavePreferenceInput
): Result<FoodPreference> {
  const invalid = (message: string): Result<FoodPreference> => ({
    ok: false,
    error: { code: 'INVALID_INPUT', message }
  });

  if (!ctx?.userId) {
    return {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
    };
  }

  if (!input || typeof input.foodId !== 'string' || !input.foodId.trim()) {
    return invalid('음식을 선택하세요.');
  }

  if (!['liked', 'disliked'].includes(input.preference)) {
    return invalid('올바른 취향을 선택하세요.');
  }

  const disliked = input.preference === 'disliked';
  const reason = disliked ? input.reason : null;
  const noteValue = disliked ? input.note : undefined;

  if (disliked && !['taste_texture', 'allergy', 'other'].includes(reason!)) {
    return invalid('비선호 이유를 선택하세요.');
  }

  if (
    noteValue !== undefined &&
    (typeof noteValue !== 'string' || noteValue.length > 500)
  ) {
    return invalid('메모는 500자 이하 문자열이어야 합니다.');
  }

  const note = noteValue?.trim() || null;
  let allergenIds: string[] = [];

  if (input.preference === 'disliked' && input.reason === 'allergy') {
    if (
      !Array.isArray(input.allergenIds) ||
      input.allergenIds.length === 0 ||
      input.allergenIds.some(id => typeof id !== 'string' || !id.trim())
    ) {
      return invalid('알레르기 성분을 하나 이상 선택하세요.');
    }
    allergenIds = [...new Set(input.allergenIds.map(id => id.trim()))];
  }

  let transactionStarted = false;

  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('BEGIN IMMEDIATE');
    transactionStarted = true;

    const fail = (
      code: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'INVALID_INPUT',
      message: string
    ): Result<FoodPreference> => {
      db.exec('ROLLBACK');
      transactionStarted = false;
      return { ok: false, error: { code, message } };
    };

    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(ctx.userId)) {
      return fail('UNAUTHENTICATED', '등록된 회원이 아닙니다.');
    }

    const food = db.prepare(
      'SELECT id, name, category FROM foods WHERE id = ?'
    ).get(input.foodId) as unknown as Food | undefined;

    if (!food) return fail('NOT_FOUND', '음식을 찾을 수 없습니다.');

    for (const id of allergenIds) {
      if (!db.prepare('SELECT id FROM allergens WHERE id = ?').get(id)) {
        return fail('INVALID_INPUT', '존재하지 않는 알레르기 성분입니다.');
      }
    }

    db.prepare(`
      INSERT INTO user_food_preferences
        (user_id, food_id, preference, reason, note)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, food_id) DO UPDATE SET
        preference = excluded.preference,
        reason = excluded.reason,
        note = excluded.note,
        updated_at = CURRENT_TIMESTAMP
    `).run(ctx.userId, food.id, input.preference, reason, note);

    // 이 음식에 연결된 사유별 성분만 교체합니다.
    db.prepare(`
      DELETE FROM preference_allergens
      WHERE user_id = ? AND food_id = ?
    `).run(ctx.userId, food.id);

    if (reason === 'allergy') {
      db.prepare(`
        INSERT INTO user_allergy_profiles(user_id, status)
        VALUES (?, 'registered')
        ON CONFLICT(user_id) DO UPDATE SET
          status = 'registered',
          updated_at = CURRENT_TIMESTAMP
      `).run(ctx.userId);

      for (const id of allergenIds) {
        db.prepare(`
          INSERT OR IGNORE INTO user_allergens(user_id, allergen_id)
          VALUES (?, ?)
        `).run(ctx.userId, id);

        db.prepare(`
          INSERT INTO preference_allergens(user_id, food_id, allergen_id)
          VALUES (?, ?, ?)
        `).run(ctx.userId, food.id, id);
      }
    }

    // 일반 선호로 바꿔도 회원 전체 알레르기는 삭제하지 않습니다.
    db.exec('COMMIT');
    transactionStarted = false;

    return {
      ok: true,
      data: {
        food,
        preference: input.preference,
        reason,
        note,
        allergenIds
      }
    };
  } catch {
    if (transactionStarted) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '취향 저장에 실패했습니다.' }
    };
  }
}

export function listPreferences(
  db: DatabaseSync,
  ctx: AuthContext
): Result<FoodPreference[]> {
  try {
    if (!ctx?.userId ||
        !db.prepare('SELECT id FROM users WHERE id = ?').get(ctx.userId)) {
      return {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
      };
    }

    const rows = db.prepare(`
      SELECT
        f.id, f.name, f.category,
        p.preference, p.reason, p.note,
        a.allergen_id
      FROM user_food_preferences p
      JOIN foods f ON f.id = p.food_id
      LEFT JOIN preference_allergens a
        ON a.user_id = p.user_id AND a.food_id = p.food_id
      WHERE p.user_id = ?
      ORDER BY f.name, f.id, a.allergen_id
    `).all(ctx.userId);

    const items = new Map<string, FoodPreference>();

    for (const row of rows) {
      const id = String(row.id);
      let item = items.get(id);

      if (!item) {
        item = {
          food: {
            id,
            name: String(row.name),
            category: row.category as Food['category']
          },
          preference: row.preference as FoodPreference['preference'],
          reason: row.reason as FoodPreference['reason'],
          note: row.note as string | null,
          allergenIds: []
        };
        items.set(id, item);
      }

      if (row.allergen_id !== null) {
        item.allergenIds.push(String(row.allergen_id));
      }
    }

    return { ok: true, data: [...items.values()] };
  } catch {
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '취향 조회에 실패했습니다.' }
    };
  }
}

export function getAllergyProfile(
  db: DatabaseSync,
  ctx: AuthContext
): Result<import('../design/contracts.ts').UserAllergyProfile> {
  try {
    if (!ctx?.userId) {
      return {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
      };
    }

    const rows = db.prepare(`
      SELECT
        u.id AS user_id,
        COALESCE(p.status, 'not_set') AS status,
        a.allergen_id
      FROM users u
      LEFT JOIN user_allergy_profiles p ON p.user_id = u.id
      LEFT JOIN user_allergens a ON a.user_id = u.id
      WHERE u.id = ?
      ORDER BY a.allergen_id
    `).all(ctx.userId);

    if (rows.length === 0) {
      return {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: '등록된 회원이 아닙니다.' }
      };
    }

    return {
      ok: true,
      data: {
        userId: ctx.userId,
        status: rows[0].status as
          'not_set' | 'none_declared' | 'registered',
        allergenIds: rows
          .filter(row => row.allergen_id !== null)
          .map(row => String(row.allergen_id))
      }
    };
  } catch {
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '알레르기 조회에 실패했습니다.' }
    };
  }
}

export function removePreference(
  db: DatabaseSync,
  ctx: AuthContext,
  foodId: string
): Result<{ removed: boolean }> {
  try {
    db.exec('PRAGMA foreign_keys = ON');

    if (!ctx?.userId ||
        !db.prepare('SELECT id FROM users WHERE id = ?').get(ctx.userId)) {
      return {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
      };
    }

    if (typeof foodId !== 'string' || !foodId.trim()) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: '음식을 선택하세요.' }
      };
    }

    // 연결된 preference_allergens는 외래 키로 함께 삭제됩니다.
    // user_allergens와 음식 사전은 삭제하지 않습니다.
    const result = db.prepare(`
      DELETE FROM user_food_preferences
      WHERE user_id = ? AND food_id = ?
    `).run(ctx.userId, foodId);

    return {
      ok: true,
      data: { removed: Number(result.changes) > 0 }
    };
  } catch {
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '취향 삭제에 실패했습니다.' }
    };
  }
}