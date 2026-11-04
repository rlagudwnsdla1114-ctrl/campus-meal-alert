import type { ImportDraft, ParsedItem } from './contracts.ts';

/** 전체 PDF 텍스트가 아닌, 표의 한 음식 셀을 입력받는 정리 단계입니다. */
export function parseFoodCell(rawText: string): ParsedItem {
  if (typeof rawText !== 'string' || !rawText.trim()) throw new Error('음식 셀이 비어 있습니다.');
  const cleaned = rawText.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const reviewReasons: string[] = [];
  if (/[&*/]/.test(cleaned)) reviewReasons.push('복합 음식 또는 소스 구분 확인');
  if (/\s/.test(cleaned)) reviewReasons.push('음식명 내부 공백 확인');
  // 공백·구분자를 자동 제거하면 복합 음식과 실제 메뉴 변형을 잃을 수 있어 원문을 보존합니다.
  reviewReasons.push('음식 사전 매칭 및 분류 확인');
  return { rawText, name: cleaned, category: 'unknown', reviewReasons };
}

export function validateImportDraft(draft: ImportDraft): string[] {
  const errors: string[] = [];
  if (!draft.sourceId?.trim() || !draft.cafeteriaId?.trim()) errors.push('원본과 식당을 지정하세요.');
  if (draft.yearConfirmed !== true) errors.push('원본의 연도를 확인하세요.');
  if (!Array.isArray(draft.meals) || draft.meals.length === 0) return [...errors, '식단이 없습니다.'];
  const seen = new Set<string>();
  for (const entry of draft.meals) {
    const parsed = new Date(`${entry.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== entry.date) errors.push(`날짜 오류: ${entry.date}`);
    if (!['breakfast', 'lunch', 'dinner'].includes(entry.mealType)) errors.push('끼니 오류');
    const id = `${entry.date}/${entry.mealType}`;
    if (seen.has(id)) errors.push(`끼니 중복: ${id}`);
    seen.add(id);
    if (!Array.isArray(entry.items) || entry.items.length === 0) { errors.push(`빈 식단: ${id}`); continue; }
    for (const item of entry.items) {
      if (!item.rawText?.trim() || !item.name?.trim()) errors.push('원문 또는 음식명 누락');
      if (item.category === 'unknown' || item.reviewReasons.length > 0) errors.push(`검토 필요: ${item.name}`);
    }
  }
  return errors;
}
