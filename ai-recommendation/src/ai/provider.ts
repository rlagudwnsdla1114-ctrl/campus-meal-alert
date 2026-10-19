export interface SimilarityRequest {
  /** AI에 비교를 요청할 메뉴 이름 (원문, 중복 없음) */
  menus: string[];
  /** 선호 음식 (원문) */
  liked: string[];
}

/** AI 제공자. 응답 원문(JSON 문자열)을 돌려주고, 검증은 parseResponse가 맡는다. */
export interface SimilarityProvider {
  compare(request: SimilarityRequest): Promise<string>;
}
