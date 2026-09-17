// yona-markdown-editor 툴바 커맨드 - 순수 함수(View/DOM 비의존)라 Node에서 바로 단위
// 테스트한다(test/commands.test.ts). 구 yobi.ui.MarkdownEditor.js `_toolbar()`의 커맨드를
// CM6 EditorState 기반으로 재구현했다 - 레퍼런스: easy-markdown-editor
// (https://github.com/Ionaru/easy-markdown-editor)의 _toggleBlock/_toggleHeading/
// _toggleLine/_toggleLink/_replaceSelection.
//
// CM5 -> CM6 포팅 시 대체한 지점(동작은 동일, 메커니즘만 다름):
// - "이미 굵게/기울임 상태인가" 판정은 CM5 모드 토크나이저(getState()) 대신 lezer 구문 트리
//   (StrongEmphasis/Emphasis 노드)로 한다 - CM6에는 그 토크나이저가 없다.
// - 목록/체크리스트/인용의 "이미 적용됐는가" 판정은 레퍼런스가 코너 케이스에서만 쓰던 텍스트
//   정규식 폴백을 항상 쓰는 것으로 단순화했다(CM5 토크나이저 의존 제거, 결과는 동일).
//
// link/image는 레퍼런스의 "삽입" 분기만 재현했다 - 이미 링크/이미지 안에 있을 때 "해제"하는
// 분기는 구현하지 않았다(범위 밖).
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";

/** 커맨드 하나가 만들어내는 트랜잭션 스펙. null이면 아무 것도 하지 않는다(no-op). */
export type CommandResult = TransactionSpec | null;

function mainRange(state: EditorState): { from: number; to: number } {
  const sel = state.selection.main;
  return { from: sel.from, to: sel.to };
}

// ---------------------------------------------------------------------------
// Bold / Italic - 레퍼런스 소스의 _toggleBlock() 동치 (toggleBold/toggleItalic)
// ---------------------------------------------------------------------------

export type EmphasisKind = "bold" | "italic";

const EMPHASIS_NODE_NAME: Record<EmphasisKind, string> = {
  bold: "StrongEmphasis",
  italic: "Emphasis",
};

const EMPHASIS_MARKER: Record<EmphasisKind, string> = {
  bold: "**",
  italic: "*",
};

function findEnclosingNode(
  state: EditorState,
  pos: number,
  typeName: string,
): { from: number; to: number } | null {
  // 뷰가 붙어있지 않은 EditorState(단위 테스트)에서도 syntaxTree()가 빈 트리를 돌려줄 수 있어
  // ensureSyntaxTree로 해당 위치까지는 확실히 파싱을 강제한다(실제 컴포넌트에서도 안전).
  const tree = ensureSyntaxTree(state, pos, 1000) ?? syntaxTree(state);
  let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, 1);
  for (; node; node = node.parent) {
    if (node.type.name === typeName) {
      return { from: node.from, to: node.to };
    }
  }
  return null;
}

function clampIntoInner(pos: number, target: { from: number; to: number }, markerLength: number): number {
  const innerFrom = target.from + markerLength;
  const innerTo = target.to - markerLength;
  return Math.min(Math.max(pos, innerFrom), innerTo) - markerLength;
}

export function toggleEmphasis(state: EditorState, kind: EmphasisKind): CommandResult {
  const { from, to } = mainRange(state);
  const marker = EMPHASIS_MARKER[kind];
  const markerLength = marker.length;
  const target = findEnclosingNode(state, from, EMPHASIS_NODE_NAME[kind]);

  if (target) {
    const inner = state.doc.sliceString(target.from + markerLength, target.to - markerLength);
    return {
      changes: { from: target.from, to: target.to, insert: inner },
      selection: {
        anchor: clampIntoInner(from, target, markerLength),
        head: clampIntoInner(to, target, markerLength),
      },
    };
  }

  let text = state.sliceDoc(from, to);
  if (kind === "bold") {
    text = text.split("**").join("").split("__").join("");
  } else {
    text = text.split("*").join("").split("_").join("");
  }
  const anchor = from + markerLength;
  return {
    changes: { from, to, insert: marker + text + marker },
    selection: { anchor, head: anchor + text.length },
  };
}

export const toggleBold = (state: EditorState): CommandResult => toggleEmphasis(state, "bold");
export const toggleItalic = (state: EditorState): CommandResult => toggleEmphasis(state, "italic");

// ---------------------------------------------------------------------------
// Heading - 레퍼런스 소스의 _toggleHeading(cm, 'smaller') 동치 (toggleHeadingSmaller)
// 선택된 각 줄에: 헤딩이 없으면 "# " 추가, level 6이면 제거, 그 외엔 '#' 한 개 더 추가
// (레벨이 깊어지는 방향 - normal -> h1 -> h2 -> ... -> h6 -> normal).
// ---------------------------------------------------------------------------

export function toggleHeading(state: EditorState): CommandResult {
  const { from, to } = mainRange(state);
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (let ln = startLine; ln <= endLine; ln++) {
    const line = state.doc.line(ln);
    const text = line.text;
    const match = text.match(/[^#]/);
    const currHeadingLevel = match ? (match.index ?? -1) : -1;

    let newText: string;
    if (currHeadingLevel <= 0) {
      newText = "# " + text;
    } else if (currHeadingLevel === 6) {
      newText = text.slice(7);
    } else {
      newText = "#" + text;
    }
    changes.push({ from: line.from, to: line.to, insert: newText });
  }

  return { changes };
}

// ---------------------------------------------------------------------------
// Quote - 레퍼런스 소스의 _toggleLine(cm, 'quote') 동치 (toggleBlockquote)
// ---------------------------------------------------------------------------

const QUOTE_REGEX = /^(\s*)>(\s+)/;

export function toggleQuote(state: EditorState): CommandResult {
  const { from, to } = mainRange(state);
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  const active = QUOTE_REGEX.test(state.doc.line(startLine).text);
  const changes: { from: number; to: number; insert: string }[] = [];

  for (let ln = startLine; ln <= endLine; ln++) {
    const line = state.doc.line(ln);
    const text = active ? line.text.replace(QUOTE_REGEX, "$1") : "> " + line.text;
    changes.push({ from: line.from, to: line.to, insert: text });
  }

  return { changes };
}

// ---------------------------------------------------------------------------
// Checklist / Unordered list / Ordered list -
// 레퍼런스 소스의 _toggleLine(cm, name, liststyle) 동치
// (toggleCheckList/toggleUnorderedList/toggleOrderedList)
// ---------------------------------------------------------------------------

export type ListType = "checklist" | "unordered-list" | "ordered-list";

const LIST_OWN_REGEX: Record<ListType, RegExp> = {
  checklist: /^(\s*)- \[[ xX]\](\s+)/,
  "unordered-list": /^(\s*)[*\-+](\s+)/,
  "ordered-list": /^(\s*)\d+\.(\s+)/,
};

/**
 * 우선순위: checklist -> ordered-list -> unordered-list.
 * "- [ ] foo"는 unordered-list 정규식([*\-+])에도 걸리므로 checklist를 먼저 검사해야 한다.
 */
function detectListType(lineText: string): ListType | undefined {
  if (LIST_OWN_REGEX.checklist.test(lineText)) return "checklist";
  if (LIST_OWN_REGEX["ordered-list"].test(lineText)) return "ordered-list";
  if (LIST_OWN_REGEX["unordered-list"].test(lineText)) return "unordered-list";
  return undefined;
}

function prependListMarker(name: ListType, text: string, orderedIndex: number): string {
  if (name === "checklist") return "- [ ] " + text;
  if (name === "unordered-list") return "* " + text;
  return orderedIndex + ". " + text;
}

export function toggleList(state: EditorState, name: ListType): CommandResult {
  const { from, to } = mainRange(state);
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  const currentType = detectListType(state.doc.line(startLine).text);
  const active = currentType === name;
  const swapFrom = !active ? currentType : undefined;

  const changes: { from: number; to: number; insert: string }[] = [];
  let orderedIndex = 1;

  for (let ln = startLine; ln <= endLine; ln++) {
    const line = state.doc.line(ln);
    let text = line.text;
    if (active) {
      text = text.replace(LIST_OWN_REGEX[name], "$1");
    } else {
      if (swapFrom) {
        text = text.replace(LIST_OWN_REGEX[swapFrom], "$1");
      }
      text = prependListMarker(name, text, orderedIndex);
      orderedIndex += 1;
    }
    changes.push({ from: line.from, to: line.to, insert: text });
  }

  return { changes };
}

export const toggleCheckList = (state: EditorState): CommandResult => toggleList(state, "checklist");
export const toggleUnorderedList = (state: EditorState): CommandResult => toggleList(state, "unordered-list");
export const toggleOrderedList = (state: EditorState): CommandResult => toggleList(state, "ordered-list");

// ---------------------------------------------------------------------------
// Link / Image - 레퍼런스 소스의 _toggleLink()의 "비활성"(삽입) 분기 동치 (drawLink/drawImage).
// yona의 이전 설정(옛 _toolbar()/초기화 옵션)은 promptURLs를 켜지 않았으므로 레퍼런스 소스
// 기본값과 동일하게 prompt() 없이 항상 자리표시 URL "https://"를 쓴다.
// ---------------------------------------------------------------------------

export type LinkKind = "link" | "image";

const LINK_PREFIX: Record<LinkKind, string> = {
  link: "[",
  image: "![",
};

const PLACEHOLDER_URL = "https://";

export function insertLinkOrImage(state: EditorState, kind: LinkKind): CommandResult {
  const { from, to } = mainRange(state);
  const prefix = LINK_PREFIX[kind];
  const suffix = "](" + PLACEHOLDER_URL + ")";
  const text = state.sliceDoc(from, to);
  const anchor = from + prefix.length;

  return {
    changes: { from, to, insert: prefix + text + suffix },
    selection: { anchor, head: anchor + text.length },
  };
}

export const insertLink = (state: EditorState): CommandResult => insertLinkOrImage(state, "link");
export const insertImage = (state: EditorState): CommandResult => insertLinkOrImage(state, "image");
