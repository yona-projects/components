import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNumeric,
  looksLikeExplicitCurrent,
  getPageNumFromUrl,
  urlWithPageNum,
  resolvePaginationState,
  clampInputValue,
} from "../src/pagination/pagination.js";

const BASE = "http://localhost/issues";

test("isNumeric: 정수/소수/음수 문자열은 true", () => {
  assert.equal(isNumeric("5"), true);
  assert.equal(isNumeric("5.5"), true);
  assert.equal(isNumeric("-5"), true);
});

test("isNumeric: 원본과 동일하게 16진수 문자열도 true(의도적 버그 호환)", () => {
  assert.equal(isNumeric("0x1F"), true);
});

test("isNumeric: 배열/빈 문자열/숫자 아닌 문자열은 false", () => {
  assert.equal(isNumeric([1, 2]), false);
  assert.equal(isNumeric(""), false);
  assert.equal(isNumeric("abc"), false);
});

test("looksLikeExplicitCurrent: 원본 rxDigit(/^.[0-9]*$/)와 동일하게 첫 글자는 아무거나 허용", () => {
  assert.equal(looksLikeExplicitCurrent("5"), true);
  assert.equal(looksLikeExplicitCurrent("55"), true);
  // 원본 정규식 자체의 특성(주석은 "positive만"이라 하지만 실제로는 첫 글자가
  // 무엇이든 허용) - 재구현도 원본과 동일한 결과를 내야 한다.
  assert.equal(looksLikeExplicitCurrent("-5"), true);
});

test("looksLikeExplicitCurrent: 빈 문자열/뒤에 숫자 아닌 문자가 남으면 false", () => {
  assert.equal(looksLikeExplicitCurrent(""), false);
  assert.equal(looksLikeExplicitCurrent("5abc"), false);
  assert.equal(looksLikeExplicitCurrent(undefined), false);
});

test("getPageNumFromUrl: 쿼리에 파라미터가 있으면 그 값을 정수로 반환", () => {
  assert.equal(getPageNumFromUrl(`${BASE}?pageNum=3`, "pageNum", 1, BASE), 3);
});

test("getPageNumFromUrl: 쿼리에 없으면 firstPage를 반환", () => {
  assert.equal(getPageNumFromUrl(BASE, "pageNum", 1, BASE), 1);
});

test("getPageNumFromUrl: paramNameForPage로 다른 파라미터 이름도 읽는다", () => {
  assert.equal(getPageNumFromUrl(`${BASE}?page=7`, "page", 1, BASE), 7);
});

test("urlWithPageNum: 기존 파라미터가 있으면 값만 교체한다", () => {
  const result = urlWithPageNum(`${BASE}?pageNum=2&filter=open`, 5, "pageNum", BASE);
  const url = new URL(result);
  assert.equal(url.searchParams.get("pageNum"), "5");
  assert.equal(url.searchParams.get("filter"), "open");
});

test("urlWithPageNum: 파라미터가 없으면 새로 추가한다", () => {
  const result = urlWithPageNum(`${BASE}?filter=open`, 3, "pageNum", BASE);
  const url = new URL(result);
  assert.equal(url.searchParams.get("pageNum"), "3");
  assert.equal(url.searchParams.get("filter"), "open");
});

test("resolvePaginationState: 기본값을 채운다(firstPage/paramNameForPage/hasPrev/hasNext)", () => {
  const state = resolvePaginationState(10, { current: 3, url: BASE }, BASE);
  assert.equal(state.firstPage, 1);
  assert.equal(state.paramNameForPage, "pageNum");
  assert.equal(state.current, 3);
  assert.equal(state.hasPrev, true);
  assert.equal(state.hasNext, true);
});

test("resolvePaginationState: current가 firstPage와 같으면 hasPrev는 false", () => {
  const state = resolvePaginationState(10, { current: 1, url: BASE }, BASE);
  assert.equal(state.hasPrev, false);
  assert.equal(state.hasNext, true);
});

test("resolvePaginationState: current가 totalPages와 같으면 hasNext는 false", () => {
  const state = resolvePaginationState(10, { current: 10, url: BASE }, BASE);
  assert.equal(state.hasPrev, true);
  assert.equal(state.hasNext, false);
});

test("resolvePaginationState: hasPrev/hasNext를 명시하면 계산값 대신 그 값을 쓴다", () => {
  const state = resolvePaginationState(10, { current: 5, url: BASE, hasPrev: false, hasNext: false }, BASE);
  assert.equal(state.hasPrev, false);
  assert.equal(state.hasNext, false);
});

test("resolvePaginationState: current 생략 시 url의 쿼리에서 읽는다", () => {
  const state = resolvePaginationState(10, { url: `${BASE}?pageNum=4` }, BASE);
  assert.equal(state.current, 4);
});

test("resolvePaginationState: current가 숫자가 아니면 원본과 동일하게 에러를 던진다", () => {
  // "x5"는 rxDigit(첫 글자 아무거나 + 뒤는 숫자)은 통과해 URL에서 다시 읽지 않고
  // 그대로 쓰이지만, isNumeric은 실패하는 값이라 원본의 validateOptions가 실제로
  // 에러를 던지는 경로다("not-a-number"처럼 rxDigit 자체가 실패하는 값은 URL에서
  // 다시 읽어오므로 여기까지 오지 않는다 - 원본 로직 그대로).
  assert.throws(() => resolvePaginationState(10, { current: "x5", url: BASE }, BASE), /options.current is not valid/);
});

test("clampInputValue: 범위 안 값은 그대로 유효하다", () => {
  assert.deepEqual(clampInputValue("5", 1, 10, 3), { valid: true, value: "5" });
});

test("clampInputValue: 최솟값보다 작으면 최솟값으로 보정한다", () => {
  assert.deepEqual(clampInputValue("0", 1, 10, 3), { valid: true, value: "1" });
});

test("clampInputValue: 최댓값보다 크면 최댓값으로 보정한다", () => {
  assert.deepEqual(clampInputValue("99", 1, 10, 3), { valid: true, value: "10" });
});

test("clampInputValue: 숫자가 아니면 무효 처리하고 현재 페이지 번호로 되돌린다", () => {
  assert.deepEqual(clampInputValue("abc", 1, 10, 3), { valid: false, value: "3" });
});
