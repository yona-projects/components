// 3단계(툴바) 스모크 테스트 - Vue 3 SFC판.
//
// 확인 항목은 원본(editor/smoke-test/toolbar.mjs)과 동일하다: 9개 툴바 커맨드가 실제
// 클릭+키보드 선택으로 기대한 마크다운 텍스트를 만들어내는지, preview placeholder가 문서를
// 건드리지 않는지, 콘솔 에러가 없는지.
//
// 원본은 정적 HTML + 빌드된 min.js 하나만으로 검증했지만(파일 프로토콜), Vue SFC는 그 자체로
// 실행 가능한 파일이 아니라 번들러(Vite)를 거쳐야 하므로 Vite 개발 서버를 이 스크립트 안에서
// 직접 띄운다(Vite Node API, `npx vite` 서브프로세스를 spawn해 stdout에서 포트를 파싱하는
// 방식보다 안정적). 또한 커스텀 엘리먼트가 아니라 Vue 컴포넌트 인스턴스이므로
// `document.querySelector(...).value`로 직접 값을 주고받을 수 없다 - App.vue가 테스트
// 편의상 `window.__yonaEditor`(컴포넌트 ref)에 노출해둔 getValue()/setValue()를 대신 쓴다.
import { chromium } from "playwright";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const server = await createServer({ root, server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("Vite dev server 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/`;

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(pageUrl);
await page.waitForSelector("#target .cm-content");

async function runCase(initialText, command) {
  await page.evaluate((initialText) => {
    window.__yonaEditor.value.setValue(initialText);
  }, initialText);

  const cmContent = page.locator("#target .cm-content");
  await cmContent.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.locator(`#target [data-command="${command}"]`).click();

  return page.evaluate(() => window.__yonaEditor.value.getValue());
}

const cases = [
  ["bold", "hello", "bold", "**hello**"],
  ["italic", "hello", "italic", "*hello*"],
  ["heading", "Title", "heading", "# Title"],
  ["quote", "hello", "quote", "> hello"],
  ["checklist", "buy milk", "checklist", "- [ ] buy milk"],
  ["unordered-list", "item", "unordered-list", "* item"],
  ["ordered-list", "item", "ordered-list", "1. item"],
  ["link", "click here", "link", "[click here](https://)"],
  ["image", "alt text", "image", "![alt text](https://)"],
];

let allPass = true;
for (const [name, initial, command, expected] of cases) {
  const result = await runCase(initial, command);
  const pass = result === expected;
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${name}: got=${JSON.stringify(result)} expected=${JSON.stringify(expected)}`);
}

const previewResult = await runCase("unchanged", "preview");
const previewPass = previewResult === "unchanged";
allPass = allPass && previewPass;
console.log(`${previewPass ? "OK  " : "FAIL"} preview placeholder(문서 변경 없어야 함): got=${JSON.stringify(previewResult)}`);

console.log("콘솔 에러:", consoleErrors.length === 0 ? "없음" : consoleErrors);
await browser.close();
await server.close();

if (!allPass || consoleErrors.length > 0) {
  console.error("3단계 툴바 스모크 테스트(Vue SFC판) 실패");
  process.exit(1);
}
console.log("3단계 툴바 스모크 테스트(Vue SFC판) 통과");
