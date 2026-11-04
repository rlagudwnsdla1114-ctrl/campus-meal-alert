# 선호 음식 및 식단 데이터 관리 - 강영웅

TypeScript 데이터 모듈. 기존 AI 모듈의 `MealType`, `RecommendInput`을 재사용합니다.

## 실행
Node.js 22.18 이상. 기존 프로젝트 루트에 `meal-data` 폴더를 배치하세요.
```bash
cd meal-data
npm test
npm run demo
```
추가 패키지 설치는 필요 없습니다. demo는 독립된 임시 폴더를 사용하고 종료 시 삭제합니다.

## 담당 항목과 코드
| 담당 | 구현 |
|---|---|
| 선호 음식 등록·수정·삭제 | addFood, updateFood, removeFood |
| 선호·비선호 저장·조회 | getPreferences, StorageAdapter, FileStorage |
| 날짜별 세 끼 식단 및 프로젝트 식단 | setMeal, getMeals, removeMeal, seedDemoMeals, importMeals, listMeals |
| 데이터 저장 구조 | State, Meals, JSON 저장, 버전 1 백업 |
| 중복 예외와 기능 테스트 | name, key, foods, date, validate / tests 두 파일 |

## 저장과 AI 연결 예시
```ts
import { MealDataStore } from './meal-data/index.ts';
import { FileStorage } from './meal-data/file-storage.ts';
const store = new MealDataStore(new FileStorage('./local-data'));
await store.addFood('liked', '계란말이');
await store.seedDemoMeals('2026-11-04');
const input = await store.getRecommendInput('2026-11-04');
// AI 담당 모듈에 input 전달: date, meals, liked, disliked
```

FileStorage는 Node.js용이며 임시 파일에 쓰고 rename으로 교체합니다. 같은 디렉터리를 지정하면 다른 프로세스 실행에서도 읽을 수 있습니다. 다중 프로세스 동시 쓰기 잠금은 제공하지 않습니다. 동일 키는 한 MealDataStore 인스턴스에서 수정하세요.
MemoryStorage는 메모리만 사용하므로 종료하면 사라집니다.

## 추가 구현
- importMeals: 여러 날짜의 식단을 검증한 뒤 한 번에 저장. 오류 시 전체 취소. 기존 날짜는 기본적으로 거부하며 overwrite=true로 교체 가능.
- listMeals: 시작·종료일을 포함하는 기간에서 등록된 날짜만 오름차순 조회.
- exportBackup / restoreBackup: version=1 JSON 전체 백업·교체 복원. 복원 시 기존 데이터가 교체되므로 앱 연결 시 안내 필요.
- seedDemoMeals: 실제 학교 자료가 아닌 수업용 식단. 해당 날짜가 있으면 보존.

## 검증
테스트 10개 통과. 음식 CRUD, 중복·빈 입력·취향 이동, 날짜·끼니 검증, 동시 등록, 오류 전파, 시연 데이터 보존, 별도 Node 프로세스 재조회, 기간 조회, 일괄 등록 취소, 백업 검증·복원 확인.

## 확장 순서 (미구현)
1. 모바일: StorageAdapter에 기기 영구 저장소를 연결하고 기존 메서드를 화면 이벤트에서 호출.
2. 학교 식단 수집: 외부 데이터를 날짜와 세 끼 형식으로 변환한 뒤 importMeals로 검증·저장. 출처와 갱신 시각 추가.
3. 음식 ID·별칭: 이름 대신 ID로 참조하고 표기 변형을 별칭으로 관리. 기존 JSON 버전 마이그레이션 필요.
4. 사용자별 저장 및 서버 동기화: 로그인 식별자 기준 분리, 서버 검증·접근 권한·충돌 해결 추가.
5. 성능: 소규모 JSON 전체 저장에서 날짜별/사용자별 레코드와 트랜잭션을 지원하는 DB로 전환.

현재 모바일 UI, 기기 영구 저장, 학교 식단 자동 수집, AI 실제 호출, 알림은 통합 전입니다. 이 파일들은 로컬 구현본이며 GitHub 업로드는 연결 계정 쓰기 권한 부족으로 완료되지 않았습니다.
