import type { MealType, RecommendInput } from '../ai-recommendation/src/types.ts';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export type Meals = Record<MealType, string[]>;
export interface State { liked: string[]; disliked: string[]; menus: Record<string, Meals> }
const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
const emptyMeals = (): Meals => ({ breakfast: [], lunch: [], dinner: [] });
const emptyState = (): State => ({ liked: [], disliked: [], menus: {} });
function name(value: string): string {
  if (typeof value !== 'string') throw new Error('음식 이름은 문자열이어야 합니다.');
  const result = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!result) throw new Error('음식 이름을 입력하세요.');
  return result;
}
const key = (value: string): string => name(value).replace(/\s/g, '').toLowerCase();
function foods(values: string[]): string[] {
  if (!Array.isArray(values)) throw new Error('음식 목록은 배열이어야 합니다.');
  const seen = new Set<string>();
  return values.map(name).filter(value => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function date(value: string): void {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('존재하지 않는 날짜입니다.');
}
function meal(value: MealType): void {
  if (!mealTypes.includes(value)) throw new Error('올바른 끼니를 선택하세요.');
}
function validate(value: unknown): State {
  if (!value || typeof value !== 'object') throw new Error('저장 데이터가 올바르지 않습니다.');
  const state = value as State;
  const liked = foods(state.liked);
  const disliked = foods(state.disliked);
  if (liked.some(food => disliked.some(other => key(food) === key(other)))) throw new Error('선호와 비선호 음식이 겹칩니다.');
  if (!state.menus || typeof state.menus !== 'object' || Array.isArray(state.menus)) throw new Error('식단 데이터가 올바르지 않습니다.');
  const menus: Record<string, Meals> = {};
  for (const [day, entries] of Object.entries(state.menus)) {
    date(day);
    menus[day] = emptyMeals();
    for (const type of mealTypes) menus[day][type] = foods(entries[type]);
  }
  return { liked, disliked, menus };
}

/** 앱에서는 영구 저장소 어댑터를 전달하고, 테스트에서는 MemoryStorage를 사용합니다. */
export class MemoryStorage implements StorageAdapter {
  private values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
}

export class MealDataStore {
  private storage: StorageAdapter;
  private storageKey: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(storage: StorageAdapter, storageKey = 'campus-meal-data-v1') {
    this.storage = storage;
    this.storageKey = storageKey;
  }
  private async read(): Promise<State> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw === null ? emptyState() : validate(JSON.parse(raw));
  }
  private change(edit: (state: State) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const state = await this.read();
      edit(state);
      await this.storage.setItem(this.storageKey, JSON.stringify(state));
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async getPreferences(): Promise<{ liked: string[]; disliked: string[] }> {
    await this.queue;
    const { liked, disliked } = await this.read();
    return { liked, disliked };
  }
  /** 반대 목록에 있는 음식을 등록하면 새 취향으로 이동합니다. */
  addFood(kind: 'liked' | 'disliked', food: string): Promise<void> {
    return this.change(state => {
      if (kind !== 'liked' && kind !== 'disliked') throw new Error('올바른 취향을 선택하세요.');
      const value = name(food);
      const other = kind === 'liked' ? 'disliked' : 'liked';
      if (state[kind].some(item => key(item) === key(value))) throw new Error('이미 등록한 음식입니다.');
      state[other] = state[other].filter(item => key(item) !== key(value));
      state[kind].push(value);
    });
  }
  updateFood(kind: 'liked' | 'disliked', previous: string, next: string): Promise<void> {
    return this.change(state => {
      if (kind !== 'liked' && kind !== 'disliked') throw new Error('올바른 취향을 선택하세요.');
      const index = state[kind].findIndex(item => key(item) === key(previous));
      if (index < 0) throw new Error('수정할 음식을 찾을 수 없습니다.');
      const value = name(next);
      const other = kind === 'liked' ? 'disliked' : 'liked';
      if (state[kind].some((item, i) => i !== index && key(item) === key(value)) || state[other].some(item => key(item) === key(value))) throw new Error('이미 등록한 음식입니다.');
      state[kind][index] = value;
    });
  }
  removeFood(kind: 'liked' | 'disliked', food: string): Promise<void> {
    return this.change(state => {
      if (kind !== 'liked' && kind !== 'disliked') throw new Error('올바른 취향을 선택하세요.');
      const id = key(food);
      state[kind] = state[kind].filter(item => key(item) !== id);
    });
  }
  setMeal(day: string, type: MealType, menus: string[]): Promise<void> {
    return this.change(state => {
      date(day); meal(type);
      state.menus[day] ??= emptyMeals();
      state.menus[day][type] = foods(menus);
    });
  }
  async getMeals(day: string): Promise<Meals> {
    date(day);
    await this.queue;
    return (await this.read()).menus[day] ?? emptyMeals();
  }
  removeMeal(day: string, type: MealType): Promise<void> { return this.setMeal(day, type, []); }
  /** 주간 식단을 모두 검증한 뒤 한 번에 저장합니다. 오류가 있으면 전체 변경을 취소합니다. */
  importMeals(entries: Record<string, Meals>, overwrite = false): Promise<void> {
    return this.change(state => {
      const incoming = validate({ liked: [], disliked: [], menus: entries }).menus;
      for (const day of Object.keys(incoming)) {
        if (!overwrite && state.menus[day]) throw new Error(`${day} 식단이 이미 있습니다.`);
      }
      Object.assign(state.menus, incoming);
    });
  }
  async listMeals(from: string, to: string): Promise<{ date: string; meals: Meals }[]> {
    date(from); date(to);
    if (from > to) throw new Error('시작 날짜는 종료 날짜보다 늦을 수 없습니다.');
    await this.queue;
    const state = await this.read();
    return Object.keys(state.menus).sort().filter(day => day >= from && day <= to)
      .map(day => ({ date: day, meals: state.menus[day] }));
  }
  async exportBackup(): Promise<string> {
    await this.queue;
    return JSON.stringify({ version: 1, data: await this.read() }, null, 2);
  }
  /** 검증된 백업으로 전체 교체합니다. 호출 전에 화면에서 교체 안내가 필요합니다. */
  restoreBackup(json: string): Promise<void> {
    return this.change(state => {
      const backup = JSON.parse(json);
      if (!backup || backup.version !== 1) throw new Error('지원하지 않는 백업 버전입니다.');
      const valid = validate(backup.data);
      state.liked = valid.liked;
      state.disliked = valid.disliked;
      state.menus = valid.menus;
    });
  }
  async getRecommendInput(day: string): Promise<RecommendInput> {
    date(day);
    await this.queue;
    const state = await this.read();
    return { date: day, meals: state.menus[day] ?? emptyMeals(), liked: state.liked, disliked: state.disliked };
  }
  /** 수업 시연용 예시 식단. 실제 학교 식단이 아니며 기존 날짜는 덮어쓰지 않습니다. */
  seedDemoMeals(day: string): Promise<void> {
    return this.change(state => {
      date(day);
      if (state.menus[day]) return;
      state.menus[day] = {
        breakfast: ['쌀밥', '소고기미역국', '계란말이', '배추김치'],
        lunch: ['잡곡밥', '고추장 돼지불고기', '된장국', '콩나물무침'],
        dinner: ['쌀밥', '치즈돈까스', '양배추샐러드', '깍두기'],
      };
    });
  }
}
