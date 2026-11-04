import type {
  MealType, RecommendInput, Recommendation, MatchType
} from '../../ai-recommendation/src/types.js';

const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

export interface RecommendationPolicy {
  minSimilarityScore: number;
  sortBy: 'meal_then_score' | 'score_desc';
  dislikedMatch: 'exact' | 'exact_or_contains';
}

export const DEFAULT_POLICY: Readonly<RecommendationPolicy> = Object.freeze({
  minSimilarityScore: 0.7,
  sortBy: 'meal_then_score',
  dislikedMatch: 'exact_or_contains'
});

// 기존 비교 규칙 유지. 화면 표시와 알레르기 판단에는 사용하지 않습니다.
export function normalize(name: string): string {
  return name
    .replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）|［[^］]*］/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function normalizeList(list: string[]): string[] {
  const seen = new Set<string>();
  for (const item of list) {
    const value = normalize(item);
    if (value) seen.add(value);
  }
  return [...seen];
}

export function isDisliked(
  menu: string,
  dislikedNormalized: string[],
  mode: RecommendationPolicy['dislikedMatch'] = 'exact_or_contains'
): boolean {
  const value = normalize(menu);
  return dislikedNormalized.some(food =>
    value === food ||
    (mode === 'exact_or_contains' && food.length >= 2 && value.includes(food))
  );
}

export interface LikedFood {
  original: string;
  normalized: string;
}

export interface Match {
  food: LikedFood;
  type: Extract<MatchType, 'exact' | 'partial'>;
  score: number;
}

export function matchMenu(menu: string, liked: LikedFood[]): Match | null {
  const value = normalize(menu);
  if (!value) return null;

  const exact = liked.find(food => food.normalized === value);
  if (exact) return { food: exact, type: 'exact', score: 1 };

  let best: LikedFood | undefined;
  for (const food of liked) {
    if (
      food.normalized.length >= 2 &&
      value.includes(food.normalized) &&
      (!best || food.normalized.length > best.normalized.length)
    ) best = food;
  }
  return best ? { food: best, type: 'partial', score: 0.9 } : null;
}

function validatePolicy(policy: RecommendationPolicy): void {
  if (
    !Number.isFinite(policy.minSimilarityScore) ||
    policy.minSimilarityScore < 0 ||
    policy.minSimilarityScore > 1 ||
    !['meal_then_score','score_desc'].includes(policy.sortBy) ||
    !['exact','exact_or_contains'].includes(policy.dislikedMatch)
  ) throw new Error('추천 기준이 올바르지 않습니다.');
}

export function prepareComparison(
  input: RecommendInput,
  options: Partial<RecommendationPolicy> = {}
): { basic: Recommendation[]; aiInput: RecommendInput } {
  const policy = { ...DEFAULT_POLICY, ...options };
  validatePolicy(policy);

  const disliked = normalizeList(input.disliked);
  const seenLiked = new Set<string>();
  const liked: LikedFood[] = [];

  for (const raw of input.liked) {
    const value = normalize(raw);
    // 선호·비선호가 정확히 겹치면 비선호 우선.
    if (!value || seenLiked.has(value) || disliked.includes(value)) continue;
    seenLiked.add(value);
    liked.push({ original: raw.trim(), normalized: value });
  }

  const basic: Recommendation[] = [];
  const remaining: Record<MealType, string[]> = {
    breakfast: [], lunch: [], dinner: []
  };

  for (const meal of ORDER) {
    const seen = new Set<string>();
    for (const menu of input.meals[meal]) {
      const key = normalize(menu);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (isDisliked(menu, disliked, policy.dislikedMatch)) continue;

      const match = matchMenu(menu, liked);
      if (match) {
        basic.push({
          meal, menu,
          matchedFood: match.food.original,
          type: match.type,
          score: match.score,
          reason: match.type === 'exact'
            ? '선호 음식과 같은 메뉴'
            : `${match.food.original}가 들어간 메뉴`
        });
      } else {
        remaining[meal].push(menu);
      }
    }
  }

  return {
    basic,
    aiInput: {
      date: input.date,
      meals: remaining,
      liked: liked.map(food => food.original),
      disliked: [...input.disliked]
    }
  };
}

// AI가 만든 유사 추천 후보에 기준을 적용하고 기본 비교 결과와 합칩니다.
export function finalizeRecommendations(
  input: RecommendInput,
  similarCandidates: Recommendation[],
  options: Partial<RecommendationPolicy> = {}
): Recommendation[] {
  const policy = { ...DEFAULT_POLICY, ...options };
  validatePolicy(policy);

  const prepared = prepareComparison(input, policy);
  const disliked = normalizeList(input.disliked);
  const liked = new Map(
    prepared.aiInput.liked.map(food => [normalize(food), food])
  );
  const result = new Map<string, Recommendation>();

  for (const item of prepared.basic) {
    result.set(item.meal + '|' + normalize(item.menu), item);
  }

  for (const candidate of similarCandidates) {
    if (
      !candidate ||
      candidate.type !== 'similar' ||
      !ORDER.includes(candidate.meal) ||
      typeof candidate.menu !== 'string' ||
      typeof candidate.matchedFood !== 'string' ||
      typeof candidate.reason !== 'string' ||
      !Number.isFinite(candidate.score) ||
      candidate.score < policy.minSimilarityScore ||
      candidate.score > 1
    ) continue;

    // 실제 식단과 실제 선호 목록에 없는 AI 결과는 사용하지 않습니다.
    const originalMenu = prepared.aiInput.meals[candidate.meal].find(
      menu => normalize(menu) === normalize(candidate.menu)
    );
    const originalLiked = liked.get(normalize(candidate.matchedFood));

    if (!originalMenu || !originalLiked) continue;
    if (isDisliked(originalMenu, disliked, policy.dislikedMatch)) continue;

    const key = candidate.meal + '|' + normalize(originalMenu);
    const previous = result.get(key);

    if (!previous || candidate.score > previous.score) {
      result.set(key, {
        meal: candidate.meal,
        menu: originalMenu,
        matchedFood: originalLiked,
        type: 'similar',
        score: candidate.score,
        reason: candidate.reason.trim() || `${originalLiked}와 비슷한 메뉴`
      });
    }
  }

  return [...result.values()].sort((a, b) => {
    const mealDifference = ORDER.indexOf(a.meal) - ORDER.indexOf(b.meal);
    return (
      (policy.sortBy === 'meal_then_score' ? mealDifference : 0) ||
      b.score - a.score ||
      mealDifference ||
      a.menu.localeCompare(b.menu, 'ko')
    );
  });
}