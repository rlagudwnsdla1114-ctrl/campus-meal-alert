import { MealDataStore } from './index.ts';
import { FileStorage } from './file-storage.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 매 실행마다 독립된 폴더를 사용하므로 기존 사용자 데이터를 바꾸지 않습니다.
const directory = await mkdtemp(join(tmpdir(), 'campus-meal-demo-'));
try {
  const store = new MealDataStore(new FileStorage(directory));
  await store.addFood('liked', ' 제육 볶음 ');
  await store.updateFood('liked', '제육볶음', '계란말이');
  await store.addFood('disliked', '가지볶음');
  console.log('1. 취향 등록/수정:', await store.getPreferences());
  try { await store.addFood('liked', '계란 말이'); }
  catch (error) { console.log('2. 중복 차단:', (error as Error).message); }
  await store.addFood('liked', '김치');
  await store.removeFood('liked', '김치');
  await store.seedDemoMeals('2026-11-04');
  await store.importMeals({ '2026-11-05': { breakfast: ['계란말이'], lunch: ['돈까스'], dinner: ['불고기'] } });
  const reloaded = new MealDataStore(new FileStorage(directory));
  console.log('3. 파일에서 다시 조회:', await reloaded.getPreferences());
  console.log('4. 기간별 식단 날짜:', (await reloaded.listMeals('2026-11-04', '2026-11-05')).map(x => x.date));
  console.log('5. AI 입력:', JSON.stringify(await reloaded.getRecommendInput('2026-11-04'), null, 2));
  const backup = await reloaded.exportBackup();
  await reloaded.removeFood('liked', '계란말이');
  await reloaded.restoreBackup(backup);
  console.log('6. 백업 복원:', await reloaded.getPreferences());
} finally { await rm(directory, { recursive: true, force: true }); }
