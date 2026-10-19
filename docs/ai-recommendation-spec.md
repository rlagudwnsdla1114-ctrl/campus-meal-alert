# AI 유사 음식 추천 모듈 명세 (초안)

- 담당: 강서원 / 브랜치: `seowon`
- 상태: **초안** — 강영웅·김형준 확인 후 확정
- 언어: TypeScript (React Native 앱, Firebase Functions 등 서버 함수 어느 쪽에서도 재사용 가능)

## 1. 역할

선호 음식, 그날 식단, 비선호 음식을 받아 **추천할 메뉴 목록**을 돌려준다.
이름이 같은 메뉴는 코드로 바로 찾고, 이름이 다른 메뉴만 AI로 비슷한지 판단한다.

```
입력 (강영웅 데이터) → recommend() → 출력 (김형준 화면·알림)
```

## 2. 입력 형식

```ts
type MealType = "breakfast" | "lunch" | "dinner";

interface RecommendInput {
  date: string;                          // "YYYY-MM-DD"
  meals: Record<MealType, string[]>;     // 끼니별 메뉴 이름, 메뉴가 없으면 빈 배열
  liked: string[];                       // 선호 음식
  disliked: string[];                    // 비선호 음식 (싫어요 누른 음식)
}
```

```json
{
  "date": "2026-10-20",
  "meals": {
    "breakfast": ["미역국", "계란말이"],
    "lunch": ["고추장 돼지불고기", "콩나물국"],
    "dinner": ["치즈돈까스", "샐러드"]
  },
  "liked": ["제육볶음", "돈까스"],
  "disliked": ["카레"]
}
```

## 3. 출력 형식

```ts
type MatchType = "exact" | "partial" | "similar";

interface Recommendation {
  meal: MealType;        // 어느 끼니에 나오는지
  menu: string;          // 식단에 적힌 메뉴 이름 (원문 그대로)
  matchedFood: string;   // 어떤 선호 음식 때문에 추천됐는지
  type: MatchType;       // exact: 같음 / partial: 이름 포함 / similar: AI 판단
  score: number;         // 0~1, 높을수록 비슷함
  reason: string;        // 화면에 보여줄 짧은 이유
}

interface RecommendOutput {
  date: string;
  status: "ok" | "fallback";   // fallback: AI 실패로 exact/partial 결과만 반환
  recommendations: Recommendation[];
}
```

```json
{
  "date": "2026-10-20",
  "status": "ok",
  "recommendations": [
    { "meal": "lunch", "menu": "고추장 돼지불고기", "matchedFood": "제육볶음",
      "type": "similar", "score": 0.85, "reason": "매콤한 돼지고기 볶음류" },
    { "meal": "dinner", "menu": "치즈돈까스", "matchedFood": "돈까스",
      "type": "partial", "score": 0.9, "reason": "돈까스가 들어간 메뉴" }
  ]
}
```

- 정렬: 조식 → 중식 → 석식, 같은 끼니 안에서는 score 높은 순
- 같은 끼니의 같은 메뉴는 한 번만 나온다 (score가 가장 높은 선호 음식 기준)
- 추천이 없으면 `recommendations: []`

## 4. 처리 규칙

| 순서 | 단계 | 규칙 |
| --- | --- | --- |
| 1 | 정리 | 비교할 때만 공백 제거, 괄호와 괄호 안 내용 제거, 영문 소문자. 출력은 원문 그대로 |
| 2 | 비선호 제외 | 정리한 메뉴가 비선호 음식과 같거나, 비선호 음식(2글자 이상)을 포함하면 제외 |
| 3 | exact | 정리한 이름이 같으면 score 1.0 |
| 4 | partial | 선호 음식(2글자 이상)이 메뉴 이름에 포함되면 score 0.9 (예: 돈까스 → 치즈돈까스) |
| 5 | similar | 3·4에 걸리지 않은 메뉴만 AI에 비교 요청, score **0.7 이상**만 추천 |
| 6 | 최종 확인 | 비선호 제외를 한 번 더 적용 |

## 5. AI 호출 규칙

- 남은 메뉴 × 선호 음식을 **한 번의 요청으로 묶어서** 보낸다
- AI에게 JSON으로만 답하도록 요청한다: `[{ "menu", "matchedFood", "score", "reason" }]`
- 제한 시간 10초
- 이미 비교한 `선호 음식|메뉴` 조합은 캐시해서 다시 묻지 않는다
- AI 제공자는 교체할 수 있게 인터페이스로 분리한다 (기본: Gemini, 테스트: Mock)
- 기본 모델은 `gemini-3.8-flash`이고, `.env`의 `GEMINI_MODEL`로 바꿀 수 있다 (`gemini-2.5-flash`는 신규 사용자에게 제공되지 않음)
- API 키는 `.env`의 `GEMINI_API_KEY`로만 읽는다. 키는 커밋하지 않는다

## 6. 오류 처리

어떤 경우에도 예외를 밖으로 던지지 않고 결과를 돌려준다.

| 상황 | 처리 |
| --- | --- |
| AI 응답 없음, 시간 초과, 네트워크 오류 | exact/partial 결과만 반환, `status: "fallback"` |
| AI 응답이 JSON이 아니거나 형식이 다름 | 위와 같음 |
| AI가 식단에 없는 메뉴나 등록하지 않은 선호 음식을 답함 | 그 항목만 버림 |
| score가 숫자가 아니거나 0~1 밖 | 그 항목만 버림 |
| 입력에 빈 문자열, 중복 메뉴 | 무시하고 진행 |
| 선호 음식이 없음 | AI 호출 없이 `recommendations: []` |

## 7. 사용 예

```ts
import { recommend } from "./ai-recommendation/src";

const result = await recommend(input);
if (result.status === "fallback") {
  // AI 없이 이름이 같은 메뉴만 추천된 상태
}
```

## 8. 팀 확인 필요

- **강영웅**: 식단·선호·비선호 데이터를 2번 입력 형식으로 줄 수 있는지 (날짜 형식, 끼니 키 이름)
- **김형준**: 3번 출력 필드가 메인 화면, 추천 확인 화면, 알림에 충분한지
- **공통**: AI API 키를 앱이 아닌 서버 함수에 둘지 (앱에 넣으면 키가 노출됨)
