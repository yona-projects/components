// yona-markdown-editor 1단계(빌드 인프라) 최소 골격.
//
// 이 단계에서는 Custom Element 등록과 Shadow DOM attach만 검증한다.
// CM6 EditorView 마운트, light DOM textarea 동기화, 툴바/미리보기/멘션은
// 전부 이후 단계(2~5단계) 범위이며 여기서는 다루지 않는다.
//
// Shadow DOM attach 옵션({ mode: "open" })은 0단계 스파이크(editor/spike/entry.js)에서
// Chromium/Firefox/WebKit 3개 엔진 전부 정상 동작함을 검증한 그대로 사용한다.

export class YonaMarkdownEditor extends HTMLElement {
  connectedCallback(): void {
    if (this.shadowRoot) {
      // 이미 attach된 경우(재연결 등) 다시 attach하지 않는다.
      return;
    }

    const shadow = this.attachShadow({ mode: "open" });

    // 아직 CM6 에디터 뷰를 마운트하지 않는다 — 골격 단계 placeholder.
    shadow.appendChild(document.createTextNode(""));
  }
}

customElements.define("yona-markdown-editor", YonaMarkdownEditor);
