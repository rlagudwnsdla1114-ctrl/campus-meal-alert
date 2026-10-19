import { describe, it, expect, vi } from "vitest";
import { recommend } from "../src/recommend.js";
import { SimilarityCache } from "../src/cache.js";
import { MockProvider } from "../src/ai/mockProvider.js";
import type { RecommendInput } from "../src/types.js";

const base = (o: Partial<RecommendInput> = {}): RecommendInput => ({
  date: "2026-10-20",
  meals: { breakfast: [], lunch: [], dinner: [] },
  liked: ["제육볶음"],
  disliked: [],
  ...o,
});
const ai = (...items: object[]) => JSON.stringify(items);
const sim = (menu: string, score: number, matchedFood = "제육볶음") => ({ menu, matchedFood, score, reason: "비슷함" });
const run = (input: RecommendInput, p?: MockProvider, opts = {}) =>
  recommend(input, p, { cache: new SimilarityCache(), ...opts });

describe("정리·매칭 (출력은 원문)", () => {
  it("exact 매칭의 menu는 원문 그대로", async () => {
    const p = new MockProvider(ai());
    const r = await run(base({ meals: { breakfast: [], lunch: ["제육 볶음(대)"], dinner: [] } }), p);
    expect(r.recommendations).toMatchObject([{ meal: "lunch", menu: "제육 볶음(대)", type: "exact", score: 1 }]);
    expect(p.calls).toHaveLength(0);
  });
  it("partial 0.9", async () => {
    const r = await run(
      base({ liked: ["돈까스"], meals: { breakfast: [], lunch: [], dinner: ["치즈돈까스"] } }),
      new MockProvider(ai()),
    );
    expect(r.recommendations).toMatchObject([{ type: "partial", score: 0.9, matchedFood: "돈까스" }]);
  });
  it("1글자 선호는 partial 아님", async () => {
    const r = await run(
      base({ liked: ["국"], meals: { breakfast: ["미역국"], lunch: [], dinner: [] } }),
      new MockProvider(ai()),
    );
    expect(r.recommendations).toEqual([]);
  });
});

describe("비선호", () => {
  it("비선호 포함 메뉴 제외", async () => {
    const r = await run(
      base({ liked: ["라이스"], disliked: ["카레"], meals: { breakfast: [], lunch: ["카레라이스"], dinner: [] } }),
      new MockProvider(ai()),
    );
    expect(r.recommendations).toEqual([]);
  });
  it("AI가 비선호 메뉴를 비슷하다고 답해도 최종 결과에 없음", async () => {
    const p = new MockProvider(ai(sim("카레라이스", 0.95), sim("고추장 돼지불고기", 0.85)));
    const r = await run(
      base({ disliked: ["카레"], meals: { breakfast: [], lunch: ["카레라이스", "고추장 돼지불고기"], dinner: [] } }),
      p,
    );
    expect(r.recommendations.map((x) => x.menu)).toEqual(["고추장 돼지불고기"]);
    expect(p.calls[0]!.menus).not.toContain("카레라이스");
  });
  it("선호와 비선호에 같은 음식이 있으면 비선호 우선", async () => {
    const p = new MockProvider(ai());
    const r = await run(
      base({ liked: ["제육볶음"], disliked: ["제육볶음"], meals: { breakfast: [], lunch: ["제육볶음"], dinner: [] } }),
      p,
    );
    expect(r.recommendations).toEqual([]);
    expect(p.calls).toHaveLength(0);
  });
});

describe("AI 응답 처리", () => {
  const meals = { breakfast: [], lunch: ["고추장 돼지불고기"], dinner: [] };
  it.each([
    [0.85, 1],
    [0.69, 0],
    [0.7, 1],
  ])("score %s → 추천 %s건", async (score, n) => {
    const r = await run(base({ meals }), new MockProvider(ai(sim("고추장 돼지불고기", score))));
    expect(r.status).toBe("ok");
    expect(r.recommendations).toHaveLength(n);
    if (n) expect(r.recommendations[0]).toMatchObject({ type: "similar", score, matchedFood: "제육볶음" });
  });
  it("식단에 없는 메뉴는 그 항목만 버림", async () => {
    const r = await run(base({ meals }), new MockProvider(ai(sim("없는메뉴", 0.9), sim("고추장 돼지불고기", 0.8))));
    expect(r.status).toBe("ok");
    expect(r.recommendations.map((x) => x.menu)).toEqual(["고추장 돼지불고기"]);
  });
  it('score 1.5 / "높음" 은 그 항목만 버림', async () => {
    const r = await run(
      base({ meals: { breakfast: [], lunch: ["고추장 돼지불고기", "콩나물국"], dinner: [] } }),
      new MockProvider(ai(sim("고추장 돼지불고기", 1.5), { ...sim("콩나물국", 0.9), score: "높음" })),
    );
    expect(r).toMatchObject({ status: "ok", recommendations: [] });
  });
  it("JSON이 아닌 응답 → fallback, exact/partial은 유지", async () => {
    const r = await run(
      base({
        liked: ["돈까스", "제육볶음"],
        meals: { breakfast: [], lunch: ["고추장 돼지불고기"], dinner: ["치즈돈까스"] },
      }),
      new MockProvider("죄송합니다"),
    );
    expect(r.status).toBe("fallback");
    expect(r.recommendations.map((x) => x.menu)).toEqual(["치즈돈까스"]);
  });
  it("예외 → fallback, 밖으로 던지지 않음", async () => {
    const p = new MockProvider(() => {
      throw new Error("network");
    });
    const r = await run(base({ meals: { breakfast: [], lunch: ["제육볶음", "고추장 돼지불고기"], dinner: [] } }), p);
    expect(r.status).toBe("fallback");
    expect(r.recommendations.map((x) => x.menu)).toEqual(["제육볶음"]);
  });
  it("시간 초과 → fallback", async () => {
    const p = new MockProvider(() => new Promise<string>(() => {}));
    const r = await run(base({ meals }), p, { timeoutMs: 20 });
    expect(r).toMatchObject({ status: "fallback", recommendations: [] });
  });
  it("제공자를 안 넘기고 API 키도 없으면 fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      expect((await run(base({ meals }))).status).toBe("fallback");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("exact/partial로 찾은 메뉴는 AI 요청에 포함되지 않음", async () => {
    const p = new MockProvider(ai());
    await run(
      base({
        liked: ["돈까스", "제육볶음"],
        meals: { breakfast: ["제육볶음"], lunch: ["고추장 돼지불고기"], dinner: ["치즈돈까스"] },
      }),
      p,
    );
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0]!.menus).toEqual(["고추장 돼지불고기"]);
  });
  it("같은 조합 두 번째 호출은 AI를 다시 부르지 않음 (캐시)", async () => {
    const p = new MockProvider(ai(sim("고추장 돼지불고기", 0.85)));
    const cache = new SimilarityCache();
    const input = base({ meals });
    const a = await recommend(input, p, { cache });
    const b = await recommend(input, p, { cache });
    expect(p.calls).toHaveLength(1);
    expect(b).toEqual(a);
  });
  it("fallback 결과는 캐시하지 않아 다음 호출에서 재시도", async () => {
    const cache = new SimilarityCache();
    const bad = new MockProvider("not json");
    const good = new MockProvider(ai(sim("고추장 돼지불고기", 0.85)));
    await recommend(base({ meals }), bad, { cache });
    const r = await recommend(base({ meals }), good, { cache });
    expect(good.calls).toHaveLength(1);
    expect(r.status).toBe("ok");
  });
});

describe("입력·출력", () => {
  it("선호 음식이 없으면 AI 호출 없이 []", async () => {
    const p = new MockProvider(ai());
    const r = await run(base({ liked: ["", "  "], meals: { breakfast: ["미역국"], lunch: [], dinner: [] } }), p);
    expect(r).toEqual({ date: "2026-10-20", status: "ok", recommendations: [] });
    expect(p.calls).toHaveLength(0);
  });
  it("빈 문자열·중복 메뉴 무시, 같은 끼니 같은 메뉴는 한 번만", async () => {
    const r = await run(
      base({ meals: { breakfast: [], lunch: ["", "제육볶음", "제육 볶음(대)", "제육볶음"], dinner: [] } }),
      new MockProvider(ai()),
    );
    expect(r.recommendations).toHaveLength(1);
  });
  it("정렬: 조식→중식→석식, 끼니 안에서 score 내림차순", async () => {
    const p = new MockProvider(ai(sim("불고기", 0.8)));
    const r = await run(
      base({
        liked: ["돈까스", "제육볶음"],
        meals: { breakfast: [], lunch: ["불고기", "치즈돈까스", "제육볶음"], dinner: ["제육볶음"] },
      }),
      p,
    );
    expect(r.recommendations.map((x) => [x.meal, x.menu, x.score])).toEqual([
      ["lunch", "제육볶음", 1],
      ["lunch", "치즈돈까스", 0.9],
      ["lunch", "불고기", 0.8],
      ["dinner", "제육볶음", 1],
    ]);
  });
  it("같은 메뉴가 여러 끼니에 나오면 각 끼니에 추천", async () => {
    const p = new MockProvider(ai(sim("불고기", 0.8)));
    const r = await run(base({ meals: { breakfast: ["불고기"], lunch: ["불고기"], dinner: [] } }), p);
    expect(r.recommendations.map((x) => x.meal)).toEqual(["breakfast", "lunch"]);
    expect(p.calls[0]!.menus).toEqual(["불고기"]);
  });
});
