export type MealType = "breakfast" | "lunch" | "dinner";

export interface RecommendInput {
  date: string; // "YYYY-MM-DD"
  meals: Record<MealType, string[]>;
  liked: string[];
  disliked: string[];
}

export type MatchType = "exact" | "partial" | "similar";

export interface Recommendation {
  meal: MealType;
  menu: string;
  matchedFood: string;
  type: MatchType;
  score: number;
  reason: string;
}

export interface RecommendOutput {
  date: string;
  status: "ok" | "fallback";
  recommendations: Recommendation[];
}

export const MEAL_ORDER: readonly MealType[] = ["breakfast", "lunch", "dinner"];
