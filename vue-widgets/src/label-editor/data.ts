// 원본 yona.issue.LabelEditor.js의 _coerceDataValue를 그대로 옮겼다 - jQuery의
// `.data()`가 dataset 문자열 값을 자동으로 true/false/null/숫자/JSON으로
// 승격시키던 특성을 네이티브 `element.dataset`(항상 문자열)으로 재현하기 위함.
// 카테고리/라벨 이름이 우연히 순수 숫자 문자열이면 숫자로 강제 변환되는 것도
// 원본부터 있던 특성이라 "버그"로 보고 고치지 않고 그대로 재현한다.
export function coerceDataValue(value: string | undefined): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  if (value !== "" && value === String(Number(value))) {
    return Number(value);
  }
  if (/^(?:\{[\s\S]*\}|\[[\s\S]*\])$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      // JSON 파싱 실패 시 원본 문자열 유지(jQuery도 동일하게 실패 시 원본 반환).
    }
  }
  return value;
}

export function getData(el: HTMLElement | null, key: string): unknown {
  return el ? coerceDataValue(el.dataset[key]) : undefined;
}
