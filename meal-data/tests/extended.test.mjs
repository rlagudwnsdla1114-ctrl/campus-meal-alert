import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { MealDataStore, MemoryStorage } from '../index.ts';
import { FileStorage } from '../file-storage.ts';
const menu = { breakfast: ['밥'], lunch: ['돈까스'], dinner: [] };
test('파일 저장 후 별도 Node 프로세스에서도 재조회', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'meal-test-'));
  try {
    const store = new MealDataStore(new FileStorage(dir));
    await store.addFood('liked', '계란말이');
    const script = `import { MealDataStore } from ${JSON.stringify(new URL('../index.ts', import.meta.url).href)}; import { FileStorage } from ${JSON.stringify(new URL('../file-storage.ts', import.meta.url).href)}; console.log(JSON.stringify(await new MealDataStore(new FileStorage(${JSON.stringify(dir)})).getPreferences()));`;
    const actual = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    assert.deepEqual(actual, { liked: ['계란말이'], disliked: [] });
    assert.deepEqual(await readdir(dir), ['campus-meal-data-v1.json']);
    await assert.rejects(new FileStorage(dir).setItem('../escape', '{}'), /저장 키/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('주간 식단 일괄 등록과 기간별 정렬 조회', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await store.importMeals({ '2026-11-05': menu, '2026-11-04': menu });
  assert.deepEqual((await store.listMeals('2026-11-04', '2026-11-05')).map(x => x.date), ['2026-11-04', '2026-11-05']);
  assert.equal((await store.listMeals('2026-11-05', '2026-11-05')).length, 1);
  await assert.rejects(store.listMeals('2026-11-06', '2026-11-04'), /시작/);
});
test('일괄 등록 중 오류나 기존 날짜 충돌이 있으면 전체 취소', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await assert.rejects(store.importMeals({ '2026-11-04': menu, '2026-02-30': menu }));
  assert.deepEqual(await store.listMeals('2026-01-01', '2026-12-31'), []);
  await store.importMeals({ '2026-11-04': menu });
  await assert.rejects(store.importMeals({ '2026-11-05': menu, '2026-11-04': menu }));
  assert.equal((await store.listMeals('2026-01-01', '2026-12-31')).length, 1);
  await store.importMeals({ '2026-11-04': { ...menu, lunch: ['불고기'] } }, true);
  assert.deepEqual((await store.getMeals('2026-11-04')).lunch, ['불고기']);
});
test('백업 버전 및 내용 검증, 전체 복원', async () => {
  const store = new MealDataStore(new MemoryStorage());
  await store.addFood('liked', '계란말이');
  await store.importMeals({ '2026-11-04': menu });
  const backup = await store.exportBackup();
  await store.removeFood('liked', '계란말이');
  await store.restoreBackup(backup);
  assert.deepEqual((await store.getPreferences()).liked, ['계란말이']);
  assert.deepEqual((await store.getMeals('2026-11-04')).lunch, ['돈까스']);
  await assert.rejects(store.restoreBackup('{"version":2}'), /버전/);
  await assert.rejects(store.restoreBackup('{"version":1,"data":{}}'));
  assert.equal(await store.exportBackup(), backup);
});
