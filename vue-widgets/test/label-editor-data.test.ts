import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceDataValue } from "../src/label-editor/data.js";

test("coerceDataValue: undefined은 그대로 undefined", () => {
  assert.equal(coerceDataValue(undefined), undefined);
});
test("coerceDataValue: 'true'/'false'는 불리언으로", () => {
  assert.equal(coerceDataValue("true"), true);
  assert.equal(coerceDataValue("false"), false);
});
test("coerceDataValue: 'null'은 null로", () => {
  assert.equal(coerceDataValue("null"), null);
});
test("coerceDataValue: 순수 숫자 문자열은 숫자로(jQuery 호환 - 원본 의도적 특성)", () => {
  assert.equal(coerceDataValue("123"), 123);
  assert.equal(coerceDataValue("12.5"), 12.5);
});
test("coerceDataValue: 카테고리/라벨 이름이 우연히 숫자면 숫자로 강제 변환됨(원본과 동일한 함정, 고치지 않음)", () => {
  assert.equal(coerceDataValue("42"), 42);
});
test("coerceDataValue: JSON 객체/배열 형태 문자열은 파싱", () => {
  assert.deepEqual(coerceDataValue('{"a":1}'), { a: 1 });
  assert.deepEqual(coerceDataValue("[1,2]"), [1, 2]);
});
test("coerceDataValue: JSON 파싱 실패하면 원본 문자열 유지", () => {
  assert.equal(coerceDataValue("{broken"), "{broken");
});
test("coerceDataValue: 일반 문자열은 그대로", () => {
  assert.equal(coerceDataValue("bug"), "bug");
  assert.equal(coerceDataValue(""), "");
});
