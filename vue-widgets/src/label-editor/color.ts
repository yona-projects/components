// RGBColor(전역, lib/rgbcolor.js)에 직접 의존하는 대신 파서를 주입받는 형태로
// 만들어 Node 테스트 환경에서도 검증 가능하게 했다. 실제 컴포넌트는 전역
// RGBColor 생성자를 그대로 넘긴다.

export interface RgbColorLike {
  ok: boolean;
  toHex(): string;
}
export type RgbColorParser = (color: string) => RgbColorLike;

export function getRefinedHexColor(color: string, parse: RgbColorParser): string | false {
  const rgb = parse(color || "");
  return rgb && rgb.ok ? rgb.toHex() : false;
}

// RGBColor는 HEX 검증에 너무 관대해서("#12345"도 통과) "#"으로 시작하면
// 길이(4 또는 7)부터 먼저 검사한다.
export function isValidColorExpr(colorExpr: string, parse: RgbColorParser): boolean {
  if (colorExpr.indexOf("#") === 0 && !(colorExpr.length === 4 || colorExpr.length === 7)) {
    return false;
  }
  const rgb = parse(colorExpr);
  return !!(rgb && rgb.ok);
}

export function getPrefixedCSSText(cssText: string): string {
  return ["", "-moz-", "-webkit-"].map((prefix) => prefix + cssText).join(";");
}

// 호출부가 항상 getRefinedHexColor를 거친 "#rrggbb" hex만 넘기므로 RGBColor
// 없이 직접 파싱해도 안전하다.
export function getContrastColor(hexColor: string): "white" | "dimgray" {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const y709 = r * 0.21 + g * 0.72 + b * 0.07;
  return y709 > 192 ? "dimgray" : "white";
}
