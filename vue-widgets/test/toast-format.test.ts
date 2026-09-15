import { test } from "node:test";
import assert from "node:assert/strict";
import { nl2br, toastHtml } from "../src/toast/format.js";

test("nl2br: 개행을 <br>로 치환한다", () => {
  assert.equal(nl2br("line1\nline2"), "line1<br>line2");
});

test("nl2br: 개행이 없으면 그대로 반환한다", () => {
  assert.equal(nl2br("hello"), "hello");
});

test("toastHtml: title이 없으면 메시지만 nl2br 처리해 반환한다", () => {
  assert.equal(toastHtml("saved\nsuccessfully"), "saved<br>successfully");
});

test("toastHtml: title이 있으면 굵게 감싸고 메시지 앞에 줄바꿈으로 붙인다", () => {
  assert.equal(toastHtml("body text", "Title"), "<strong>Title</strong><br/>body text");
});
