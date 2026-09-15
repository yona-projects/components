import { test } from "node:test";
import assert from "node:assert/strict";
import { nextActiveKey } from "../src/help-markdown/toggle.js";

test("아무 것도 안 열린 상태에서 탭을 클릭하면 그 탭이 열린다", () => {
  assert.equal(nextActiveKey(null, "markdownHeaders"), "markdownHeaders");
});

test("열려 있는 탭을 다시 클릭하면 닫힌다(null)", () => {
  assert.equal(nextActiveKey("markdownHeaders", "markdownHeaders"), null);
});

test("다른 탭을 클릭하면 그 탭으로 바뀐다(이전 것은 자동으로 닫힘)", () => {
  assert.equal(nextActiveKey("markdownHeaders", "markdownLinks"), "markdownLinks");
});
