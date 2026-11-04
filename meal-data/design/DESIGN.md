# 학식 데이터 모듈 설계 v0.1

상태: 팀 합의용 초안. 기존 meal-data API는 유지하고 새 계약과 SQLite 스키마를 추가했습니다.
main 수정/푸시 없음. 인증, DB 접근 계층, PDF 표 전체 추출, 검토 화면은 아직 연결하지 않았습니다.

## 1. 팀원에게 합의받을 사항
- 모든 취향은 앱 내부 userId에 연결하며 식단과 음식 사전은 공통입니다.
- 로그인 방식 구현 담당을 정하고, 첫 버전은 한 방식만 선택합니다.
- 식당당 날짜·끼니별 메뉴는 한 세트입니다. 여러 코너가 필요해지면 meals에 코너 식별자를 추가하고 유일 제약을 변경합니다.
- 날짜 YYYY-MM-DD, 시간 학교 현지 시각 HH:mm, 끼니 breakfast/lunch/dinner.
- 음식 사전/식단 변경은 관리 기능으로 제한하고 회원은 자신의 취향만 변경합니다.
- 음식 분류는 staple, soup, main, side, kimchi, dessert_drink, unknown입니다.
- 음식명이 달라도 단순 표기 차이인 경우만 별칭으로 연결합니다. 소스·재료가 다른 변형은 별도 음식으로 둡니다.

## 2. 파일별 역할
| 파일 | 역할 |
|---|---|
| contracts.ts | 입력/출력·공통 오류·담당 모듈 계약 |
| import-review.ts | 음식 셀 정리와 검토 초안의 확정 가능 여부 검사 |
| ../db/schema.sql | SQLite 테이블·외래 키·유일 제약 |
| ../db/test_schema.py | 회원별 격리·식단 중복·삭제·트랜잭션 취소 검증 |

## 3. 회원 취향 인터페이스
PreferenceModule.set(ctx, {foodId, preference})는 회원·음식 조합을 생성 또는 변경합니다.
반환: {ok:true,data:{food:{id,name,category},preference}}.
remove는 취향만 삭제하며 음식 사전을 지우지 않습니다. 없는 취향은 removed:false.
list는 빈 결과를 빈 배열로 반환합니다.
ctx는 인증 계층에서 생성하고 HTTP 요청 본문의 userId를 신뢰하지 않습니다.
변경 API가 받는 foodId는 음식 사전에 존재해야 합니다. 신규 자유 입력 음식은 FoodCatalogModule.create를 거쳐 ID를 얻습니다.
화면의 '음식 수정'은 두 동작을 구분합니다:
- 사용자가 다른 음식을 선택: 새 foodId의 취향 저장 + 이전 취향 삭제를 단일 트랜잭션으로 처리.
- 음식 사전의 오타 수정: 관리자 FoodCatalogModule.rename. 회원별 취향을 바꾸는 동작이 아닙니다.

## 4. 식단과 추천 인터페이스
MealModule.list({cafeteriaId,from,to})는 기간 내 등록된 식단을 날짜·끼니 순서로 반환합니다.
미등록은 목록에 없으며 휴무(closed), 자료 미확인(unknown), 제공(available)을 구분합니다.
MealModule.save는 식당·날짜·끼니의 한 메뉴 세트를 등록/교체하는 관리 기능입니다.
날짜와 시간 유효성, 음식 존재 여부, source와 cafeteria의 일치, 음식 검토 상태는 접근 계층에서 검사해야 합니다.
소스 등록·검토 초안은 ImportDraft로 주고받습니다. 파싱 실패와 휴무를 같은 빈 배열로 취급하지 않습니다.
RecommendationDataModule.buildInput은 인증된 회원의 취향과 확정된 식단을 조회해 기존 AI RecommendInput으로 변환합니다.
DB에서는 foodId를 쓰고 AI에는 음식명 배열을 제공합니다. 변환 과정에서 음식 ID와 이름 대응표를 유지합니다.
AI 출력의 menu와 meal을 해당 식단의 foodId에 다시 매칭하며 없는 메뉴는 오류/제외 처리합니다.
싫어요는 추천의 실제 foodId에 disliked를 저장합니다. 관련 음식 전체를 자동 차단하지 않습니다.
취향 변경 후 추천 캐시를 무효화하고 예약 알림도 재계산해야 합니다(후속 구현).

## 5. 저장 구조
- users → auth_accounts: 외부 계정의 provider + provider_subject는 유일합니다.
- local_credentials: 자체 가입을 선택할 때만 사용. 비밀번호 원문이나 외부 서비스 비밀번호를 저장하지 않습니다.
- foods → food_aliases / food_tags: 이름, 별칭, 재료/조리법 분리.
- cafeterias → meals → meal_items: 식당·날짜·끼니와 음식 목록 연결.
- meal_sources: 원본 파일명, 내용 체크섬, 대상 연도, 검토 상태 보관.
- user_food_preferences: (user_id,food_id)가 기본 키. 선호·비선호는 같은 행을 변경.
- 식단 삭제 시 meal_items만 삭제하고 foods·회원 취향은 보존.
- 음식 참조가 있으면 물리 삭제를 막습니다. 운영에서는 보관 처리 필드를 추가할 수 있습니다.
- SQLite 사용 연결마다 foreign_keys=ON을 적용해야 합니다.
- 날짜 SQL 제약은 형식만 검사합니다. 실제 달력 날짜와 제공 시간은 저장 전 애플리케이션에서 검증합니다.
- normalized_name/normalized_alias는 같은 규칙을 사용하고, 두 테이블 사이 이름 충돌도 저장 계층에서 검사해야 합니다.

## 6. PDF 파싱 및 검토
원본 등록 → 날짜/끼니 표 추출 → 셀 정리 → 음식 사전 후보 매칭 → 관리자 검토 → 트랜잭션 저장.
이번 parseFoodCell은 표 추출 이후의 한 음식 셀만 처리합니다. 전체 PDF 파서는 아닙니다.
원본 rawText는 유지하고 내부 공백이나 &, *, /는 자동 제거/분할하지 않습니다.
음식 분류가 unknown이거나 reviewReasons가 남으면 validateImportDraft가 확정을 차단합니다.
첫 식단표는 연도가 없으므로 수동 확인 전 yearConfirmed=false입니다.
두 번째 식단표는 제목의 2026년과 날짜·요일을 대조한 뒤 확정합니다.
원산지·운영 공지는 음식 목록과 별도로 source 메모에 보관합니다.
음식명에서 추정한 재료는 추천 보조용이며, 공식 알레르기 정보로 취급하지 않습니다.
동일 식당의 동일 체크섬 원본은 중복 생성하지 않습니다. 수정 식단표는 새 source로 남깁니다.
한 원본의 저장 작업은 모두 검증한 후 트랜잭션으로 묶고, 오류 시 전체 취소합니다.

## 7. 공통 오류
INVALID_INPUT: 빈 이름, 잘못된 날짜·형식.
UNAUTHENTICATED: 로그인 확인 실패.
NOT_FOUND: 없는 음식/식당.
CONFLICT: 이름·별칭 또는 중복 등록 충돌.
REVIEW_REQUIRED: 연도·분류·셀 검토 미완료.
STORAGE_ERROR: DB 읽기/쓰기 실패. 내부 SQL 오류는 화면에 직접 노출하지 않습니다.
현재 기존 MealDataStore는 예외를 던지므로 새 계약의 Result로 감싸는 저장 계층이 필요합니다.

## 8. 구현 순서
1. 세 명이 contracts.ts와 이 문서를 확인하고 음식 분류·사용자 식별·추천 매핑을 합의.
2. 저장 접근 계층 구현: 회원별 취향, 공통 음식/식단 CRUD, 트랜잭션, Result 변환.
3. 관리용 수동 식단 입력 연결. 파일 저장 시연 코드는 보존.
4. 첨부 PDF 두 레이아웃별 추출기 작성과 검토 화면 연결.
5. 인증된 회원으로 AI 입력 생성·추천 ID 매핑·싫어요 반영 통합.
6. 알림과 캐시 갱신 연결. 다중 회원 및 휴무/미등록 시나리오 확인.

## 9. 현재 검증
npm test: 기존 기능 포함 13개 통과.
python meal-data/db/test_schema.py: SQLite 제약 및 트랜잭션 테스트 4개 통과.
SQL의 실제 앱 연결, 로그인, PDF 표 자동 추출, UI/AI/알림 통합은 아직 미완료입니다.
