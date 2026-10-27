# 모바일 앱 실행과 설명

## 선택한 구성

- 언어: TypeScript
- 앱 화면: React Native + Expo
- AI 추천: 서원님이 작성한 ai-recommendation 모듈
- 편집: Visual Studio Code
- Android 실행 확인: Expo Go 또는 Android 에뮬레이터

React Native는 실제 Android/iPhone 앱을 만드는 도구이다. 웹 미리보기는 화면 확인용이다.
서원님 코드와 같은 언어를 사용하므로 입력과 출력의 자료형을 그대로 맞출 수 있다.

## 파일 두 개부터 이해하기

App.tsx는 화면을 만든다. selected에는 누른 식사 버튼을 저장한다.
전체를 누르면 세 끼를 모두 보여주고, 조식·중식·석식 중 하나를 누르면 해당 식단만 보여준다.
map은 메뉴를 하나씩 화면에 표시하고, filter는 선택한 끼니만 남긴다.
styles는 색상, 글자 크기, 간격을 정한다.

meals.ts는 화면 개발에 사용하는 예시 식단이다.
breakfast는 조식, lunch는 중식, dinner는 석식이다.
MealType은 서원님 파일에서 자료형만 가져오므로 AI 호출 코드와 비밀키는 앱에 포함되지 않는다.

## 실행

VS Code에서 저장소 폴더를 열고 터미널에서 실행한다.

```powershell
cd mobile
npm ci
npm start
```

휴대폰에 Expo Go를 설치하고 PC와 같은 와이파이에서 QR 코드를 연다.
설치된 Expo Go와 프로젝트 SDK 버전이 맞아야 한다.
Android 에뮬레이터가 켜져 있다면 npm run android로 실행한다.
PC 화면 미리보기는 npm run web을 사용한다.

## 최종 연결 구성

휴대폰 앱 → 추천 요청을 받는 서버 → 서원님 recommend 함수 → 앱에 결과 표시

앱에서 보내는 데이터는 date, meals, liked, disliked이다.
돌려받는 데이터는 date, status, recommendations이다.
AI 호출에 필요한 GEMINI_API_KEY는 서버에서만 사용한다.
서버는 나중에 Node.js + TypeScript로 얇게 연결한다. 현재 서버는 아직 만들지 않았다.
강영웅의 데이터 기능이 준비되면 meals.ts의 예시를 실제 데이터로 바꾼다.

## 이번 개발 분량

완료: 메인 화면, 날짜 표시, 세 끼 예시 식단, 끼니 선택, 빈 식단 안내.
미구현: 실제 식단 저장, AI 결과 표시, 알림, 싫어요, 서버 연결.
기존 서원님 AI 코드는 수정하지 않았다.

## 교수님께 설명할 내용

저는 메인 화면과 알림, 전체 연결을 맡았습니다.
이번에는 조식·중식·석식 메뉴를 보여주는 메인 화면을 만들었습니다.
식사 버튼을 누르면 선택한 끼니의 메뉴만 보입니다.
지금은 예시 데이터를 사용하고, 팀원의 데이터가 준비되면 연결할 예정입니다.
AI 담당 팀원과 같은 TypeScript를 사용하고 끼니 이름도 같은 형식으로 맞췄습니다.

## 다음 개발 순서 제안

추천 결과 표시 → 싫어요 연결 → 알림 → 실제 데이터와 AI 연결 → 전체 테스트.
교수님 파일의 확정된 주차별 제출표가 아니라 현재 역할을 기준으로 정한 순서이다.

## 확인 명령

```powershell
npm run typecheck
npm run lint
npx expo export --platform android
```

Android export는 앱 코드 번들 검증이다. 설치 가능한 APK 빌드와 기기 실행 검증은 별도이다.

## 검증 결과
TypeScript 검사, ESLint 검사, Android 번들 생성, 웹 미리보기의 중식 선택과 전체 복귀를 확인했다. APK 설치와 휴대폰 실행은 아직 확인하지 않았다.
공식 Expo 의존성의 개발 도구에 npm audit 경고 3건이 있다(zod 3 계열). 강제 버전 변경은 호환성을 깨뜨릴 수 있어 적용하지 않았다.

