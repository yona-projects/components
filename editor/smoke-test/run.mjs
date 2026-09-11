// 1단계(빌드 인프라) 스모크 테스트.
// 확인 항목: (a) 콘솔 에러 없음, (b) <yona-markdown-editor>의 shadowRoot가 실제로 attach됨.
// CM6 마운트/폼 통합/툴바 등은 이 단계 범위가 아니므로 검증하지 않는다.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.join(__dirname, "index.html");

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (err) => {
  consoleErrors.push(String(err));
});

await page.goto(pageUrl);

const hasShadowRoot = await page.evaluate(() => {
  const el = document.querySelector("yona-markdown-editor");
  return !!(el && el.shadowRoot);
});

await browser.close();

console.log("콘솔 에러:", consoleErrors.length === 0 ? "없음" : consoleErrors);
console.log("shadowRoot 존재:", hasShadowRoot);

if (consoleErrors.length > 0 || !hasShadowRoot) {
  console.error("스모크 테스트 실패");
  process.exit(1);
}
console.log("스모크 테스트 통과");
