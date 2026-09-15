// yona.ui.Toast.js/yona.Common.js의 notify() 순수 로직만 뽑아낸 것.
//
// 원본 notify(sMessage, nDuration, sTitle)은:
//   - sTitle이 있으면 "<strong>title</strong><br/>" + message를 합쳐서 넘긴다.
//   - yona.ui.Toast.push()는 그 문자열에 $yona.nl2br()(순수 개행 -> <br> 치환)을 적용해
//     .msg의 innerHTML로 꽂는다.
// 이 두 단계를 합쳐 toastHtml(message, title?)로 재현한다 - message/title 모두 원본과
// 동일하게 이스케이프 없이 그대로(HTML로) 삽입된다(원본도 innerHTML을 썼다 - 호출부가
// 항상 신뢰 가능한 문자열만 넘긴다는 전제는 원본과 동일하게 유지, 이 포팅에서 새로
// sanitize를 추가하지 않는다 - 동작 변경 금지 원칙).
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
