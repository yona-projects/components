// yona.ui.Toast.js/yona.Common.js의 notify() 순수 로직만 뽑아낸 것.
// message/title은 원본과 동일하게 이스케이프 없이 그대로 HTML로 삽입된다(원본도
// innerHTML을 썼다 - 호출부가 신뢰 가능한 문자열만 넘긴다는 전제를 유지, sanitize를
// 새로 추가하지 않는다).
export function nl2br(text: string): string {
  return text.split("\n").join("<br>");
}

export function toastHtml(message: string, title?: string): string {
  const body = nl2br(message);
  if (title) {
    return `<strong>${title}</strong><br/>${body}`;
  }
  return body;
}
