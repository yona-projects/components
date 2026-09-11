// yona-markdown-editor 3단계(툴바) 커맨드 로직 단위 테스트.
//
// src/commands.ts의 순수 함수를 대상으로 한다 - View/DOM 없이 EditorState만으로 검증 가능하다.
// (Shadow DOM 내부 클릭 → 버튼 UI 자체는 Playwright가 1차 검증 수단이지만, 토글 규칙 자체의
// 회귀는 이 레벨에서 훨씬 빠르고 정확하게 잡을 수 있다.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import {
  type CommandResult,
  toggleBold,
  toggleItalic,
  toggleHeading,
  toggleQuote,
  toggleCheckList,
  toggleUnorderedList,
  toggleOrderedList,
  insertLink,
  insertImage,
} from "../src/commands.js";

function stateWithSelection(doc: string, from: number, to: number = from): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [markdown()],
  });
}

function applyAndGetDoc(state: EditorState, spec: CommandResult): string {
  assert.ok(spec, "command should not be a no-op");
  return state.update(spec).state.doc.toString();
}

test("toggleBold wraps a plain selection in **", () => {
  const state = stateWithSelection("hello world", 0, 5); // "hello"
  assert.equal(applyAndGetDoc(state, toggleBold(state)), "**hello** world");
});

test("toggleBold with no selection inserts an empty **** pair with cursor in the middle", () => {
  const state = stateWithSelection("hello world", 0, 0);
  const result = toggleBold(state);
  const doc = applyAndGetDoc(state, result);
  assert.equal(doc, "****hello world");
  const next = state.update(result!).state;
  assert.equal(next.selection.main.from, 2);
  assert.equal(next.selection.main.to, 2);
});

test("toggleBold unwraps an already-bold selection", () => {
  const state = stateWithSelection("**hello** world", 2, 7); // selects "hello" inside **hello**
  assert.equal(applyAndGetDoc(state, toggleBold(state)), "hello world");
});

test("toggleItalic wraps a plain selection in *", () => {
  const state = stateWithSelection("hello world", 6, 11); // "world"
  assert.equal(applyAndGetDoc(state, toggleItalic(state)), "hello *world*");
});

test("toggleItalic unwraps an already-italic selection", () => {
  const state = stateWithSelection("*hello* world", 1, 6); // selects "hello" inside *hello*
  assert.equal(applyAndGetDoc(state, toggleItalic(state)), "hello world");
});

test("toggleHeading adds '# ' to a plain line, then escalates on repeated toggles", () => {
  let state = stateWithSelection("Title", 0, 0);
  let doc = applyAndGetDoc(state, toggleHeading(state));
  assert.equal(doc, "# Title");

  state = stateWithSelection(doc, 0, 0);
  doc = applyAndGetDoc(state, toggleHeading(state));
  assert.equal(doc, "## Title");
});

test("toggleHeading removes the marker once level 6 is reached", () => {
  const state = stateWithSelection("###### Title", 0, 0);
  assert.equal(applyAndGetDoc(state, toggleHeading(state)), "Title");
});

test("toggleQuote prefixes selected lines with '> ' and removes it on re-toggle", () => {
  let state = stateWithSelection("line one\nline two", 0, 17);
  let doc = applyAndGetDoc(state, toggleQuote(state));
  assert.equal(doc, "> line one\n> line two");

  state = stateWithSelection(doc, 0, doc.length);
  doc = applyAndGetDoc(state, toggleQuote(state));
  assert.equal(doc, "line one\nline two");
});

test("toggleCheckList prefixes with '- [ ] '", () => {
  const state = stateWithSelection("buy milk", 0, 0);
  assert.equal(applyAndGetDoc(state, toggleCheckList(state)), "- [ ] buy milk");
});

test("toggleUnorderedList prefixes with '* '", () => {
  const state = stateWithSelection("item", 0, 0);
  assert.equal(applyAndGetDoc(state, toggleUnorderedList(state)), "* item");
});

test("toggleOrderedList prefixes a multi-line selection with sequential numbers", () => {
  const state = stateWithSelection("a\nb\nc", 0, 5);
  assert.equal(applyAndGetDoc(state, toggleOrderedList(state)), "1. a\n2. b\n3. c");
});

test("toggleUnorderedList swaps an existing ordered-list line to unordered", () => {
  const state = stateWithSelection("1. a", 0, 0);
  assert.equal(applyAndGetDoc(state, toggleUnorderedList(state)), "* a");
});

test("toggleCheckList is not confused with unordered-list ('- [ ]' vs '- ')", () => {
  const state = stateWithSelection("- [ ] a", 0, 0);
  // already a checklist item -> toggling checklist again removes it
  assert.equal(applyAndGetDoc(state, toggleCheckList(state)), "a");
});

test("insertLink wraps selection in [text](https://)", () => {
  const state = stateWithSelection("click here", 0, 10);
  const result = insertLink(state);
  assert.equal(applyAndGetDoc(state, result), "[click here](https://)");
  const next = state.update(result!).state;
  assert.equal(next.sliceDoc(next.selection.main.from, next.selection.main.to), "click here");
});

test("insertLink with no selection leaves cursor right after '['", () => {
  const state = stateWithSelection("", 0, 0);
  const result = insertLink(state);
  assert.equal(applyAndGetDoc(state, result), "[](https://)");
  const next = state.update(result!).state;
  assert.equal(next.selection.main.from, 1);
  assert.equal(next.selection.main.to, 1);
});

test("insertImage wraps selection in ![text](https://)", () => {
  const state = stateWithSelection("alt text", 0, 8);
  assert.equal(applyAndGetDoc(state, insertImage(state)), "![alt text](https://)");
});
