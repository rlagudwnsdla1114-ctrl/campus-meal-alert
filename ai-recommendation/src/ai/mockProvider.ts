import type { SimilarityProvider, SimilarityRequest } from "./provider.js";

type Responder = string | ((request: SimilarityRequest) => string | Promise<string>);

/** 테스트용 제공자: 고정 응답(또는 함수)을 돌려주고 호출 기록을 남긴다. */
export class MockProvider implements SimilarityProvider {
  readonly calls: SimilarityRequest[] = [];
  constructor(private readonly responder: Responder) {}

  async compare(request: SimilarityRequest): Promise<string> {
    this.calls.push(request);
    return typeof this.responder === "function" ? this.responder(request) : this.responder;
  }
}
