// yona-markdown-editor - Shadow DOM에 마운트된 CodeMirror 6 에디터를 light DOM <textarea>와
// 동기화하는 커스텀 엘리먼트.
//
// light DOM textarea는 기존 markdownEditor 프래그먼트의 계약(name/id(editor- 접두어)/
// data-editor-mode/markdown="true")을 그대로 유지한다 - 기존 폼 제출 코드(jQuery Form Plugin
// ajaxSubmit, raw $.ajax 등)가 이 textarea의 DOM value를 읽기 때문이다. CM6 문서가 바뀌면
// textarea.value를 갱신하고 input/keyup 네이티브 이벤트를 재발행한다(임시저장 시스템이 이
// 이벤트에 의존).
//
// 멘션 확장(mention.ts)은 data-mention-url이 있을 때만 등록한다 - "@"/":"/"#" 3트리거를 한
// 단위로 켜고 끄던 옛 yobi.Mention() 동작을 유지하기 위해서다.
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { createToolbar, TOOLBAR_STYLES } from "./toolbar.js";
import { PreviewController } from "./preview.js";
import { createMentionExtension, MENTION_STYLES } from "./mention.js";

// 여러 <yona-markdown-editor> 인스턴스가 한 페이지에 동시에 존재할 수 있다(예: 새 댓글 폼 +
// 기존 댓글 수정 폼들). 기존엔 서버가 #strings.randomAlphanumeric(8)로 textarea id를 유일하게
// 만들었지만, 이제 textarea를 컴포넌트가 만들므로 유일성 보장도 클라이언트(이 카운터)로 옮긴다.
// 멘션 셀렉터(textarea[id^=editor-])는 접두어만 보므로 정확한 접미어 생성 방식에는 의존하지
// 않는다.
let instanceCounter = 0;

export class YonaMarkdownEditor extends HTMLElement {
  private view: EditorView | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private editorWrapper: HTMLDivElement | null = null;
  private previewPanel: HTMLDivElement | null = null;
  private previewController: PreviewController | null = null;
  private previewActive = false;
  // form.reset() 대응(아래 connectedCallback 내 reset 리스너 주석 참고)을 위해 최초 로드 시점의
  // 값을 인스턴스 필드로 보존해둔다 - connectedCallback의 로컬 변수로는 리스너 콜백에서 접근할
  // 수 없다.
  private initialValue = "";
  private formResetHandler: (() => void) | null = null;
  private form: HTMLFormElement | null = null;

  connectedCallback(): void {
    if (this.shadowRoot) {
      // 이미 attach된 경우(재연결 등) 다시 초기화하지 않는다.
      return;
    }

    // "value"는 슬롯 콘텐츠(서버가 th:text로 채우는 텍스트 콘텐츠) 또는 value 속성 중 하나로
    // 온다 - 속성이 있으면 그것을 우선한다.
    const initialValue = this.hasAttribute("value")
      ? (this.getAttribute("value") ?? "")
      : (this.textContent ?? "");
    this.initialValue = initialValue;

    const name = this.getAttribute("name") ?? "";
    const editorMode = this.getAttribute("editor-mode") ?? "";
    // markdownEditor 프래그먼트(site/layout.html)가 감싸는
    // <div data-toggle="markdown-editor" th:data-markdown-render-url="...">에서 렌더 URL을
    // 읽는다 - project 컨텍스트가 없는 화면은 Thymeleaf가 null 표현식의 속성을 렌더링하지
    // 않으므로 이 속성 자체가 없다.
    const renderUrl = this.closest('[data-toggle="markdown-editor"]')?.getAttribute(
      "data-markdown-render-url",
    ) ?? null;
    // 멘션 API URL도 같은 wrapper의 data-mention-url로 노출된다(render URL과 동일한 게이트).
    const mentionUrl = this.closest('[data-toggle="markdown-editor"]')?.getAttribute(
      "data-mention-url",
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
    // .value만 세팅하면 네이티브 textarea의 "기본값"은 빈 문자열로 남는다 - 부모 <form>에서
    // form.reset()이 호출되면 브라우저가 .value를 defaultValue(즉 빈 문자열)로 되돌려버려,
    // Shadow DOM 안 CM6 에디터(전혀 영향받지 않음)와 이 textarea가 서로 다른 내용을 들고 있는
    // 상태가 된다. defaultValue를 initialValue로 맞춰두면 네이티브 reset이 이 textarea 자체를
    // 최초 로드 값으로 되돌리므로, 아래 reset 리스너는 CM6 쪽만 같은 값으로 맞춰주면 된다.
    textarea.defaultValue = initialValue;
    // Shadow DOM 안의 CM6가 실제 편집 UI를 담당하므로, light DOM textarea 자체는 화면에
    // 보이지 않아도 된다 - 다만 폼 제출/멘션 셀렉터/임시저장 등은 이 textarea의 DOM 존재와
    // 값에 계속 의존하므로 DOM에서 제거하지 않고 숨기기만 한다.
    textarea.style.display = "none";
    this.appendChild(textarea);
    this.textarea = textarea;

    // 부모 <form>에서 form.reset()이 호출되면, 네이티브 reset이 위 textarea.value를 이미
    // defaultValue(initialValue)로 되돌린 "이후"에 이 리스너가 실행된다(reset 이벤트는 필드가
    // 리셋된 뒤 버블링된다) - Shadow DOM 안 CM6 뷰만 같은 initialValue로 맞춰주면 textarea와
    // 에디터가 다시 일치한다.
    const form = this.closest("form");
    if (form) {
      const handler = () => {
        if (!this.view) {
          return;
        }
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: this.initialValue },
        });
      };
      form.addEventListener("reset", handler);
      this.form = form;
      this.formResetHandler = handler;
    }

    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = TOOLBAR_STYLES + MENTION_STYLES;
    shadow.appendChild(style);

    // CM6 EditorView는 이 wrapper(part="editor")에 마운트한다 - shadow 루트가 아니라 툴바
    // 아래 별도 컨테이너에 마운트해야 "툴바 위/에디터 아래" 레이아웃이 된다. root 옵션은 여전히
    // shadow를 가리킨다(parent는 DOM 삽입 위치, root는 document.getSelection() 등을 대체하는
    // selection root - 서로 다른 개념).
    const editorWrapper = document.createElement("div");
    editorWrapper.setAttribute("part", "editor");
    editorWrapper.className = "editor-wrapper";
    shadow.appendChild(editorWrapper);
    this.editorWrapper = editorWrapper;

    // 미리보기 패널 - 기본은 숨김. preview 버튼을 누르면 이 패널과 editorWrapper가 서로
    // hidden을 토글한다(단일 뷰 - side-by-side 아님). "markdown-wrap" 클래스는 시맨틱만 맞춘
    // 것이고, Shadow DOM에는 전역 yobi.css가 닿지 않으므로 실제 스타일은 toolbar.ts의
    // .preview-wrap 셀렉터로 재현해뒀다.
    const previewPanel = document.createElement("div");
    previewPanel.setAttribute("part", "preview");
    previewPanel.className = "preview-wrap markdown-wrap";
    previewPanel.hidden = true;
    shadow.appendChild(previewPanel);
    this.previewPanel = previewPanel;

    this.previewController = new PreviewController({ renderUrl, panel: previewPanel });

    const extensions: Extension[] = [
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
    ];
    // mentionUrl이 없는 화면에서는 확장 자체를 추가하지 않는다 - "@"/":"/"#" 3트리거를 한
    // 단위로 켜고 끄던 옛 yobi.Mention() 동작 유지.
    if (mentionUrl) {
      extensions.push(createMentionExtension({ getMentionUrl: () => mentionUrl }));
    }

    const view = new EditorView({
      state: EditorState.create({ doc: initialValue, extensions }),
      parent: editorWrapper,
      root: shadow,
    });

    this.view = view;

    // 툴바는 view가 만들어진 뒤에 붙인다(버튼 클릭 핸들러가 view를 직접 참조). 시각 순서
    // (툴바가 에디터 위)를 맞추기 위해 이미 삽입된 editorWrapper 앞에 끼워 넣는다.
    const toolbar = createToolbar(view, {
      onPreviewToggle: (active) => this.handlePreviewToggle(active),
    });
    shadow.insertBefore(toolbar, editorWrapper);
  }

  /**
   * jQuery 제거 이후, 이전 `.data(...)` shim과 동일한 계약(get: CM6 문서 전체 문자열, set:
   * 문서 전체 치환)을 네이티브 프로퍼티로 노출한다. 소비자(yona.Attachments.js 등)는
   * `textarea.closest('yona-markdown-editor')`로 이 엘리먼트를 찾아 `.value`로 직접 접근한다.
   * view가 없으면(연결 전) get은 빈 문자열, set은 무시한다.
   */
  get value(): string {
    return this.view ? this.view.state.doc.toString() : "";
  }

  set value(newValue: string) {
    if (!this.view) {
      return;
    }
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: newValue },
    });
  }

  disconnectedCallback(): void {
    this.previewController?.dispose();
    this.view?.destroy();
    this.view = null;
    if (this.form && this.formResetHandler) {
      this.form.removeEventListener("reset", this.formResetHandler);
    }
    this.form = null;
    this.formResetHandler = null;
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
    this.textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }
}

customElements.define("yona-markdown-editor", YonaMarkdownEditor);
