// yona-markdown-editor 2~3단계(셸: 폼 통합 + 기본 편집 / 툴바 + CSS 테마 계약).
//
// 2단계 목표는 딱 세 가지였다:
//   1) light DOM에 기존 markdownEditor 프래그먼트의 <textarea> 계약(name/id(editor- 접두어)/
//      data-editor-mode/markdown="true")을 그대로 재현한 실제 <textarea>를 렌더링한다 — 기존
//      폼 제출 코드(jQuery Form Plugin ajaxSubmit, raw $.ajax 등)가 지금처럼 이 textarea의
//      DOM value를 그대로 읽을 수 있어야 한다.
//   2) Shadow DOM 안에 CodeMirror 6 EditorView를 마운트한다(0단계 스파이크에서 Chromium/
//      Firefox/WebKit 3개 엔진 전부 검증된 방식 그대로 — root 옵션 등).
//   3) CM6 문서가 바뀔 때마다 light DOM textarea.value를 갱신하고 input/keyup 네이티브 이벤트를
//      재발행한다(yobi.ui.MarkdownEditor.js의 `codemirror.on("change", ...)` 패턴과 동일 —
//      임시저장 시스템이 이 이벤트에 의존).
//
// 3단계에서 추가한 것: 9개 툴바 커맨드(src/toolbar.ts, src/commands.ts)와 ::part()/CSS 커스텀
// 프로퍼티 테마 계약. Shadow DOM 내부 구조가
//   <style>...</style> <div part="toolbar">...</div> <div part="editor">(CM6 mount)</div>
// 로 바뀌었다 - EditorView의 parent가 shadow 루트 자체에서 "editor" wrapper div로 바뀌었을 뿐,
// root 옵션(0단계에서 검증된 셀렉션/포커스 동작)은 그대로 shadow를 가리킨다.
//
// 4단계(이번 변경)에서 추가한 것: 미리보기 서버 렌더링 재연동(src/preview.ts). preview 툴바
// 버튼을 누르면 CM6 에디터 뷰(part="editor")와 미리보기 패널(part="preview")을 서로
// hidden 속성으로 토글한다(EasyMDE 시절과 동일한 단일 뷰 토글 - side-by-side 아님). 켜지는
// 시점과, 켜진 채로 문서가 바뀔 때마다 PreviewController.scheduleRender()를 호출한다(300ms
// 디바운스 + 요청 순번 레이스가드는 preview.ts 참고). 멘션은 5단계 범위라 여기서 다루지 않는다.
//
// 호환 shim(P3-46 8번 항목 2단계, 사용자 결정 확정 2026-09-11): yobi.Attachments.js/
// yona.CommentAttachmentsUpdate.js는 첨부파일 카드 클릭으로 본문에 링크를 삽입할 때
// $textarea.data("easymde")로 얻은 EasyMDE 인스턴스의 .value(newValue)를 호출해 raw
// textarea.val() 조작 결과를 CodeMirror 쪽 버퍼에도 강제로 반영한다(그렇지 않으면 다음 편집
// 시 CM이 자신의 예전 버퍼로 textarea를 덮어써 방금 넣은 링크가 사라진다 - P3-50에서 이미 한번
// 고친 데이터 손실 버그). yobi.ui.MarkdownEditor.js를 걷어내면서 이 두 파일이 계속 그대로
// 동작하도록, 같은 jQuery data 키("easymde")에 최소 shim({ value(newValue?) })을 노출한다.
// yobi.Mention.js도 이 키를 읽지만(easyMDE.codemirror로 Tribute attach 대상을 찾음) 멘션은
// 5단계에서 CM6용으로 재구현하기로 이미 계획된 범위라 이 shim은 그 용도를 지원하지 않는다
// (사용자 확정 - 멘션 일시 먹통 허용, codemirror 키는 의도적으로 shim에 없음).
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { createToolbar, TOOLBAR_STYLES } from "./toolbar.js";
import { PreviewController } from "./preview.js";

interface LegacyEasyMdeShim {
  value(newValue?: string): string | undefined;
}

interface JQueryLike {
  (target: unknown): { data(key: string, value: unknown): void };
}

declare global {
  interface Window {
    jQuery?: JQueryLike;
  }
}

// 여러 <yona-markdown-editor> 인스턴스가 한 페이지에 동시에 존재할 수 있다(예: issue/view의
// 새 댓글 폼 + 기존 댓글 수정 폼들 - 2단계 깊이 중첩). 기존에는 서버(Thymeleaf)가
// #strings.randomAlphanumeric(8)로 textarea id를 유일하게 만들었지만, 이제 textarea 자체를
// 컴포넌트가 만들기 때문에 유일성 보장도 클라이언트 쪽(이 카운터)으로 옮긴다. 멘션 셀렉터
// (textarea[id^=editor-])는 접두어만 보므로 정확한 접미어 생성 방식에는 의존하지 않는다.
let instanceCounter = 0;

export class YonaMarkdownEditor extends HTMLElement {
  private view: EditorView | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private editorWrapper: HTMLDivElement | null = null;
  private previewPanel: HTMLDivElement | null = null;
  private previewController: PreviewController | null = null;
  private previewActive = false;

  connectedCallback(): void {
    if (this.shadowRoot) {
      // 이미 attach된 경우(재연결 등) 다시 초기화하지 않는다.
      return;
    }

    // "value"는 슬롯 콘텐츠(서버가 th:text로 채워 넣는 이 엘리먼트의 텍스트 콘텐츠) 또는
    // value 속성 중 하나로 온다 - value 속성이 명시적으로 있으면 그것을 우선한다.
    const initialValue = this.hasAttribute("value")
      ? (this.getAttribute("value") ?? "")
      : (this.textContent ?? "");

    const name = this.getAttribute("name") ?? "";
    const editorMode = this.getAttribute("editor-mode") ?? "";
    // markdownEditor 프래그먼트(site/layout.html)는 이 커스텀 엘리먼트를 감싸는 바깥
    // <div data-toggle="markdown-editor" th:data-markdown-render-url="...">에 렌더 URL을
    // 노출한다(project 컨텍스트가 없는 화면은 이 속성 자체가 없다 - th:data-* 표현식이 null이면
    // Thymeleaf가 속성을 렌더링하지 않는다, 8-2단계에서 이미 확인된 동작). closest()는 light
    // DOM 조상을 그대로 타고 올라가므로 이 커스텀 엘리먼트가 light DOM에 있는 한 항상 동작한다.
    const renderUrl = this.closest('[data-toggle="markdown-editor"]')?.getAttribute(
      "data-markdown-render-url",
    ) ?? null;

    // 컴포넌트가 스스로 light DOM을 재구성하기 전에, 서버가 슬롯 콘텐츠로 넣어준 원본 텍스트는
    // 이미 initialValue로 읽어뒀으니 이제 지워도 안전하다.
    this.textContent = "";

    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.id = `editor-${name || "field"}-${++instanceCounter}`;
    textarea.setAttribute("data-editor-mode", editorMode);
    textarea.setAttribute("markdown", "true");
    textarea.value = initialValue;
    // Shadow DOM 안의 CM6가 실제 편집 UI를 담당하므로, light DOM textarea 자체는 화면에
    // 보이지 않아도 된다(기존 EasyMDE가 원본 textarea를 display:none으로 숨기던 것과 동일한
    // 역할 분담) - 다만 폼 제출/멘션 셀렉터/임시저장 등은 이 textarea의 DOM 존재와 값에 계속
    // 의존하므로 DOM에서 제거하지 않고 숨기기만 한다.
    textarea.style.display = "none";
    this.appendChild(textarea);
    this.textarea = textarea;

    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = TOOLBAR_STYLES;
    shadow.appendChild(style);

    // CM6 EditorView는 이 wrapper(part="editor")에 마운트한다 - shadow 루트 자체가 아니라
    // 툴바 아래의 별도 컨테이너에 마운트해야 "툴바 위/에디터 아래" 레이아웃이 된다. root 옵션은
    // 여전히 shadow를 가리킨다(0단계에서 검증된 셀렉션/포커스 동작 유지 - parent와 root는
    // 서로 다른 개념: parent는 DOM 삽입 위치, root는 document.getSelection() 등을 대체할
    // 때 쓰는 selection root).
    const editorWrapper = document.createElement("div");
    editorWrapper.setAttribute("part", "editor");
    editorWrapper.className = "editor-wrapper";
    shadow.appendChild(editorWrapper);
    this.editorWrapper = editorWrapper;

    // 미리보기 패널 - 기본은 숨김(에디터 뷰가 기본 표시). preview 버튼을 누르면 이 패널과
    // editorWrapper가 서로 hidden을 토글한다(단일 뷰 토글 - side-by-side 아님).
    // "markdown-wrap" 클래스는 4단계 지시(A.2)대로 부여했다 - 그 클래스가 사이트에서 내는
    // 실제 시각 효과를 Shadow DOM 안에 어떻게 재현할지는 preview.ts/toolbar.ts 상단 주석에
    // 적어둔 대로 아직 결정 대기 중이다.
    const previewPanel = document.createElement("div");
    previewPanel.setAttribute("part", "preview");
    previewPanel.className = "preview-wrap markdown-wrap";
    previewPanel.hidden = true;
    shadow.appendChild(previewPanel);
    this.previewPanel = previewPanel;

    this.previewController = new PreviewController({ renderUrl, panel: previewPanel });

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.theme({
            "&": {
              fontFamily: "var(--yona-md-font-family, Consolas, Menlo, Monaco, monospace)",
              fontSize: "var(--yona-md-font-size, 13px)",
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            this.syncTextareaFromEditor();
            if (this.previewActive) {
              this.previewController?.scheduleRender(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: editorWrapper,
      root: shadow,
    });

    this.view = view;

    // 툴바는 view가 만들어진 뒤에 붙인다(각 버튼 클릭 핸들러가 이 view를 직접 참조 - 3단계).
    // 시각 순서(툴바가 에디터 위)를 맞추기 위해 이미 삽입된 editorWrapper 앞에 끼워 넣는다.
    const toolbar = createToolbar(view, {
      onPreviewToggle: (active) => this.handlePreviewToggle(active),
    });
    shadow.insertBefore(toolbar, editorWrapper);

    this.exposeLegacyEasyMdeShim();
  }

  /**
   * yobi.Attachments.js/yona.CommentAttachmentsUpdate.js 호환용(위 파일 상단 주석 참고).
   * jQuery가 로드돼 있을 때만 등록한다(이 컴포넌트 자체는 jQuery에 의존하지 않지만, yona의
   * 모든 페이지는 이미 전역 jQuery를 로드해두므로 실제로는 항상 등록된다).
   */
  private exposeLegacyEasyMdeShim(): void {
    const jq = window.jQuery;
    if (!jq || !this.textarea) {
      return;
    }

    const shim: LegacyEasyMdeShim = {
      value: (newValue?: string) => {
        if (!this.view) {
          return undefined;
        }
        if (newValue === undefined) {
          return this.view.state.doc.toString();
        }
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: newValue },
        });
        return undefined;
      },
    };

    jq(this.textarea).data("easymde", shim);
  }

  disconnectedCallback(): void {
    this.previewController?.dispose();
    this.view?.destroy();
    this.view = null;
  }

  /**
   * preview 툴바 버튼 클릭 시 toolbar.ts가 호출한다(active는 클릭 후의 새 상태). 단일 뷰
   * 토글 - 에디터와 미리보기 패널이 서로 hidden을 주고받는다. 켜지는 시점에는 항상 최신 문서로
   * 1회 렌더링을 예약한다(그 이후의 렌더링은 updateListener의 docChanged 훅이 담당).
   */
  private handlePreviewToggle(active: boolean): void {
    this.previewActive = active;
    if (this.editorWrapper) {
      this.editorWrapper.hidden = active;
    }
    if (this.previewPanel) {
      this.previewPanel.hidden = !active;
    }
    if (active && this.view) {
      this.previewController?.scheduleRender(this.view.state.doc.toString());
    }
  }

  private syncTextareaFromEditor(): void {
    if (!this.textarea || !this.view) {
      return;
    }
    this.textarea.value = this.view.state.doc.toString();
    // yobi.ui.MarkdownEditor.js의 codemirror.on("change", ...)와 동일한 패턴 - 임시저장
    // (yona.temporarySaveHandler.js) 등 이 textarea를 직접 구독하는 기존 jQuery 핸들러에
    // 값이 바뀌었다는 신호를 보낸다.
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
    this.textarea.dispatchEvent(new Event("keyup", { bubbles: true }));
  }
}

customElements.define("yona-markdown-editor", YonaMarkdownEditor);
