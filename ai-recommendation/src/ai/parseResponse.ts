import { normalize } from "../normalize.js";

export interface SimilarItem {
  menu: string; // 요청에 있던 메뉴 원문
  matchedFood: string; // 등록된 선호 음식 원문
  score: number;
  reason: string;
}

function stripFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1]! : text).trim();
}

/**
 * AI 응답 검증 (명세 6번).
 * - JSON 배열이 아니면 null (호출 측에서 fallback 처리)
 * - 요청에 없던 메뉴 / 등록하지 않은 선호 음식 / 0~1 밖이거나 숫자가 아닌 score → 그 항목만 버림
 * - 같은 메뉴가 여러 번 오면 score가 가장 높은 항목만 남긴다
 */
export function parseResponse(
  raw: string,
  allowedMenus: string[],
  allowedFoods: string[],
): SimilarItem[] | null {
  let data: unknown;
  try {
    data = JSON.parse(stripFence(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  const menuByKey = new Map(allowedMenus.map((m) => [normalize(m), m]));
  const foodByKey = new Map(allowedFoods.map((f) => [normalize(f), f]));
  const best = new Map<string, SimilarItem>();

  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { menu, matchedFood, score, reason } = entry as Record<string, unknown>;
    if (typeof menu !== "string" || typeof matchedFood !== "string") continue;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) continue;
    const originalMenu = menuByKey.get(normalize(menu));
    const originalFood = foodByKey.get(normalize(matchedFood));
    if (!originalMenu || !originalFood) continue;

    const item: SimilarItem = {
      menu: originalMenu,
      matchedFood: originalFood,
      score,
      reason: typeof reason === "string" ? reason.trim() : "",
    };
    const prev = best.get(originalMenu);
    if (!prev || item.score > prev.score) best.set(originalMenu, item);
  }
  return [...best.values()];
}
