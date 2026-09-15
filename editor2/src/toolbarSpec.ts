// Vue SFC판(editor2)의 툴바 - 원본(components/editor의 toolbar.ts)이 직접 DOM을 만들어
// 붙이던 것과 달리, 여기서는 순수 데이터(spec)만 내보내고 실제 <button> 렌더링은
// YonaMarkdownEditor.vue의 템플릿(v-for)이 담당한다 - Vue는 imperative DOM 생성 대신
// 선언적 템플릿을 쓰는 게 관용적이기 때문.
//
// 버튼 구성/아이콘 코드포인트/동치성 근거는 원본 toolbar.ts의 주석을 그대로 따른다 -
// yobi.ui.MarkdownEditor.js `_toolbar()`와 동일: Bold/Italic | Heading("H")/Quote |
// Checklist/Generic list/Numbered list("1.") | Link/Image | Preview.
import type { EditorState } from "@codemirror/state";
import type { CommandResult } from "./commands";
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
} from "./commands";

// yobicon/style.css의 코드포인트(사설 영역 유니코드) - 원본 toolbar.ts의 ICON 상수와 동일.
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

export interface ToolbarButtonSpec {
  /** 커맨드 식별자이자 클래스 선택자(icon-{command})로도 쓰인다. */
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

export type ToolbarItem = ToolbarButtonSpec | "separator";

export function buildToolbarSpec(): ToolbarItem[] {
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
    // preview: run이 없다 - 클릭 시 버튼 자체의 active 표시만 토글하고(YonaMarkdownEditor.vue의
    // onPreviewToggle) 문서는 건드리지 않는다.
    { command: "preview", title: "Toggle preview", iconChar: ICON.preview },
  ];
}
