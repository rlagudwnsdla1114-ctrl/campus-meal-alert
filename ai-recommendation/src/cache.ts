import { normalize } from "./normalize.js";

export interface CachedSimilarity {
  score: number; // 0이면 "비교했지만 비슷하지 않음"
  reason: string;
}

/** `선호 음식|메뉴` 조합별 AI 판단 결과 캐시 (메모리) */
export class SimilarityCache {
  private readonly store = new Map<string, CachedSimilarity>();

  private key(food: string, menu: string): string {
    return `${normalize(food)}|${normalize(menu)}`;
  }
  get(food: string, menu: string): CachedSimilarity | undefined {
    return this.store.get(this.key(food, menu));
  }
  set(food: string, menu: string, value: CachedSimilarity): void {
    this.store.set(this.key(food, menu), value);
  }
  clear(): void {
    this.store.clear();
  }
}

export const defaultCache = new SimilarityCache();
