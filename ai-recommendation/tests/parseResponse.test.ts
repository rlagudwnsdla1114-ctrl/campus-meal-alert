import { describe, it, expect } from "vitest";
import { parseResponse } from "../src/ai/parseResponse.js";

const menus = ["고추장 돼지불고기", "콩나물국"];
const foods = ["제육볶음"];
const item = (o: object) => ({ menu: "고추장 돼지불고기", matchedFood: "제육볶음", score: 0.85, reason: "비슷함", ...o });

describe("parseResponse", () => {
  it("정상 응답 파싱", () => {
    const r = parseResponse(JSON.stringify([item({})]), menus, foods);
    expect(r).toEqual([{ menu: "고추장 돼지불고기", matchedFood: "제육볶음", score: 0.85, reason: "비슷함" }]);
  });
  it("코드블록으로 감싼 JSON 허용", () => {
    expect(parseResponse("```json\n" + JSON.stringify([item({})]) + "\n```", menus, foods)).toHaveLength(1);
  });
  it("JSON이 아니거나 배열이 아니면 null", () => {
    expect(parseResponse("죄송합니다", menus, foods)).toBeNull();
    expect(parseResponse('{"menu":"a"}', menus, foods)).toBeNull();
    expect(parseResponse("", menus, foods)).toBeNull();
  });
  it("식단에 없는 메뉴 / 등록 안 한 선호 음식은 그 항목만 버림", () => {
    const raw = JSON.stringify([item({ menu: "없는메뉴" }), item({ matchedFood: "피자" }), item({ menu: "콩나물국", score: 0.7 })]);
    expect(parseResponse(raw, menus, foods)?.map((i) => i.menu)).toEqual(["콩나물국"]);
  });
  it('score 1.5, "높음", 음수, null은 그 항목만 버림', () => {
    const raw = JSON.stringify([item({ score: 1.5 }), item({ score: "높음" }), item({ score: -0.1 }), item({ score: null }), item({ menu: "콩나물국", score: 0.8 })]);
    expect(parseResponse(raw, menus, foods)?.map((i) => i.menu)).toEqual(["콩나물국"]);
  });
  it("같은 메뉴가 중복되면 score 높은 것만", () => {
    const raw = JSON.stringify([item({ score: 0.75 }), item({ score: 0.9 })]);
    expect(parseResponse(raw, menus, foods)?.map((i) => i.score)).toEqual([0.9]);
  });
  it("reason이 없어도 빈 문자열로 처리", () => {
    const raw = JSON.stringify([{ menu: "콩나물국", matchedFood: "제육볶음", score: 0.8 }]);
    expect(parseResponse(raw, menus, foods)?.[0]?.reason).toBe("");
  });
});
