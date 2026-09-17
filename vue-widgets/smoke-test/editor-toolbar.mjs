// 툴바 스모크 테스트(Vue 3 SFC판) - 원본(editor/smoke-test/toolbar.mjs)과 동일한 커맨드를 검증한다.
//
// Vue SFC는 번들러(Vite)를 거쳐야 하므로 Vite 개발 서버를 직접 띄운다(Vite Node API가 `npx vite`
// 서브프로세스 spawn 방식보다 안정적). 커스텀 엘리먼트가 아니라 Vue 컴포넌트 인스턴스라
// `document.querySelector(...).value`로 값을 주고받을 수 없어, App.vue가 테스트용으로 노출한
// `window.__yonaEditor`(컴포넌트 ref)의 getValue()/setValue()를 대신 쓴다.
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
