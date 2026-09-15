import { test } from "node:test";
import assert from "node:assert/strict";
import { toRequestParams } from "../src/label-editor/request.js";

test("toRequestParams: null/undefined 값도 키는 유지하고 빈 문자열로 직렬화", () => {
  const params = toRequestParams({ a: null, b: undefined, c: "x" });
  assert.equal(params.get("a"), "");
  assert.equal(params.get("b"), "");
  assert.equal(params.get("c"), "x");
  assert.deepEqual(Array.from(params.keys()), ["a", "b", "c"]);
});

test("toRequestParams: 숫자/불리언 값은 문자열로 직렬화", () => {
  const params = toRequestParams({ id: 5, isExclusive: true });
  assert.equal(params.get("id"), "5");
  assert.equal(params.get("isExclusive"), "true");
});
