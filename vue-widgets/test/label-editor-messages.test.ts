import { test } from "node:test";
import assert from "node:assert/strict";
import { msg } from "../src/label-editor/messages.js";

test("msg: 전역 Messages가 있으면 그대로 위임(인자 포함)", () => {
  (globalThis as any).Messages = (key: string, ...args: string[]) => `${key}:${args.join(",")}`;
  assert.equal(msg("label.error.color", "#zzz"), "label.error.color:#zzz");
  delete (globalThis as any).Messages;
});

test("msg: 전역 Messages가 없으면 내장 영문 폴백을 사용", () => {
  assert.equal(msg("label.new"), "Add new label");
  assert.equal(msg("button.save"), "Save");
});

test("msg: 폴백 문자열의 {0}/{1}/{2} 플레이스홀더를 인자로 치환", () => {
  assert.equal(msg("label.failedTo", "add label"), "Failed to add label.");
  assert.equal(msg("error.failedTo", "add label", "500", "Server Error"), "Failed to add label<br>(500 Server Error)");
  assert.equal(
    msg("label.error.duplicated.in.category", "default"),
    "A label with the same name already exists in the category default.",
  );
});

test("msg: 폴백 사전에도 없는 키는 키 자체를 반환", () => {
  assert.equal(msg("no.such.key"), "no.such.key");
});
