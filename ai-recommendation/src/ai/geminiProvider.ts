import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { SimilarityProvider, SimilarityRequest } from "./provider.js";

export const DEFAULT_MODEL = "gemini-3.8-flash";

const SYSTEM_PROMPT = [
  "너는 학식 메뉴 유사도 판단기다.",
  "사용자가 준 선호 음식 목록과 메뉴 목록을 비교해, 선호 음식과 비슷한 메뉴만 골라라.",
  "비슷하다는 기준은 주재료·조리법·맛이 비슷해서 그 선호 음식을 좋아하는 사람이 반길 만한 경우다.",
  "반드시 JSON 배열로만 답하고, 다른 설명이나 코드블록은 쓰지 마라.",
  '각 항목 형식: {"menu": 메뉴 이름, "matchedFood": 선호 음식 이름, "score": 0~1 숫자, "reason": 20자 이내 한국어 이유}',
  "menu와 matchedFood는 입력에 주어진 문자열을 그대로 사용하고, 목록에 없는 이름은 만들지 마라.",
  "비슷한 메뉴가 없으면 빈 배열 []을 반환하라.",
].join("\n");

export function buildPrompt({ menus, liked }: SimilarityRequest): string {
  return [
    `선호 음식: ${JSON.stringify(liked)}`,
    `메뉴: ${JSON.stringify(menus)}`,
    "각 메뉴가 어떤 선호 음식과 가장 비슷한지 score(0~1)와 함께 JSON 배열로 답해라.",
  ].join("\n");
}

export interface GeminiOptions {
  apiKey?: string; // 기본값: process.env.GEMINI_API_KEY
  model?: string; // 기본값: process.env.GEMINI_MODEL 또는 DEFAULT_MODEL
  timeoutMs?: number; // 기본 10초
}

export class GeminiProvider implements SimilarityProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");
    this.client = new GoogleGenAI({ apiKey });
    this.model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async compare(request: SimilarityRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: buildPrompt(request),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: controller.signal,
        },
      });
      return res.text ?? "";
    } finally {
      clearTimeout(timer);
    }
  }
}
