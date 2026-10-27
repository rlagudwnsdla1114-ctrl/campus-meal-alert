import type { MealType } from '../ai-recommendation/src/types';

export const mealNames: Record<MealType, string> = {
  breakfast: '조식',
  lunch: '중식',
  dinner: '석식',
};

export const meals: Record<MealType, string[]> = {
  breakfast: ['쌀밥', '소고기미역국', '계란말이', '배추김치'],
  lunch: ['잡곡밥', '고추장 돼지불고기', '된장국', '콩나물무침', '배추김치'],
  dinner: ['쌀밥', '치즈돈까스', '양배추샐러드', '크림스프', '깍두기'],
};
