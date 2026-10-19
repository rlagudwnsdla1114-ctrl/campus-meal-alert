import { SimilarityCache, defaultCache } from "./cache.js";
import { isDisliked, normalizeList } from "./filter.js";
import { matchMenu, type LikedFood } from "./matcher.js";
import { normalize } from "./normalize.js";
import { parseResponse } from "./ai/parseResponse.js";
import { GeminiProvider } from "./ai/geminiProvider.js";
import type { SimilarityProvider } from "./ai/provider.js";
import {
  MEAL_ORDER,
  type MealType,
  type RecommendInput,
  type RecommendOutput,
  type Recommendation,
} from "./types.js";

export const SIMILAR_THRESHOLD = 0.7;
export const DEFAULT_TIMEOUT_MS = 10_000;

export interface RecommendOptions {
  cache?: SimilarityCache;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI 응답 시간 초과 (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function uniqueFoods(list: string[]): LikedFood[] {
  const seen = new Set<string>();
  const out: LikedFood[] = [];
  for (const raw of list ?? []) {
    const original = typeof raw === "string" ? raw.trim() : "";
    const normalized = normalize(original);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ original, normalized });
  }
  return out;
}

/** 어떤 경우에도 예외를 던지지 않고 결과를 돌려준다. */
export async function recommend(
  input: RecommendInput,
  provider?: SimilarityProvider,
  options: RecommendOptions = {},
): Promise<RecommendOutput> {
  const cache = options.cache ?? defaultCache;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const date = input?.date ?? "";

  const disliked = normalizeList(input?.disliked ?? []);
  // 선호와 비선호에 같은 음식이 있으면 비선호가 우선
  const liked = uniqueFoods(input?.liked ?? []).filter((f) => !disliked.includes(f.normalized));
  if (liked.length === 0) return { date, status: "ok", recommendations: [] };

  const found: Recommendation[] = [];
  // 정리한 메뉴 이름 → 그 메뉴가 나오는 끼니들 (AI 후보)
  const candidates = new Map<string, { original: string; meals: MealType[] }>();

  for (const meal of MEAL_ORDER) {
    const seen = new Set<string>();
    for (const raw of input?.meals?.[meal] ?? []) {
      if (typeof raw !== "string") continue;
      const key = normalize(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (isDisliked(raw, disliked)) continue;

      const match = matchMenu(raw, liked);
      if (match) {
        found.push({
          meal,
          menu: raw,
          matchedFood: match.food.original,
          type: match.type,
          score: match.score,
          reason: match.type === "exact" ? "선호 음식과 같은 메뉴" : `${match.food.original}가 들어간 메뉴`,
        });
      } else {
        const c = candidates.get(key);
        if (c) c.meals.push(meal);
        else candidates.set(key, { original: raw, meals: [meal] });
      }
    }
  }

  let status: RecommendOutput["status"] = "ok";
  const similar: Recommendation[] = [];

  if (candidates.size > 0) {
    // 캐시에 없는 조합이 있는 메뉴만 AI에 요청
    const toAsk = [...candidates.values()].filter((c) =>
      liked.some((f) => !cache.get(f.original, c.original)),
    );

    if (toAsk.length > 0) {
      const menus = toAsk.map((c) => c.original);
      const foods = liked.map((f) => f.original);
      try {
        // 제공자를 주입하지 않으면 기본값(Gemini). 키가 없으면 생성 시 예외 → fallback
        const ai = provider ?? new GeminiProvider({ timeoutMs });
        const raw = await withTimeout(ai.compare({ menus, liked: foods }), timeoutMs);
        const items = parseResponse(raw, menus, foods);
        if (!items) throw new Error("AI 응답 형식 오류");
        for (const menu of menus) for (const food of foods) cache.set(food, menu, { score: 0, reason: "" });
        for (const it of items) cache.set(it.matchedFood, it.menu, { score: it.score, reason: it.reason });
      } catch {
        status = "fallback";
      }
    }

    if (status === "ok") {
      for (const c of candidates.values()) {
        let best: { food: LikedFood; score: number; reason: string } | undefined;
        for (const f of liked) {
          const hit = cache.get(f.original, c.original);
          if (hit && hit.score >= SIMILAR_THRESHOLD && (!best || hit.score > best.score)) {
            best = { food: f, score: hit.score, reason: hit.reason };
          }
        }
        if (!best) continue;
        for (const meal of c.meals) {
          similar.push({
            meal,
            menu: c.original,
            matchedFood: best.food.original,
            type: "similar",
            score: best.score,
            reason: best.reason || `${best.food.original}와 비슷한 메뉴`,
          });
        }
      }
    }
  }

  // 최종 확인: 비선호 제외 재적용, 같은 끼니 같은 메뉴는 score 높은 것 하나만
  const dedup = new Map<string, Recommendation>();
  for (const r of [...found, ...similar]) {
    if (isDisliked(r.menu, disliked)) continue;
    const key = `${r.meal}|${normalize(r.menu)}`;
    const prev = dedup.get(key);
    if (!prev || r.score > prev.score) dedup.set(key, r);
  }
  const recommendations = [...dedup.values()].sort(
    (a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) || b.score - a.score,
  );

  return { date, status, recommendations };
}
