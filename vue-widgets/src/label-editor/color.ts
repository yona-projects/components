// yona.issue.LabelEditor.js의 색상 관련 순수 로직만 뽑아낸 것 - RGBColor(lib/rgbcolor.js,
// 전역)에 대한 직접 의존 대신 파서를 주입받는 형태로 만들어 Node 테스트 환경에서도
// (rgbcolor.js 없이) 검증 가능하게 했다. 실제 컴포넌트는 전역 RGBColor 생성자를
// 그대로 넘긴다.

export interface RgbColorLike {
  ok: boolean;
  toHex(): string;
}
export type RgbColorParser = (color: string) => RgbColorLike;

// 원본 _getRefinedHexColor
export function getRefinedHexColor(color: string, parse: RgbColorParser): string | false {
  const rgb = parse(color || "");
  return rgb && rgb.ok ? rgb.toHex() : false;
}

// 원본 _isValidColorExpr - RGBColor가 HEX 표현 검증에는 너무 관대해서(예: "#12345"도
// 통과시킬 수 있음) "#"으로 시작하면 길이(4 또는 7)부터 먼저 검사한다.
export function isValidColorExpr(colorExpr: string, parse: RgbColorParser): boolean {
  if (colorExpr.indexOf("#") === 0 && !(colorExpr.length === 4 || colorExpr.length === 7)) {
    return false;
  }
  const rgb = parse(colorExpr);
  return !!(rgb && rgb.ok);
}

// 원본 _getPrefixedCSSText
export function getPrefixedCSSText(cssText: string): string {
  return ["", "-moz-", "-webkit-"].map((prefix) => prefix + cssText).join(";");
}

// 원본 $yona.getContrastColor(yona.Common.js) - 항상 이미 정제된 "#rrggbb" hex만
// 넘어오므로(호출부가 getRefinedHexColor를 거친 값만 전달) RGBColor 없이 직접
// hex를 파싱해도 원본과 동일한 결과를 낸다.
export function getContrastColor(hexColor: string): "white" | "dimgray" {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const y709 = r * 0.21 + g * 0.72 + b * 0.07;
  return y709 > 192 ? "dimgray" : "white";
}
