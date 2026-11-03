import type { Recommendation } from '../ai-recommendation/src/types';

export const recommendations: Recommendation[] = [
  {
    meal: 'lunch',
    menu: '고추장 돼지불고기',
    matchedFood: '제육볶음',
    type: 'similar',
    score: 0.92,
    reason: '돼지고기를 매콤한 양념에 볶은 메뉴로 제육볶음과 비슷해요.',
  },
  {
    meal: 'dinner',
    menu: '치즈돈까스',
    matchedFood: '돈까스',
    type: 'partial',
    score: 0.95,
    reason: '좋아하는 돈까스에 치즈를 더한 메뉴예요.',
  },
];
