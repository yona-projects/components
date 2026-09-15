// 원본 yona.issue.LabelEditor.js의 _toRequestParams - jQuery.param()과 동일하게
// 값이 undefined/null이어도 키는 유지하고 빈 문자열로 직렬화한다(URLSearchParams에
// 값을 직접 넘기면 undefined가 문자열 "undefined"로 잘못 직렬화되는 문제를 막는다).
export function toRequestParams(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  Object.keys(data).forEach((key) => {
    const value = data[key];
    params.append(key, value == null ? "" : String(value));
  });
  return params;
}
