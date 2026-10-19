// 실제 Gemini API로 예시 입력을 돌려본다. 사용: GEMINI_API_KEY를 .env에 넣고 `npm run try`
import { readFileSync } from "node:fs";
import { GeminiProvider } from "../src/ai/geminiProvider.js";
import { recommend } from "../src/recommend.js";
import type { RecommendInput } from "../src/types.js";

// .env 간단 로더 (이미 설정된 환경변수는 덮어쓰지 않음)
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
} catch {
  // .env가 없으면 환경변수만 사용
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY가 없습니다. ai-recommendation/.env 에 GEMINI_API_KEY=... 를 넣고 다시 실행하세요.");
  process.exit(1);
}

const input: RecommendInput = {
  date: "2026-10-20",
  meals: {
    breakfast: ["미역국", "계란말이"],
    lunch: ["고추장 돼지불고기", "콩나물국"],
    dinner: ["치즈돈까스", "샐러드", "카레라이스"],
  },
  liked: ["제육볶음", "돈까스"],
  disliked: ["카레"],
};

const result = await recommend(input, new GeminiProvider());
console.log(JSON.stringify(result, null, 2));
if (result.status === "fallback") console.warn("AI 호출 실패로 fallback 결과입니다.");
