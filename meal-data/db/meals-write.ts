import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { MealRecord, Result } from '../design/contracts.ts';

export interface SaveMealInput {
  cafeteriaId: string;
  date: string;
  mealType: MealRecord['mealType'];
  status: MealRecord['status'];
  items: MealRecord['items'];
  servingStyle: 'normal' | 'simple' | 'bento';
  notes: string[];
  editReason: string;
  replaceExisting?: boolean;
}

export function saveManualMeal(
  db: DatabaseSync,
  input: SaveMealInput
): Result<MealRecord> {
  const invalid = (message: string): Result<MealRecord> => ({
    ok: false,
    error: { code: 'INVALID_INPUT', message }
  });

  if (
    !input ||
    typeof input.cafeteriaId !== 'string' ||
    !input.cafeteriaId.trim() ||
    typeof input.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
  ) return invalid('식당과 날짜를 확인하세요.');

  const day = new Date(input.date + 'T00:00:00Z');

  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== input.date
  ) return invalid('존재하지 않는 날짜입니다.');

  if (!['breakfast','lunch','dinner'].includes(input.mealType)) {
    return invalid('끼니를 확인하세요.');
  }
  if (!['available','closed','unknown'].includes(input.status)) {
    return invalid('운영 상태를 확인하세요.');
  }
  if (!['normal','simple','bento'].includes(input.servingStyle)) {
    return invalid('제공 방식을 확인하세요.');
  }
  if (
    typeof input.editReason !== 'string' ||
    !input.editReason.trim() ||
    !Array.isArray(input.notes) ||
    input.notes.some(note => typeof note !== 'string')
  ) return invalid('변경 사유와 안내 목록을 확인하세요.');

  if (!Array.isArray(input.items)) {
    return invalid('음식 목록은 배열이어야 합니다.');
  }
  if (input.status === 'available' && input.items.length === 0) {
    return invalid('제공 식단에는 음식이 필요합니다.');
  }
  if (input.status !== 'available' && input.items.length > 0) {
    return invalid('휴무·미확인 상태에는 확정 메뉴를 저장하지 않습니다.');
  }

  const ids = new Set<string>();

  for (const item of input.items) {
    if (
      !item ||
      typeof item.foodId !== 'string' ||
      !item.foodId.trim() ||
      typeof item.rawText !== 'string' ||
      !item.rawText.trim() ||
      (item.note !== undefined && typeof item.note !== 'string')
    ) return invalid('음식 ID와 원문을 확인하세요.');

    if (ids.has(item.foodId)) return invalid('중복 음식이 있습니다.');
    ids.add(item.foodId);
  }

  let started = false;

  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.exec('BEGIN IMMEDIATE');
    started = true;

    const fail = (
      code: 'NOT_FOUND' | 'CONFLICT',
      message: string
    ): Result<MealRecord> => {
      db.exec('ROLLBACK');
      started = false;
      return { ok: false, error: { code, message } };
    };

    if (!db.prepare(
      'SELECT id FROM cafeterias WHERE id=?'
    ).get(input.cafeteriaId)) {
      return fail('NOT_FOUND', '식당을 찾을 수 없습니다.');
    }

    const existing = db.prepare(`
      SELECT * FROM meals
      WHERE cafeteria_id=? AND date=? AND meal_type=?
    `).get(input.cafeteriaId, input.date, input.mealType);

    if (existing && input.replaceExisting !== true) {
      return fail('CONFLICT', '이미 등록된 식단입니다. 수정 여부를 명시하세요.');
    }

    for (const item of input.items) {
      if (!db.prepare('SELECT id FROM foods WHERE id=?').get(item.foodId)) {
        return fail('NOT_FOUND', '존재하지 않는 음식입니다.');
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS meal_details (
        meal_id TEXT PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,
        serving_style TEXT CHECK(serving_style IN ('bento','simple')),
        notes_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS meal_write_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create','update')),
        reason TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const mealId = existing ? String(existing.id) : randomUUID();
    const before = existing ? {
      meal: existing,
      items: db.prepare(
        'SELECT * FROM meal_items WHERE meal_id=? ORDER BY sort_order'
      ).all(mealId),
      details: db.prepare(
        'SELECT * FROM meal_details WHERE meal_id=?'
      ).get(mealId) ?? null
    } : null;

    if (existing) {
      // 수동 수정본이므로 PDF 그대로의 식단으로 표시하지 않습니다.
      // 원래 source_id는 before_json에 보존합니다.
      db.prepare(`
        UPDATE meals SET status=?, source_id=NULL WHERE id=?
      `).run(input.status, mealId);

      db.prepare('DELETE FROM meal_items WHERE meal_id=?').run(mealId);
    } else {
      db.prepare(`
        INSERT INTO meals
        (id,cafeteria_id,date,meal_type,status)
        VALUES (?,?,?,?,?)
      `).run(
        mealId, input.cafeteriaId,
        input.date, input.mealType, input.status
      );
    }

    input.items.forEach((item, position) => {
      db.prepare(`
        INSERT INTO meal_items
        (id,meal_id,food_id,raw_text,sort_order,note)
        VALUES (?,?,?,?,?,?)
      `).run(
        randomUUID(), mealId, item.foodId,
        item.rawText.trim(), position, item.note ?? null
      );
    });

    db.prepare(`
      INSERT INTO meal_details(meal_id,serving_style,notes_json)
      VALUES (?,?,?)
      ON CONFLICT(meal_id) DO UPDATE SET
        serving_style=excluded.serving_style,
        notes_json=excluded.notes_json,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      mealId,
      input.servingStyle === 'normal' ? null : input.servingStyle,
      JSON.stringify(input.notes)
    );

    db.prepare(`
      INSERT INTO meal_write_log
      (meal_id,action,reason,before_json,after_json)
      VALUES (?,?,?,?,?)
    `).run(
      mealId,
      existing ? 'update' : 'create',
      input.editReason.trim(),
      before ? JSON.stringify(before) : null,
      JSON.stringify(input)
    );

    db.exec('COMMIT');
    started = false;

    return {
      ok: true,
      data: {
        id: mealId,
        cafeteriaId: input.cafeteriaId,
        date: input.date,
        mealType: input.mealType,
        status: input.status,
        ...(existing?.serving_start
          ? { servingStart: String(existing.serving_start) } : {}),
        ...(existing?.serving_end
          ? { servingEnd: String(existing.serving_end) } : {}),
        items: input.items.map(item => ({
          foodId: item.foodId,
          rawText: item.rawText.trim(),
          ...(item.note !== undefined ? { note: item.note } : {})
        }))
      }
    };
  } catch {
    if (started) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '식단 저장에 실패했습니다.' }
    };
  }
}

export function deleteManualMeal(
  db: DatabaseSync,
  input: Pick<
    SaveMealInput,
    'cafeteriaId' | 'date' | 'mealType' | 'editReason'
  >
): Result<{ removed: boolean; mealId: string | null }> {
  const invalid = (message: string) => ({
    ok: false as const,
    error: { code: 'INVALID_INPUT' as const, message }
  });

  if (
    !input ||
    typeof input.cafeteriaId !== 'string' ||
    !input.cafeteriaId.trim() ||
    typeof input.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !['breakfast','lunch','dinner'].includes(input.mealType) ||
    typeof input.editReason !== 'string' ||
    !input.editReason.trim()
  ) return invalid('식당·날짜·끼니·삭제 사유를 확인하세요.');

  const day = new Date(input.date + 'T00:00:00Z');
  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0,10) !== input.date
  ) return invalid('존재하지 않는 날짜입니다.');

  let started = false;

  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.exec('BEGIN IMMEDIATE');
    started = true;

    if (!db.prepare(
      'SELECT id FROM cafeterias WHERE id=?'
    ).get(input.cafeteriaId)) {
      db.exec('ROLLBACK');
      started = false;
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: '식당을 찾을 수 없습니다.' }
      };
    }

    const meal = db.prepare(`
      SELECT * FROM meals
      WHERE cafeteria_id=? AND date=? AND meal_type=?
    `).get(input.cafeteriaId, input.date, input.mealType);

    // 이미 없는 식단을 다시 삭제해도 오류로 취급하지 않습니다.
    if (!meal) {
      db.exec('COMMIT');
      started = false;
      return { ok: true, data: { removed: false, mealId: null } };
    }

    const mealId = String(meal.id);

    const hasDetails = db.prepare(`
      SELECT 1 FROM sqlite_master
      WHERE type='table' AND name='meal_details'
    `).get();

    const snapshot = {
      meal,
      items: db.prepare(`
        SELECT i.*, f.name AS food_name
        FROM meal_items i
        JOIN foods f ON f.id=i.food_id
        WHERE i.meal_id=?
        ORDER BY i.sort_order
      `).all(mealId),
      details: hasDetails ? db.prepare(
        'SELECT * FROM meal_details WHERE meal_id=?'
      ).get(mealId) ?? null : null,
      source: meal.source_id ? db.prepare(
        'SELECT * FROM meal_sources WHERE id=?'
      ).get(meal.source_id) ?? null : null
    };

    // 삭제 이력은 meals의 외래 키로 연결하지 않아 삭제 후에도 남습니다.
    db.exec(`
      CREATE TABLE IF NOT EXISTS meal_delete_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        before_json TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.prepare(`
      INSERT INTO meal_delete_log(meal_id,reason,before_json)
      VALUES (?,?,?)
    `).run(mealId, input.editReason.trim(), JSON.stringify(snapshot));

    // meal_items와 meal_details는 외래 키로 함께 삭제됩니다.
    db.prepare('DELETE FROM meals WHERE id=?').run(mealId);

    db.exec('COMMIT');
    started = false;

    return { ok: true, data: { removed: true, mealId } };
  } catch {
    if (started) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    return {
      ok: false,
      error: { code: 'STORAGE_ERROR', message: '식단 삭제에 실패했습니다.' }
    };
  }
}