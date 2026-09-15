import { test } from "node:test";
import assert from "node:assert/strict";
import { computeContainerRelativeOffset, computeFloatPosition } from "../src/popover/popover.js";

test("computeContainerRelativeOffset: container가 body면 페이지 스크롤 오프셋을 더한다", () => {
  const result = computeContainerRelativeOffset({ top: 100, left: 50, width: 0, height: 0 }, "body", { x: 10, y: 20 });
  assert.deepEqual(result, { top: 120, left: 60 });
});

test("computeContainerRelativeOffset: container가 dialog rect면 그 rect 기준 상대좌표(스크롤 오프셋 무시)", () => {
  const result = computeContainerRelativeOffset(
    { top: 300, left: 200, width: 0, height: 0 },
    { top: 50, left: 30, width: 400, height: 300 },
    { x: 999, y: 999 },
  );
  assert.deepEqual(result, { top: 250, left: 170 });
});

test("computeFloatPosition: placement=bottom은 트리거 아래 중앙", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, "bottom");
  assert.deepEqual(result, { top: 120, left: 70 });
});

test("computeFloatPosition: placement=left은 트리거 왼쪽 세로 중앙", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, "left");
  assert.deepEqual(result, { top: 102, left: 10 });
});

test("computeFloatPosition: placement=right은 트리거 오른쪽 세로 중앙", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, "right");
  assert.deepEqual(result, { top: 102, left: 130 });
});

test("computeFloatPosition: placement=top은 트리거 위 중앙", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, "top");
  assert.deepEqual(result, { top: 84, left: 70 });
});

test("computeFloatPosition: 원본 switch문과 동일하게 인식 안 되는 placement는 top으로 취급", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, "bogus");
  assert.deepEqual(result, { top: 84, left: 70 });
});

test("computeFloatPosition: placement 생략(undefined)도 top으로 취급", () => {
  const result = computeFloatPosition({ top: 100, left: 50 }, { width: 80, height: 20 }, { width: 40, height: 16 }, undefined);
  assert.deepEqual(result, { top: 84, left: 70 });
});
