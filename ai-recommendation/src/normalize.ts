/** 비교용 정리: 괄호와 괄호 안 내용 제거, 공백 제거, 영문 소문자. 출력에는 쓰지 않는다. */
export function normalize(name: string): string {
  return name
    .replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）|［[^］]*］/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}
