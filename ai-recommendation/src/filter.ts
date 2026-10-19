import { normalize } from "./normalize.js";

/** 정리한 메뉴가 비선호와 같거나, 비선호(2글자 이상)를 포함하면 true */
export function isDisliked(menu: string, dislikedNormalized: string[]): boolean {
  const m = normalize(menu);
  return dislikedNormalized.some((d) => m === d || (d.length >= 2 && m.includes(d)));
}

/** 빈 값과 중복을 제거하고 정리된 형태로 돌려준다 */
export function normalizeList(list: string[]): string[] {
  const seen = new Set<string>();
  for (const item of list) {
    const n = normalize(item);
    if (n) seen.add(n);
  }
  return [...seen];
}
