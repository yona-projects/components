import { test } from "node:test";
import assert from "node:assert/strict";
import { getRefinedHexColor, isValidColorExpr, getPrefixedCSSText, getContrastColor } from "../src/label-editor/color.js";

// 실제 rgbcolor.js(lib/, 전역 RGBColor) 없이도 순수 함수를 테스트할 수 있도록
// 원본이 실제로 의존하는 두 가지 동작(ok/toHex(), 알려지지 않은 값은 ok=false)만
// 흉내내는 최소 fake parser를 주입한다.
function fakeParse(color: string) {
  const known: Record<string, string> = {
    "#fff": "#ffffff",
    "#ffffff": "#ffffff",
    "red": "#ff0000",
    "rgb(0,0,0)": "#000000",
  };
  const hex = known[color];
  return { ok: hex !== undefined, toHex: () => hex ?? "" };
}

test("getRefinedHexColor: 유효한 색이면 toHex() 결과를 반환", () => {
  assert.equal(getRefinedHexColor("red", fakeParse), "#ff0000");
});

test("getRefinedHexColor: 무효한 색이면 false를 반환", () => {
  assert.equal(getRefinedHexColor("not-a-color", fakeParse), false);
});

test("getRefinedHexColor: 빈 문자열도 parser에 그대로 전달(원본과 동일)", () => {
  assert.equal(getRefinedHexColor("", fakeParse), false);
});

test("isValidColorExpr: #으로 시작하고 길이 4(#rgb)면 parser 결과를 따른다", () => {
  assert.equal(isValidColorExpr("#fff", fakeParse), true);
});

test("isValidColorExpr: #으로 시작하지만 길이가 4/7이 아니면 parser를 묻지도 않고 false", () => {
  // "#abcde"는 길이 6 - RGBColor가 유효하다고 판단할 수도 있는 값이지만 원본은
  // 길이 검사에서 먼저 걸러낸다.
  assert.equal(isValidColorExpr("#abcde", fakeParse), false);
});

test("isValidColorExpr: #으로 시작 안 하면 길이 제한 없이 parser 결과를 따른다", () => {
  assert.equal(isValidColorExpr("red", fakeParse), true);
  assert.equal(isValidColorExpr("not-a-color", fakeParse), false);
});

test("getPrefixedCSSText: 원본/-moz-/-webkit- 세 벌을 세미콜론으로 이어붙인다", () => {
  assert.equal(
    getPrefixedCSSText("box-shadow: inset 25px 0 0 #fff"),
    "box-shadow: inset 25px 0 0 #fff;-moz-box-shadow: inset 25px 0 0 #fff;-webkit-box-shadow: inset 25px 0 0 #fff",
  );
});

test("getContrastColor: 밝은 배경(흰색)은 어두운 텍스트(dimgray)", () => {
  assert.equal(getContrastColor("#ffffff"), "dimgray");
});

test("getContrastColor: 어두운 배경(검정)은 밝은 텍스트(white)", () => {
  assert.equal(getContrastColor("#000000"), "white");
});

test("getContrastColor: y709 공식 그대로(순수 녹색은 183.6으로 192 미만 - white)", () => {
  assert.equal(getContrastColor("#00ff00"), "white");
});
