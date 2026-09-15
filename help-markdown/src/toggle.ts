// help/markdown.html 하단 인라인 <script>의 토글 로직(순수 부분만 추출) - 원본은
// jQuery 스타일 클래스 조작(active 클래스가 있는 형제를 찾아 toggleClass)이었지만, 규칙
// 자체는 간단한 상태 전이다: 지금 열려 있는 탭을 다시 클릭하면 닫히고(null), 다른 탭을
// 클릭하면 그 탭으로 바뀐다(이전 것은 자동으로 닫힘 - 한 번에 최대 1개만 열림).
//
// DOM/프레임워크에 의존하지 않는 순수 함수로 분리해 node:test로 바로 단위 테스트한다
// (commands.ts/mention.ts 등 editor2의 관례와 동일한 이유).
export function nextActiveKey(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}
