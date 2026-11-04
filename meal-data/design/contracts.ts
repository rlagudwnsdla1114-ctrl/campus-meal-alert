import type { MealType, RecommendInput } from '../../ai-recommendation/src/types.ts';

export type FoodCategory = 'staple' | 'soup' | 'main' | 'side' | 'kimchi' | 'dessert_drink' | 'unknown';
export type Preference = 'liked' | 'disliked';
export type ErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'CONFLICT' | 'REVIEW_REQUIRED' | 'STORAGE_ERROR';
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
/** 인증 계층에서 확인한 사용자 정보. 요청 본문의 userId를 그대로 신뢰하지 않습니다. */
export interface AuthContext { userId: string }
export interface Food { id: string; name: string; category: FoodCategory }
export interface FoodPreference { food: Food; preference: Preference }
export interface MealItem { foodId: string; rawText: string; note?: string }
export interface MealRecord {
  id: string; cafeteriaId: string; date: string; mealType: MealType;
  status: 'available' | 'closed' | 'unknown';
  servingStart?: string; servingEnd?: string; items: MealItem[];
}
export interface ParsedItem {
  rawText: string;
  name: string;
  category: FoodCategory;
  reviewReasons: string[];
}
export interface ParsedMeal {
  date: string; mealType: MealType; items: ParsedItem[];
}
export interface ImportDraft {
  sourceId: string; cafeteriaId: string;
  yearConfirmed: boolean; meals: ParsedMeal[];
}

/** 다음 단계에서 구현할 모듈 계약입니다. DB 연결과 인증이 구현되었다는 의미는 아닙니다. */
export interface PreferenceModule {
  set(ctx: AuthContext, input: { foodId: string; preference: Preference }): Promise<Result<FoodPreference>>;
  remove(ctx: AuthContext, foodId: string): Promise<Result<{ removed: boolean }>>;
  list(ctx: AuthContext): Promise<Result<FoodPreference[]>>;
}
export interface FoodCatalogModule {
  create(input: { name: string; category: FoodCategory }): Promise<Result<Food>>;
  rename(foodId: string, name: string): Promise<Result<Food>>;
  search(query: string): Promise<Result<Food[]>>;
}
export interface MealModule {
  list(input: { cafeteriaId: string; from: string; to: string }): Promise<Result<MealRecord[]>>;
  save(input: Omit<MealRecord, 'id'>): Promise<Result<MealRecord>>;
}
export interface RecommendationDataModule {
  buildInput(ctx: AuthContext, input: { cafeteriaId: string; date: string }): Promise<Result<RecommendInput>>;
}
