import { describe, it, expect } from "vitest";
import { normalize } from "../src/normalize.js";
import { isDisliked, normalizeList } from "../src/filter.js";
import { matchMenu, type LikedFood } from "../src/matcher.js";

const liked = (...names: string[]): LikedFood[] =>
  names.map((original) => ({ original, normalized: normalize(original) }));

describe("normalize", () => {
  it("공백·괄호·대소문자 정리", () => {
    expect(normalize("제육 볶음(대)")).toBe("제육볶음");
    expect(normalize("Chicken Salad [소]")).toBe("chickensalad");
  });
});

describe("matchMenu", () => {
  it('"제육 볶음(대)" 와 "제육볶음" → exact', () => {
    const m = matchMenu("제육 볶음(대)", liked("제육볶음"));
    expect(m).toMatchObject({ type: "exact", score: 1.0 });
  });
  it("선호 돈까스, 메뉴 치즈돈까스 → partial 0.9", () => {
    const m = matchMenu("치즈돈까스", liked("돈까스"));
    expect(m).toMatchObject({ type: "partial", score: 0.9 });
    expect(m?.food.original).toBe("돈까스");
  });
  it("1글자 선호 '국', 메뉴 '미역국' → partial 아님", () => {
    expect(matchMenu("미역국", liked("국"))).toBeNull();
  });
  it("1글자라도 이름이 같으면 exact", () => {
    expect(matchMenu("국", liked("국"))?.type).toBe("exact");
  });
  it("exact가 partial보다 우선", () => {
    expect(matchMenu("돈까스", liked("까스", "돈까스"))?.type).toBe("exact");
  });
  it("일치하지 않으면 null", () => {
    expect(matchMenu("샐러드", liked("돈까스"))).toBeNull();
  });
});

describe("isDisliked", () => {
  it("비선호 '카레', 메뉴 '카레라이스' → 제외", () => {
    expect(isDisliked("카레라이스", normalizeList(["카레"]))).toBe(true);
  });
  it("1글자 비선호는 포함 검사를 하지 않는다", () => {
    expect(isDisliked("미역국", normalizeList(["국"]))).toBe(false);
    expect(isDisliked("국", normalizeList(["국"]))).toBe(true);
  });
  it("관련 없는 메뉴는 통과", () => {
    expect(isDisliked("샐러드", normalizeList(["카레"]))).toBe(false);
  });
});

describe("normalizeList", () => {
  it("빈 문자열과 중복 무시", () => {
    expect(normalizeList(["", "  ", "돈까스", "돈 까스(대)"])).toEqual(["돈까스"]);
  });
});
