// yona.Pagination.js(common/yona.Pagination.js)의 순수 로직만 뽑아낸 것 - DOM
// 생성/이벤트 바인딩은 YonaPagination.vue가 담당하고, 여기서는 URL 파싱/페이지 번호
// 계산/입력값 보정만 다룬다.
//
// 원본은 `document.createElement('a')` 앵커 엘리먼트에 href를 대입해 브라우저의 URL
// 파싱/정규화를 빌려 썼다(anchor가 암묵적으로 현재 문서의 base를 상속). 여기서는 표준
// `URL`을 쓰되, 원본과 동일하게 "base"를 명시적으로 받아 Node 테스트 환경에서도 그대로
// 검증 가능하게 했다(실제 컴포넌트는 `window.location.href`를 base로 넘긴다).

export interface UpdateOptions {
  url?: string;
  current?: number | string;
  firstPage?: number;
  paramNameForPage?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  submit?: (pageNum: number) => void;
}

export interface PaginationState {
  url: string;
  current: number;
  firstPage: number;
  totalPages: number;
  paramNameForPage: string;
  hasPrev: boolean;
  hasNext: boolean;
  submit?: (pageNum: number) => void;
}

// jQuery $.isNumeric()과 동일한 트릭(문자열 - 숫자 파싱값이 0이 아니면 NaN이 되는
// 성질 이용) - 16진수/부호/소수점 문자열도 숫자로 판정하는 원본 동작까지 그대로 유지.
export function isNumeric(obj: unknown): boolean {
  const realStringObj = obj != null ? String(obj) : obj;
  return !Array.isArray(obj) && (Number(realStringObj) - parseFloat(String(realStringObj)) + 1) >= 0;
}

// 원본 rxDigit(/^.[0-9]*$/)를 그대로 재현한다 - 주석은 "positive만 찾는다"지만
// 정규식 자체는 "첫 글자가 무엇이든(숫자가 아니어도) 하나 있고, 그 뒤는 전부 숫자거나
// 없음"만 검사한다("- 5"도 통과) - htData.current를 URL에서 다시 읽을지 말지
// 결정하는 용도라 실제로는 이 값이 거의 항상 없거나 정상적인 양의 정수라 영향은 없다.
const RX_DIGIT = /^.[0-9]*$/;

export function looksLikeExplicitCurrent(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  return RX_DIGIT.test(String(value));
}

function parseUrl(url: string, base: string): URL {
  // 원본은 `url.replace('&amp;', '&')`로 첫 번째 등장만 치환한다(전역 치환이 아님) -
  // 서버가 렌더링한 HTML 속성에서 그대로 뽑아온 URL 문자열을 가정한 방어 코드인데,
  // 실제 호출부 전체를 확인한 결과 `options.url`을 넘기는 곳이 하나도 없어(항상
  // `document.URL` 기본값 사용) 이 경로 자체가 죽은 코드에 가깝다 - 동작 변경 금지
  // 원칙에 따라 첫 번째 치환만 하는 원본 그대로 재현한다.
  return new URL(url.replace("&amp;", "&"), base);
}

export function getPageNumFromUrl(url: string, paramNameForPage: string, firstPage: number, base: string): number {
  const raw = parseUrl(url, base).searchParams.get(paramNameForPage);
  const parsed = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) || parsed === 0 ? firstPage : parsed;
}

export function urlWithPageNum(url: string, pageNum: number | string, paramNameForPage: string, base: string): string {
  const parsed = parseUrl(url, base);
  parsed.searchParams.set(paramNameForPage, String(pageNum));
  return parsed.toString();
}

function validateCurrent(current: unknown): void {
  if (!isNumeric(current)) {
    throw new Error("options.current is not valid: " + current);
  }
}

// 원본 updatePagination()의 htData 조립(기본값 채우기) + validateOptions 부분만
// 뽑아낸 것 - 나머지(DOM 생성)는 컴포넌트가 이 결과를 가지고 선언적으로 그린다.
export function resolvePaginationState(totalPages: number, options: UpdateOptions, base: string): PaginationState {
  const url = options.url ?? base;
  const firstPage = options.firstPage ?? 1;
  const paramNameForPage = options.paramNameForPage ?? "pageNum";
  const current = looksLikeExplicitCurrent(options.current)
    ? Number(options.current)
    : getPageNumFromUrl(url, paramNameForPage, firstPage, base);

  validateCurrent(current);

  const hasPrev = options.hasPrev ?? current > firstPage;
  const hasNext = options.hasNext ?? current < totalPages;

  return { url, current, firstPage, totalPages, paramNameForPage, hasPrev, hasNext, submit: options.submit };
}

// 원본 isValidInputNum을 DOM 직접 조작 대신 순수 함수로 재현 - 호출부(컴포넌트)가
// 반환값으로 v-model 상태를 갱신한다.
export function clampInputValue(rawValue: string, min: number, max: number, currentPageNum: number): { valid: boolean; value: string } {
  if (!RX_DIGIT.test(rawValue)) {
    return { valid: false, value: String(currentPageNum) };
  }

  const parsed = parseInt(rawValue, 10);
  if (parsed < min) {
    return { valid: true, value: String(min) };
  }
  if (parsed > max) {
    return { valid: true, value: String(max) };
  }
  return { valid: true, value: rawValue };
}
