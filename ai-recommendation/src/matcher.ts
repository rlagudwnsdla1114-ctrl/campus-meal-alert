import { normalize } from "./normalize.js";
import type { MatchType } from "./types.js";

export interface LikedFood {
  original: string;
  normalized: string;
}

export interface Match {
  food: LikedFood;
  type: Extract<MatchType, "exact" | "partial">;
  score: number;
}

/** 이름이 같으면 exact(1.0), 선호 음식(2글자 이상)이 메뉴에 포함되면 partial(0.9). 없으면 null */
export function matchMenu(menu: string, liked: LikedFood[]): Match | null {
  const m = normalize(menu);
  if (!m) return null;
  const exact = liked.find((f) => f.normalized === m);
  if (exact) return { food: exact, type: "exact", score: 1.0 };
  let best: LikedFood | undefined;
  for (const f of liked) {
    if (f.normalized.length >= 2 && m.includes(f.normalized)) {
      if (!best || f.normalized.length > best.normalized.length) best = f;
    }
  }
  return best ? { food: best, type: "partial", score: 0.9 } : null;
}
