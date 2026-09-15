// yona-markdown-editor 3단계(툴바) - 버튼 UI + CSS 테마 계약.
//
// 구성은 옛 yobi.ui.MarkdownEditor.js `_toolbar()`(2026-09-11 기준
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
//   ::part("preview")            - 미리보기 패널(4단계 추가)
// CSS 커스텀 프로퍼티(--yona-md-*)로 색상/크기/폰트를 노출하되, yobi.css의 옛 재스킨
// (.editor-toolbar 등, yobi.css 12128~12181행)과 시각적으로 동일한 값을
// 컴포넌트 기본값으로 내장한다 - yobi.css가 ::part() 오버라이드를 전혀 안 써도 지금과
// 똑같아 보이는 게 1차 목표(동치성).
//
// 4단계(미리보기): preview 버튼은 문서를 바꾸는 커맨드가 아니라 뷰 토글이라 다른 버튼과
// run/dispatch 경로가 다르다 - createToolbar(view, options)의 options.onPreviewToggle이
// 실제 패널 표시/숨김 + 서버 렌더링 트리거를 담당하고(YonaMarkdownEditor.ts), 여기서는 버튼
// 자체의 active 표시(aria-pressed 포함)만 계속 책임진다.
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

export interface ToolbarOptions {
  /** preview 버튼을 클릭할 때마다 호출된다(active는 클릭 후의 새 상태). */
  onPreviewToggle: (active: boolean) => void;
}

/**
 * 툴바 DOM을 만들어 반환한다. 각 버튼 클릭은 view.dispatch를 통해 문서를 바꾸고,
 * YonaMarkdownEditor의 updateListener(2단계에서 이미 구현됨)가 그 변경을 감지해 light DOM
 * textarea 동기화를 자동으로 처리하므로 여기서 별도로 textarea를 건드리지 않는다.
 */
export function createToolbar(view: EditorView, options: ToolbarOptions): HTMLDivElement {
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
      // preview: 문서를 바꾸지 않는 뷰 토글 - 버튼 자체의 active 표시(+ aria-pressed)는 여기서
      // 책임지고, 실제 패널 표시/숨김과 서버 렌더링 트리거는 호출자(YonaMarkdownEditor)에게
      // 넘긴다.
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const nowActive = button.classList.toggle("is-active");
        button.setAttribute("aria-pressed", nowActive ? "true" : "false");
        options.onPreviewToggle(nowActive);
        view.focus();
      });
    }

    toolbar.appendChild(button);
  }

  return toolbar;
}

/**
 * Shadow DOM 안에 삽입할 기본 스타일. yobi.css의 옛 재스킨(12128~12181행)과
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
  /* 옛 초기화 옵션의 "minHeight": "300px"(yobi.ui.MarkdownEditor.js) 동치 - CM6에는
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

/* 4단계(미리보기): 컨테이너 자체(테두리/여백/최소높이)는 editor-wrapper와 시각적으로
   맞췄다. 안쪽 콘텐츠 타이포그래피(제목 크기/코드블록 배경/링크 색/리스트 간격 등)와
   코드블록 구문강조 색상은 전역 <link>(yobi.css의 .markdown-wrap 규칙, 11331행대 /
   highlight.js styles/default.css)로 로드되어 Shadow DOM 경계를 넘지 못한다 - 사용자
   확정(2026-09-11, 4단계 완료 시점): 3단계 툴바와 동일한 원칙대로 "전체 재현"을 택해,
   두 스타일시트의 실제 규칙을 여기 그대로 옮겨 적었다(전역 <link> 참조나 부분 발췌가
   아니라 컴포넌트 자체 완결 - yobi.css/highlight 테마가 나중에 바뀌면 이 블록도 손으로
   맞춰야 하는 트레이드오프는 감수). popover/markdown-before 등 이 미리보기 패널에서
   실사용되지 않는 규칙(부트스트랩 popover 연동, 편집 중 숨김 토글)은 제외했다. */
.preview-wrap {
  box-sizing: border-box;
  min-height: var(--yona-md-min-height);
  padding: 10px;
  border: 1px solid var(--yona-md-border-color);
  border-radius: 0 0 var(--yona-md-radius) var(--yona-md-radius);
  overflow: auto;
}

/* yobi.css .markdown-wrap (11331~11559행대) 그대로 이식 - 컨테이너 자체 여백(padding)은
   위 .preview-wrap이 이미 담당하므로 원본의 padding 선언은 가져오지 않는다. */
.preview-wrap {
  font-size: 1.1em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  font-feature-settings: "kern" 1;
  font-kerning: normal;
  word-wrap: break-word;
}
.preview-wrap > *:first-child {
  margin-top: 0 !important;
}
.preview-wrap > *:last-child {
  margin-bottom: 0 !important;
}
.preview-wrap ul,
.preview-wrap ol {
  padding: 0 0 5px 2.5em;
  font-weight: normal;
  margin-left: 0;
}
.preview-wrap li {
  margin-bottom: 5px;
  line-height: 1.6em;
}
.preview-wrap li > ul {
  margin-bottom: 0;
  padding: 5px 0 0 2.5em;
}
.preview-wrap li > ul :last-of-type {
  padding-bottom: 0;
}
.preview-wrap li > ul pre {
  padding-bottom: 10px !important;
}
.preview-wrap li > p {
  margin-top: 8px;
  margin-bottom: 2px;
}
.preview-wrap a {
  color: #4183c4;
  text-decoration: none;
}
.preview-wrap a:hover {
  color: #4183c4;
  text-decoration: underline;
}
.preview-wrap a:hover span {
  text-decoration: none;
}
.preview-wrap a:active {
  color: #4183c4;
  text-decoration: none;
}
.preview-wrap h1,
.preview-wrap h2,
.preview-wrap h3 {
  line-height: 40px;
  margin-bottom: 16px;
}
.preview-wrap h1 {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #eee;
  width: 95%;
  font-weight: 600;
}
.preview-wrap h1 .head-anchor,
.preview-wrap h2 .head-anchor,
.preview-wrap h3 .head-anchor,
.preview-wrap h4 .head-anchor,
.preview-wrap h5 .head-anchor {
  margin-left: 3px;
  opacity: 0;
}
.preview-wrap h1:hover .head-anchor,
.preview-wrap h2:hover .head-anchor,
.preview-wrap h3:hover .head-anchor,
.preview-wrap h4:hover .head-anchor,
.preview-wrap h5:hover .head-anchor {
  opacity: 1;
}
.preview-wrap h2 {
  line-height: 1.25;
  font-size: 1.5em;
  width: 95%;
  padding: 0 0 0.3em 0;
  border-bottom: 1px solid #eaecef;
}
.preview-wrap h3 {
  margin: 1em 0 5px;
  font-size: 1.25em;
  padding: 0;
}
.preview-wrap h4 {
  font-size: 1.25em;
  margin-top: 1.2em;
  padding: 0;
}
.preview-wrap h5 {
  font-size: 1em;
  margin-top: 20px;
}
.preview-wrap hr {
  height: 1px;
  margin: 10px 0;
  border: 0;
  color: #ccc;
  background-color: #ccc;
}
.preview-wrap p {
  margin: 0 0 12px 0;
  line-height: 1.6em;
}
.preview-wrap blockquote p {
  font-size: 0.9em;
  font-weight: normal;
}
.preview-wrap code {
  padding: 5px 5px 2px 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: Consolas, "Menlo", "Monaco", "Ubuntu Mono", "source-code-pro", monospace;
  font-size: 13px;
}
.preview-wrap code .title {
  font-size: inherit;
}
.preview-wrap blockquote {
  border-left: 4px solid #DDD;
  padding: 0 15px;
  color: #777;
}
.preview-wrap li > img {
  max-width: 80%;
}
.preview-wrap p > input[type='checkbox'] {
  vertical-align: text-top;
}
.preview-wrap li > input[type='checkbox'] {
  vertical-align: top;
}
.preview-wrap img {
  max-width: 100%;
  margin: 10px 0;
  padding: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  max-height: 600px;
}
.preview-wrap > ul {
  line-height: 20px;
  list-style: disc;
  margin-bottom: 16px;
}
.preview-wrap ul ul,
.preview-wrap ol ul {
  list-style: circle;
}
.preview-wrap ul ul ul,
.preview-wrap ol ul ul,
.preview-wrap ol ol ul,
.preview-wrap ul ol ul {
  list-style: square;
}
.preview-wrap ol {
  line-height: 1.6em;
  list-style: decimal;
}
.preview-wrap pre {
  font-size: 1em;
  background-color: #EFEFEF;
  padding: 10px;
  margin: 10px 0;
  word-break: normal;
  border: none;
}
.preview-wrap pre code {
  margin: 0;
  padding: 0;
  border: none;
}
.preview-wrap table {
  border-collapse: collapse;
  margin: 15px 15px;
}
.preview-wrap table th {
  padding: 5px;
  border: 1px solid #dcddde;
  background-color: #f7f7f7;
  min-width: 45px;
}
.preview-wrap table td {
  padding: 5px;
  border: 1px solid #dcddde;
  word-break: break-all;
}

/* highlight.js styles/default.css 그대로 이식 (100줄 전체 - hljs.highlightElement()가 이
   .preview-wrap 안의 pre code에 붙이는 .hljs-* 클래스를 이 안에서도 동일하게 채색). */
.preview-wrap .hljs {
  display: block;
  overflow-x: auto;
  padding: 0.5em;
  background: #F0F0F0;
}
.preview-wrap .hljs,
.preview-wrap .hljs-subst {
  color: #444;
}
.preview-wrap .hljs-comment {
  color: #888888;
}
.preview-wrap .hljs-keyword,
.preview-wrap .hljs-attribute,
.preview-wrap .hljs-selector-tag,
.preview-wrap .hljs-meta-keyword,
.preview-wrap .hljs-doctag,
.preview-wrap .hljs-name {
  font-weight: bold;
}
.preview-wrap .hljs-type,
.preview-wrap .hljs-string,
.preview-wrap .hljs-number,
.preview-wrap .hljs-selector-id,
.preview-wrap .hljs-selector-class,
.preview-wrap .hljs-quote,
.preview-wrap .hljs-template-tag,
.preview-wrap .hljs-deletion {
  color: #880000;
}
.preview-wrap .hljs-title,
.preview-wrap .hljs-section {
  color: #880000;
  font-weight: bold;
}
.preview-wrap .hljs-regexp,
.preview-wrap .hljs-symbol,
.preview-wrap .hljs-variable,
.preview-wrap .hljs-template-variable,
.preview-wrap .hljs-link,
.preview-wrap .hljs-selector-attr,
.preview-wrap .hljs-selector-pseudo {
  color: #BC6060;
}
.preview-wrap .hljs-literal {
  color: #78A960;
}
.preview-wrap .hljs-built_in,
.preview-wrap .hljs-bullet,
.preview-wrap .hljs-code,
.preview-wrap .hljs-addition {
  color: #397300;
}
.preview-wrap .hljs-meta {
  color: #1f7199;
}
.preview-wrap .hljs-meta-string {
  color: #4d99bf;
}
.preview-wrap .hljs-emphasis {
  font-style: italic;
}
.preview-wrap .hljs-strong {
  font-weight: bold;
}
`;
