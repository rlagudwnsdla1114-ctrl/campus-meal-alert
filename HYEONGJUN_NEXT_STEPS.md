<!-- REQUIREMENTS_CHECKLIST_START -->

## 요청사항 구현 체크리스트

담당 데이터 모듈과 기본 비교·추천 기준 구현은 완료했고 테스트를 통과했다.
아래 완료 표시는 모듈 구현 기준이며, 전체 앱 연동 완료를 의미하지 않는다.

### 1. 실제 식단 데이터 — 완료

- [x] 날짜 기준 식단 조회
- [x] 아침·점심·저녁 음식 목록을 각각 배열로 반환
- [x] 휴무·운영 미확인·미등록 상태 구분
- [x] 식단 등록·수정·삭제
- [x] 중복 음식·잘못된 입력 검사

사용 함수: getDailyMeals(db, { cafeteriaId, date })

반환 데이터:
- date: 조회 날짜
- cafeteriaId: 식당 ID
- meals.breakfast: 아침 음식명 배열
- meals.lunch: 점심 음식명 배열
- meals.dinner: 저녁 음식명 배열
- mealStatus: 각 끼니의 운영 상태

### 2. 사용자별 선호 음식 목록 — 완료

- [x] 사용자 ID별 데이터 분리
- [x] 선호 음식 등록·수정·삭제·조회
- [x] 추천 입력에 liked 음식명 배열 제공

사용 함수:
- savePreference(): 등록
- updateLikedFood(): 선호 음식 변경
- removePreference(): 삭제
- listPreferences(): 취향 조회
- getRecommendationInput(): 추천용 배열 구성

주의: 저장할 때는 음식명이 아닌 기존 foodId를 사용한다.
음식 검색·선택 API는 별도 연결이 필요하다.

### 3. 사용자별 비선호 음식 목록 — 완료

- [x] 사용자별 비선호 음식 저장·조회·삭제
- [x] 비선호 이유 저장: 취향·식감 / 알레르기 / 기타
- [x] 알레르기 선택 시 성분 ID 연결
- [x] 추천 입력에 disliked 음식명 배열 제공

비선호 저장은 savePreference()를 사용한다.
알레르기를 이유로 저장할 때는 유효한 allergenIds가 필요하다.

주의: 비선호 음식명 제외 기능은 구현되어 있다.
알레르기 저장 기능도 구현되어 있지만, 메뉴 성분과 대조하는 추천 필터는 아직 연결되지 않았다.
취향을 삭제해도 사용자 전체 알레르기 정보는 자동 삭제하지 않는다.

### 4. 선호 음식과 학식 메뉴 비교 — 모듈 구현 완료

- [x] 비교한 선호 음식: matchedFood
- [x] 학식 메뉴: menu
- [x] 일치 유형: exact / partial / similar
- [x] 점수: score
- [x] 완전 일치·부분 일치 비교
- [x] AI에 전달할 나머지 메뉴 분리
- [x] 전달받은 AI 유사 추천 후보 검증·병합

사용 함수:
- prepareComparison(input, policy)
- finalizeRecommendations(input, aiCandidates, policy)

기본 점수:
- 완전 일치: 1.0
- 부분 일치: 0.9
- 유사 일치: AI가 반환한 점수를 검증해 사용

남은 연결:
- [ ] 실제 AI 호출과 공통 비교 모듈을 하나의 실행 흐름으로 연결

### 5. 추천 기준 — 모듈 구현 완료

- [x] 유사도 최소 점수: minSimilarityScore
- [x] 추천 정렬 기준: sortBy
- [x] 비선호 음식 제외 기준: dislikedMatch
- [x] 잘못된 정책 값 검사
- [x] 중복 추천 제거·정렬

기본 정책:
- minSimilarityScore: 0.7
- sortBy: meal_then_score
- dislikedMatch: exact_or_contains

선택 가능한 정렬 기준:
- meal_then_score: 끼니 순서 후 점수순
- score_desc: 점수 내림차순

선택 가능한 비선호 제외 기준:
- exact: 이름 완전 일치 시 제외
- exact_or_contains: 이름 완전 일치 또는 포함 관계 시 제외

최소 유사도는 AI 유사 추천에 적용하며 완전·부분 일치에는 적용하지 않는다.

주의: 기존 AI recommend.ts의 고정 기준을 전부 교체한 상태는 아니다.
통합 호출부에서 공통 정책을 적용하도록 연결해야 한다.

### 6. 최종 추천 결과 — 규격 및 목록 처리 구현 완료

- [x] 날짜: date
- [x] 추천 처리 상태: status
- [x] 끼니: meal
- [x] 추천 메뉴: menu
- [x] 연결된 선호 음식: matchedFood
- [x] 일치 유형: type
- [x] 점수: score
- [x] 추천 이유: reason
- [x] 추천 목록 검증·중복 제거·정렬

최종 응답 구조:
- date
- status
- recommendations 배열
  - meal
  - menu
  - matchedFood
  - type
  - score
  - reason

status 의미:
- ok: 정상 처리
- fallback: AI 처리 실패 시 기본 비교 결과로 대체

추천이 없다는 이유만으로 fallback을 사용하지 않는다.
finalizeRecommendations()는 추천 목록을 반환하므로 호출부에서 date와 status를 함께 구성한다.

남은 연결:
- [ ] DB 조회 → 기본 비교 → 실제 AI 호출 → 최종 응답 통합 검증
- [ ] 모바일 화면에 최종 추천 결과 표시
- [ ] 추천 알림 및 알림 선택 시 화면 이동

### 테스트 확인

- [x] 데이터 모듈 테스트 통과
- [x] 추천 공통 모듈 테스트 6개 통과
- [x] AI 모듈 테스트 42개 통과
- [x] AI 및 연결된 공통 코드 타입 검사 통과
- [ ] 모바일·DB·AI 전체 연동 테스트

### 형준이 연결할 때 확인할 내용

1. 모바일에서 node:sqlite 모듈을 직접 import하지 않는다.
   Node 서버의 HTTP API를 통해 데이터 모듈을 호출한다.
   HTTP API는 아직 별도 구현이 필요하다.

2. 인증된 사용자 ID를 ctx.userId로 전달한다.
   현재 데이터 함수는 전달받은 사용자 ID를 사용하며 로그인 자체를 구현하지 않는다.

3. 메인 식단 화면은 getDailyMeals() 결과를 사용한다.
   표시용 식단 조회와 추천용 입력 조회는 구분한다.

4. 추천 입력은 getRecommendationInput()으로 구성한다.
   미등록·운영 미확인 끼니 또는 검토 미확정 음식이 있으면 추천 입력이 차단될 수 있다.

5. prepareComparison()으로 기본 비교와 AI 입력을 분리한다.
   서원의 AI 모듈에 남은 후보를 전달하고,
   반환된 후보를 finalizeRecommendations()로 검증한다.

6. 추천 메뉴의 싫어요 저장에는 실제 추천 메뉴의 foodId를 사용한다.
   연결된 선호 음식 matchedFood의 ID를 대신 저장하지 않는다.
   현재 추천 결과는 음식명 중심이므로 DB의 음식 ID와 연결하는 처리가 필요하다.

7. 알레르기 성분 기반 제외, 음식 검색 API,
   사용자 전체 알레르기 설정 변경 API는 추가 구현 또는 담당자 협의가 필요하다.

8. prototype 화면은 localStorage를 사용하는 시연용 UI이다.
   실제 DB·로그인·모바일 앱과 연결된 상태는 아니다.

인수인계 상태:
담당 데이터 관리·기본 비교·추천 기준 모듈 구현 및 테스트 완료.
실제 AI 실행 흐름과 모바일 화면·알림 연결은 통합 작업이 필요하다.

<!-- REQUIREMENTS_CHECKLIST_END -->

# 형준용 데이터 모듈 사용 설명서

이 문서는 실제 구현된 함수의 호출 방법이다.
작업 계획보다 파일 경로·입력·반환값·화면 연결 지점을 우선 정리했다.

## 1. 실행 위치와 연결 경계

현재 DB 함수는 Node.js의 node:sqlite를 사용한다.
Expo App.tsx에서 직접 import하지 않는다.

실제 구조:
- Node 실행 계층: DB 연결 후 아래 함수 호출
- 모바일: 서버 API 등을 통해 반환값을 받아 표시
- 서버 HTTP API는 아직 구현되어 있지 않다.

즉 아래 예시는 Node에서 바로 사용할 수 있는 호출 코드다.
모바일에서 호출할 HTTP 경로가 이미 있다는 뜻은 아니다.

Node.js 22.18 이상 기준.
meal-data와 ai-recommendation 폴더는 함께 가져와야 한다.

## 2. DB 열기

프로젝트 루트에서 실행되는 Node 코드 기준:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve('meal-data/local-data/campus-meal.db');

if (!existsSync(dbPath)) {
  throw new Error('실제 식단 DB가 없습니다. 영웅에게 공통 식단 데이터 전달을 요청하세요.');
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys=ON');

// 아래 함수들에 db를 전달.
// 서버 종료 시 db.close().
```

주의:
- Git pull만으로 실제 로컬 DB가 전달되지는 않는다.
- migrate.py는 기본 구조 생성용이며 실제 식단 자동 복원 명령이 아니다.
- API 요청마다 새 DB를 무조건 만들지 말고 연결 수명과 종료 처리를 정한다.
- 인증은 별도 계층에서 처리한다.

## 3. 모든 DB 함수의 반환값

성공:
```ts
{ ok: true, data: ... }
```

실패:
```ts
{
  ok: false,
  error: {
    code: 'INVALID_INPUT',
    message: '사용자에게 안내할 오류'
  }
}
```

사용 예:
```ts
if (!result.ok) {
  // 화면에 result.error.message 표시
  // code 기준으로 로그인 안내·중복 안내 등을 구분
  return;
}
const data = result.data;
```

오류 코드:
- INVALID_INPUT: 잘못된 입력
- UNAUTHENTICATED: 회원 확인 실패
- NOT_FOUND: 없는 대상
- CONFLICT: 중복 등록 등
- REVIEW_REQUIRED: 데이터 검토 필요
- STORAGE_ERROR: 저장소 오류

## 4. 메인 화면: 날짜별 식단 가져오기

가져올 파일:
meal-data/db/meals.ts

호출:
```ts
import { getDailyMeals } from './meal-data/db/meals.ts';

const result = getDailyMeals(db, {
  cafeteriaId: 'campus-main',
  date: '2026-11-04'
});
```

성공 data 형식:
```ts
{
  cafeteriaId: 'campus-main',
  date: '2026-11-04',
  meals: {
    breakfast: ['브레드', '...'],
    lunch: ['백미밥', '...'],
    dinner: ['백미밥', '...']
  },
  mealStatus: {
    breakfast: 'available',
    lunch: 'available',
    dinner: 'available'
  }
}
```

위 음식 배열은 응답 형식 예시이며 실제 목록은 DB에서 반환된다.

현재 App.tsx의 교체 지점:
- mobile/meals.ts의 고정 meals 대신 result.data.meals 사용.
- 날짜 표시는 result.data.date 기준.
- 기존 끼니 필터 breakfast/lunch/dinner는 그대로 사용 가능.

상태별 문구:

| mealStatus | 화면 |
|---|---|
| available | meals의 음식 목록 |
| closed | 휴무 |
| unknown | 운영 정보를 확인 중이에요 |
| not_registered | 등록된 식단이 없어요 |

빈 배열만 보고 휴무로 표시하지 않는다.
이 함수는 화면 표시용이므로 음식 검토 상태가 pending이어도 목록을 반환할 수 있다.

## 5. 취향 화면: 목록 조회

가져올 파일:
meal-data/db/preferences.ts

```ts
import { listPreferences } from './meal-data/db/preferences.ts';

// 서버가 로그인 결과에서 확인한 실제 회원 ID 사용.
const ctx = { userId: authenticatedUserId };

const result = listPreferences(db, ctx);
```

성공 data는 배열:
```ts
[
  {
    food: { id: '음식ID', name: '돈까스', category: 'main' },
    preference: 'liked',
    reason: null,
    note: null,
    allergenIds: []
  }
]
```

화면 연결:
- food.name: 음식명
- preference === 'liked': 선호 목록
- preference === 'disliked': 비선호 목록
- reason, note: 이유·메모
- food.id: 수정·삭제에 전달할 ID

## 6. 음식 등록 버튼

```ts
import { savePreference } from './meal-data/db/preferences.ts';

const result = savePreference(db, ctx, {
  foodId: selectedFoodId,
  preference: 'liked'
});
```

성공하면 listPreferences를 다시 호출해 목록을 갱신한다.

중요:
- 문자열 음식명이 아니라 DB에 존재하는 foodId를 받는다.
- 음식 선택 UI용 검색 API는 아직 없다.
- 자유 입력을 지원하려면 음식 사전 조회·신규 등록 계층을 추가해야 한다.
- HTML 프로토타입의 자유 입력을 그대로 이 함수에 넘기면 안 된다.

## 7. 선호 음식 수정 버튼

```ts
import { updateLikedFood } from './meal-data/db/preferences.ts';

const result = updateLikedFood(db, ctx, {
  previousFoodId: originalFoodId,
  foodId: selectedNewFoodId
});
```

- 선호 음식 변경 전용.
- 새 음식이 이미 선호·비선호 목록에 있으면 CONFLICT.
- 같은 음식으로 수정하면 성공.
- 실패하면 기존 취향이 유지된다.
- 비선호 이유 수정은 다음 절의 savePreference를 사용한다.

## 8. 삭제 버튼

```ts
import { removePreference } from './meal-data/db/preferences.ts';

const result = removePreference(db, ctx, selectedFoodId);
```

성공 data:
```ts
{ removed: true }
```

없던 취향:
```ts
{ removed: false }
```

음식 사전과 회원 전체 알레르기는 삭제되지 않는다.
성공 후 목록을 다시 조회한다.

## 9. 추천 메뉴의 싫어요 버튼

일반 비선호:
```ts
const result = savePreference(db, ctx, {
  foodId: recommendedFoodId,
  preference: 'disliked',
  reason: 'taste_texture',
  note: '선택 메모'
});
```

이유 값:
- taste_texture: 맛·식감
- allergy: 알레르기
- other: 기타

알레르기 이유:
```ts
const result = savePreference(db, ctx, {
  foodId: recommendedFoodId,
  preference: 'disliked',
  reason: 'allergy',
  allergenIds: selectedAllergenIds
});
```

- 성분 ID가 하나 이상 필요.
- DB에 존재하는 성분 ID만 허용.
- 회원 전체 알레르기 목록에 추가.
- 성분 선택 UI용 목록/API는 아직 별도 준비 필요.
- 싫어요 저장 성공 후 추천을 다시 계산해야 함.

중요:
- 추천 menu에 해당하는 실제 foodId를 사용한다.
- matchedFood는 사용자가 좋아한 음식이므로 싫어요 대상으로 쓰지 않는다.
- 현재 AI 문자열 결과와 foodId를 연결하는 매핑은 별도 구현 필요.

## 10. 알레르기 설정: 현재 등록값 조회

```ts
import { getAllergyProfile } from './meal-data/db/preferences.ts';

const result = getAllergyProfile(db, ctx);
```

성공 data:
```ts
{
  userId: '회원ID',
  status: 'registered',
  allergenIds: ['성분ID']
}
```

상태:
- not_set: 등록 전
- none_declared: 회원이 직접 없음 선택
- registered: 등록된 성분 있음

주의:
- 조회와 비선호 등록을 통한 추가는 구현됨.
- 회원 전체 목록 교체·해제 DB 함수는 아직 없음.
- 실제 메뉴별 성분·출처와 최종 추천 제외도 아직 미구현.
- '알레르기 안전 추천'으로 표시하지 않는다.

## 11. AI에 넘길 회원별 입력 만들기

```ts
import { getRecommendationInput } from './meal-data/db/recommendation-input.ts';

const result = getRecommendationInput(db, ctx, {
  cafeteriaId: 'campus-main',
  date: '2026-11-04'
});
```

성공 data:
```ts
{
  date: '2026-11-04',
  meals: { breakfast: [], lunch: [], dinner: [] },
  liked: [],
  disliked: []
}
```

배열 안에는 실제 음식명이 들어간다.

주의:
- 미등록·운영 미확인 끼니는 REVIEW_REQUIRED.
- 제공 메뉴의 음식 검토 상태가 pending이어도 REVIEW_REQUIRED.
- 음식 분류가 되어 있다고 이름 검토까지 완료된 것은 아니다.
- 이 단계에는 최종 알레르기 필터가 없다.

## 12. 기본 비교·AI 후보 분리·최종 정렬

```ts
import {
  prepareComparison,
  finalizeRecommendations
} from './meal-data/recommendation/core.ts';

const policy = {
  minSimilarityScore: 0.7,
  sortBy: 'meal_then_score',
  dislikedMatch: 'exact_or_contains'
} as const;

const prepared = prepareComparison(result.data, policy);

// prepared.basic: 완전·부분 일치 결과
// prepared.aiInput: 서원에게 넘길 나머지 메뉴와 취향

// 아래 변수에는 서원의 파싱 완료 Recommendation[]를 연결한다.
// 이 문서에서 AI 호출 함수를 새로 정의한 것은 아니다.
const similarCandidates = parsedRecommendationsFromSeowon;

const recommendations = finalizeRecommendations(
  result.data,
  similarCandidates,
  policy
);
```

이 예시는 getRecommendationInput의 성공을 확인한 뒤 사용한다.

최종 항목:
```ts
{
  meal: 'lunch',
  menu: '실제 학식 메뉴',
  matchedFood: '연결된 선호 음식',
  type: 'similar',
  score: 0.85,
  reason: '추천 이유'
}
```

- exact 점수 1
- partial 점수 0.9
- similar 최소 점수는 기본 0.7
- 최종 함수는 배열을 반환하며 DB Result 형식이 아니다.
- 잘못된 정책은 예외를 던진다.
- 기본 비교 후 남은 메뉴에만 AI를 요청한다.
- 기존 전체 recommend()와 이 조합을 중복 실행하지 않는다.

기존 recommend.ts는 아직 이 흐름으로 재구성되지 않았다.
AI 호출·캐시·fallback 상태 연결은 서원과 맞춰야 한다.

## 13. 관리 화면: 식단 등록·수정·삭제

일반 사용자 버튼이 아니라 관리자 기능이다.
API에서 별도 권한 검사를 붙여야 한다.

```ts
import {
  saveManualMeal,
  deleteManualMeal
} from './meal-data/db/meals-write.ts';

const saved = saveManualMeal(db, {
  cafeteriaId: 'campus-main',
  date: '2026-11-04',
  mealType: 'lunch',
  status: 'available',
  items: [
    { foodId: selectedFoodId, rawText: '원본 음식명' }
  ],
  servingStyle: 'normal',
  notes: [],
  editReason: '관리자 식단 등록',
  replaceExisting: false
});
```

- 기존 식단이 있으면 CONFLICT.
- 수정하려면 replaceExisting:true.
- servingStyle: normal / simple / bento.
- status: available / closed / unknown.
- available은 음식이 최소 하나 필요.
- closed/unknown에는 빈 items 사용.
- notes와 제공 방식은 전달 값으로 교체.
- 실패 시 전체 롤백.
- 변경 전 데이터는 이력 보존.

삭제:
```ts
const deleted = deleteManualMeal(db, {
  cafeteriaId: 'campus-main',
  date: '2026-11-04',
  mealType: 'lunch',
  editReason: '잘못 등록된 식단 삭제'
});
```

삭제 전 이력은 보존하고 음식 사전·회원 취향은 유지한다.

## 14. 지금 바로 연결 가능한 부분과 선행 조건

| 화면 | 호출 함수 | 필요한 준비 |
|---|---|---|
| 날짜별 식단 | getDailyMeals | 실제 공통 식단 DB |
| 취향 목록 | listPreferences | 인증된 회원 ID |
| 선호 등록 | savePreference | 선택한 foodId |
| 선호 수정 | updateLikedFood | 기존/새 foodId |
| 취향 삭제 | removePreference | 대상 foodId |
| 싫어요 | savePreference | 추천 메뉴와 foodId 매핑 |
| 알레르기 조회 | getAllergyProfile | 인증된 회원 ID |
| 관리자 식단 | saveManualMeal / deleteManualMeal | 관리자 권한 |
| 추천 표시 | prepareComparison + AI + finalizeRecommendations | 서원 AI 연결 |

HTTP API·음식 검색·회원 전체 알레르기 변경·알림 함수는 아직 없다.
이미 있는 함수인 것처럼 화면에서 호출하지 않는다.

## 15. UI 참고와 검사

참고 화면:
meal-data/prototype/index.html

- 실제 DB 연결 UI가 아니라 조작 흐름 참고용.
- localStorage와 문자열 성분 입력을 실제 DB 계약에 그대로 사용하지 않는다.
- 일반 사용자 화면과 식단 편집 관리자 화면을 구분한다.

검사:
    npm --prefix meal-data test
    npm --prefix ai-recommendation test
    npm --prefix ai-recommendation run typecheck
    npm --prefix mobile run typecheck
    npm --prefix mobile run lint

Expo 코드를 수정할 때 mobile/AGENTS.md와 실제 설치 버전 문서를 먼저 확인한다.
