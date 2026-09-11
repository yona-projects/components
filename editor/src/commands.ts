// yona-markdown-editor 3단계(툴바) - 순수 커맨드 로직.
//
// EasyMDE(구 yobi.ui.MarkdownEditor.js `_toolbar()`)가 위임했던 EasyMDE 내장 커맨드
// (toggleBold/toggleItalic/toggleHeadingSmaller/toggleBlockquote/toggleCheckList/
// toggleUnorderedList/toggleOrderedList/drawLink/drawImage)를 CM6 EditorState 기반으로
// 재구현한다. EasyMDE 소스(https://github.com/Ionaru/easy-markdown-editor,
// src/js/easymde.js의 _toggleBlock/_toggleHeading/_toggleLine/_toggleLink/_replaceSelection,
// 2026-09-11 조사 시점 master 기준)를 직접 읽고 그 토글 규칙을 최대한 동치로 재현했다.
//
// CM6-네이티브로 대체한 지점(동일 목적, 다른 메커니즘 - "새 기능"이 아니라 CM5 -> CM6 포팅):
// - "지금 굵게/기울임 상태인가"라는 판정은 원래 CM5 모드 토크나이저(getState())가 담당했다.
//   CM6에는 그 토크나이저가 없으므로 대신 lezer 구문 트리(StrongEmphasis/Emphasis 노드)를
//   써서 커서가 이미 그 서식 안에 있는지 판정한다 - 판정 대상(구문상 그 서식 안에 있는가)은
//   동일하고 구현 메커니즘만 CM6 표준 방식으로 바뀐 것이다.
// - 목록/체크리스트/인용의 "이미 적용돼 있는가"도 EasyMDE 자체가 코너 케이스(예: 전체 선택 시
//   커서 토큰이 비어버리는 경우)에서 쓰던 순수 텍스트 정규식 폴백 경로를 항상 쓰는 것으로
//   단순화했다(easymde.js _toggleLine()의 "After selectAll ... Fall back to detecting the
//   type from the first selected line's text" 주석 참고) - 토크나이저 경로와 결과가 사실상
//   동일하고 CM5 토크나이저 의존을 없앤다.
//
// link/image는 이번 단계 지시(3단계 A.1) 범위가 "커서 위치에 템플릿을 삽입하고 커서를 이동"으로
// 명시되어 있어, EasyMDE _toggleLink의 "비활성"(삽입) 분기만 재현했다 - 이미 링크/이미지 안에
// 있을 때 "해제"하는 분기는 구현하지 않았다(범위 밖).
//
// View/DOM에 의존하지 않는 순수 함수로 분리해 Node 환경에서 바로 단위 테스트한다
// (test/commands.test.ts) - Shadow DOM 내부 클릭 동작 자체는 Playwright가 1차 검증 수단이지만,
// 토글 규칙 자체의 로직 회귀는 이 순수 함수 레벨에서 더 빠르고 정확하게 잡을 수 있다.
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";

/** 커맨드 하나가 만들어내는 트랜잭션 스펙. null이면 아무 것도 하지 않는다(no-op). */
export type CommandResult = TransactionSpec | null;

function mainRange(state: EditorState): { from: number; to: number } {
  const sel = state.selection.main;
  return { from: sel.from, to: sel.to };
}

// ---------------------------------------------------------------------------
// Bold / Italic - EasyMDE _toggleBlock() 동치 (toggleBold/toggleItalic)
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
// Heading - EasyMDE _toggleHeading(cm, 'smaller') 동치 (toggleHeadingSmaller)
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
// Quote - EasyMDE _toggleLine(cm, 'quote') 동치 (toggleBlockquote)
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
// EasyMDE _toggleLine(cm, name, liststyle) 동치
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
// Link / Image - EasyMDE _toggleLink()의 "비활성"(삽입) 분기 동치 (drawLink/drawImage).
// yona의 EasyMDE 설정(옛 _toolbar()/초기화 옵션)은 promptURLs를 켜지 않았으므로 EasyMDE
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
