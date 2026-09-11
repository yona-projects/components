// yona-markdown-editor 3단계(툴바) - 버튼 UI + CSS 테마 계약.
//
// 구성은 옛 yobi.ui.MarkdownEditor.js `_toolbar()`(EasyMDE 재스킨판, 2026-09-11 기준
// git show f65747d1f~1:.../yobi.ui.MarkdownEditor.js로 확인)와 동일하다:
//   Bold/Italic | Heading("H")/Quote | Checklist/Generic list/Numbered list("1.") |
//   Link/Image | Preview
// 아이콘 클래스(yobicon-bold/italic/quote/list/list-alt/link/image/preview)의 실제
// 코드포인트는 src/main/resources/static/stylesheets/yobicon/style.css에서 그대로 옮겼다
// (아래 ICON 상수 참고). heading/ordered-list는 원본처럼 대응하는 yobicon이 없어 텍스트
// 라벨("H"/"1.")을 쓴다.
//
// CSS 테마 계약(계획서 stateless-launching-ripple.md 3단계 절 참고):
//   ::part("toolbar")            - 툴바 컨테이너
//   ::part("button button-{command}") - 각 버튼(공용 "button" + 커맨드별 토큰)
//   ::part("separator")          - 구분선
//   ::part("editor")             - CM6 마운트 지점을 감싸는 wrapper
// CSS 커스텀 프로퍼티(--yona-md-*)로 색상/크기/폰트를 노출하되, yobi.css의 옛 재스킨
// (.EasyMDEContainer .editor-toolbar 등, yobi.css 12128~12181행)과 시각적으로 동일한 값을
// 컴포넌트 기본값으로 내장한다 - yobi.css가 ::part() 오버라이드를 전혀 안 써도 지금과
// 똑같아 보이는 게 1차 목표(동치성).
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { CommandResult } from "./commands.js";
import {
  toggleBold,
  toggleItalic,
  toggleHeading,
  toggleQuote,
  toggleCheckList,
  toggleUnorderedList,
  toggleOrderedList,
  insertLink,
  insertImage,
} from "./commands.js";

// yobicon/style.css의 코드포인트(사설 영역 유니코드) - 폰트 자체는 @font-face로 전역
// 등록되어 있어(yobi.css/yobicon/style.css) Shadow DOM 경계를 넘어 참조 가능하므로 여기서
// 재선언하지 않는다.
const ICON = {
  bold: "",
  italic: "",
  quote: "",
  checklist: "",
  unorderedList: "",
  link: "",
  image: "",
  preview: "",
} as const;

interface ToolbarButtonSpec {
  /** part="button button-{command}"의 {command} 부분이자 내부 아이콘 클래스 선택자로도 쓰인다. */
  command: string;
  title: string;
  /** 텍스트 라벨 버튼(heading/ordered-list)일 때만 채운다. */
  text?: string;
  /** 아이콘 폰트 버튼일 때만 채운다. */
  iconChar?: string;
  /** 실제 문서를 바꾸는 커맨드(commands.ts의 순수 함수). 없으면(preview) 버튼 자체의 active
   * 상태만 토글하는 placeholder. */
  run?: (state: EditorState) => CommandResult;
}

type ToolbarItem = ToolbarButtonSpec | "separator";

function buildToolbarSpec(): ToolbarItem[] {
  return [
    { command: "bold", title: "Bold", iconChar: ICON.bold, run: toggleBold },
    { command: "italic", title: "Italic", iconChar: ICON.italic, run: toggleItalic },
    "separator",
    { command: "heading", title: "Heading", text: "H", run: toggleHeading },
    { command: "quote", title: "Quote", iconChar: ICON.quote, run: toggleQuote },
    "separator",
    { command: "checklist", title: "Checklist", iconChar: ICON.checklist, run: toggleCheckList },
    { command: "unordered-list", title: "Generic list", iconChar: ICON.unorderedList, run: toggleUnorderedList },
    { command: "ordered-list", title: "Numbered list", text: "1.", run: toggleOrderedList },
    "separator",
    { command: "link", title: "Create link", iconChar: ICON.link, run: insertLink },
    { command: "image", title: "Insert image", iconChar: ICON.image, run: insertImage },
    "separator",
    // P3-46 3단계 지시 범위: 자리만 만든다(버튼 UI + part="button button-preview"). 실제
    // 미리보기 패널/렌더링은 4단계 범위 - run이 없으므로 클릭 시 버튼 자체의 active 표시만
    // 토글하고(placeholder) 문서는 건드리지 않는다.
    { command: "preview", title: "Toggle preview", iconChar: ICON.preview },
  ];
}

function runCommand(view: EditorView, fn: (state: EditorState) => CommandResult): void {
  const spec = fn(view.state);
  if (spec) {
    view.dispatch(spec);
  }
  view.focus();
}

/**
 * 툴바 DOM을 만들어 반환한다. 각 버튼 클릭은 view.dispatch를 통해 문서를 바꾸고,
 * YonaMarkdownEditor의 updateListener(2단계에서 이미 구현됨)가 그 변경을 감지해 light DOM
 * textarea 동기화를 자동으로 처리하므로 여기서 별도로 textarea를 건드리지 않는다.
 */
export function createToolbar(view: EditorView): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.setAttribute("part", "toolbar");
  toolbar.className = "toolbar";

  for (const item of buildToolbarSpec()) {
    if (item === "separator") {
      const separator = document.createElement("span");
      separator.setAttribute("part", "separator");
      separator.className = "separator";
      separator.setAttribute("aria-hidden", "true");
      toolbar.appendChild(separator);
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("part", `button button-${item.command}`);
    button.title = item.title;
    button.setAttribute("aria-label", item.title);

    if (item.text !== undefined) {
      button.className = "toolbar-button text-icon";
      button.textContent = item.text;
    } else {
      button.className = `toolbar-button icon icon-${item.command}`;
      // 스크린리더용 텍스트는 title/aria-label로 이미 제공되므로, 아이콘 glyph 자체는
      // CSS ::before(content: attr(data-icon))로 그린다 - 텍스트 노드로 넣으면 스크린리더가
      // 사설영역 유니코드를 그대로 읽으려 시도할 수 있다.
      if (item.iconChar !== undefined) {
        button.setAttribute("data-icon", item.iconChar);
      }
    }

    if (item.run) {
      const run = item.run;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        runCommand(view, run);
      });
    } else {
      // preview: 4단계 범위 - 지금은 버튼 자체의 active 표시만 토글하는 placeholder.
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const nowActive = button.classList.toggle("is-active");
        button.setAttribute("aria-pressed", nowActive ? "true" : "false");
        view.focus();
      });
    }

    toolbar.appendChild(button);
  }

  return toolbar;
}

/**
 * Shadow DOM 안에 삽입할 기본 스타일. yobi.css의 옛 EasyMDE 재스킨(12128~12181행)과
 * 시각적으로 동일한 값을 컴포넌트 기본값으로 내장한다 - yobi.css는 필요시 이 CSS 커스텀
 * 프로퍼티만 오버라이드하면 된다.
 */
export const TOOLBAR_STYLES = `
:host {
  --yona-md-toolbar-bg: #fafafa;
  --yona-md-border-color: rgba(0, 0, 0, 0.15);
  --yona-md-radius: 4px;
  --yona-md-button-radius: 3px;
  --yona-md-button-bg: #fff;
  --yona-md-button-color: #333;
  --yona-md-accent-color: #51AACC;
  --yona-md-accent-text-color: #fff;
  --yona-md-disabled-opacity: 0.35;
  --yona-md-font-family: Consolas, Menlo, Monaco, monospace;
  --yona-md-font-size: 13px;
  --yona-md-icon-font-family: 'yobicon';
  /* 옛 EasyMDE 초기화 옵션의 "minHeight": "300px"(yobi.ui.MarkdownEditor.js) 동치 - CM6에는
     그런 옵션이 없어 mount된 .cm-editor에 직접 min-height를 준다. */
  --yona-md-min-height: 300px;

  display: block;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  box-sizing: border-box;
  background-color: var(--yona-md-toolbar-bg);
  border: 1px solid var(--yona-md-border-color);
  border-bottom: none;
  border-radius: var(--yona-md-radius) var(--yona-md-radius) 0 0;
  padding: 6px 8px;
  margin-bottom: 4px;
}

.toolbar-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  min-width: 30px;
  margin: 0 2px 0 0;
  padding: 0 8px;
  font-size: 14px;
  line-height: 24px;
  color: var(--yona-md-button-color);
  background-color: var(--yona-md-button-bg);
  border: 1px solid var(--yona-md-border-color);
  border-radius: var(--yona-md-button-radius);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  transition: all 0.3s ease;
}

.toolbar-button:hover,
.toolbar-button.is-active {
  background-color: var(--yona-md-accent-color);
  border-color: var(--yona-md-accent-color);
  color: var(--yona-md-accent-text-color);
}

.toolbar-button:disabled {
  opacity: var(--yona-md-disabled-opacity);
  cursor: default;
}

.toolbar-button.icon::before {
  font-family: var(--yona-md-icon-font-family);
  font-style: normal;
  font-weight: normal;
  vertical-align: middle;
  content: attr(data-icon);
}

.toolbar-button.text-icon {
  font-family: Arial, sans-serif;
  font-weight: bold;
}

.separator {
  display: inline-block;
  align-self: stretch;
  border-left: 1px solid var(--yona-md-border-color);
  width: 0;
  min-height: 18px;
  margin: 0 6px;
}

.editor-wrapper {
  box-sizing: border-box;
  border: 1px solid var(--yona-md-border-color);
  border-radius: 0 0 var(--yona-md-radius) var(--yona-md-radius);
}

.editor-wrapper:focus-within {
  border-color: var(--yona-md-accent-color);
}

.editor-wrapper .cm-editor {
  min-height: var(--yona-md-min-height);
}
`;
