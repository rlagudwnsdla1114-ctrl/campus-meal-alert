import { describe, it, expect } from "vitest";
import { GeminiProvider, buildPrompt } from "../src/ai/geminiProvider.js";

describe("GeminiProvider", () => {
  it("API 키가 없으면 생성 시 예외", () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => new GeminiProvider()).toThrow("GEMINI_API_KEY");
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
  it("프롬프트에 선호 음식과 메뉴가 JSON으로 들어간다", () => {
    const p = buildPrompt({ menus: ["고추장 돼지불고기"], liked: ["제육볶음"] });
    expect(p).toContain('["제육볶음"]');
    expect(p).toContain('["고추장 돼지불고기"]');
  });
});
