// defineCustomElement 빌드(dist-element/yona-markdown-editor-vue-element.js) 스모크 테스트.
// es 모듈 포맷이라 file://로 직접 열면 브라우저가 상대 임포트를 CORS로 막는다("Cross origin
// requests are only supported for protocol schemes: http, https, ...") - 로컬 정적 서버로
// http://로 열어야 한다.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/editor-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-markdown-editor-vue")?.shadowRoot);

const result = await page.evaluate(() => {
  const el = document.querySelector("yona-markdown-editor-vue");
  el.setValue("hello custom element");
  const got = el.getValue();
  const textarea = el.shadowRoot.querySelector("textarea");
  return {
    hasShadow: !!el.shadowRoot,
    got,
    textareaName: textarea?.name,
    textareaValue: textarea?.value,
  };
});

const checks = [
  ["shadowRoot attach", result.hasShadow === true],
  ["getValue()가 setValue() 값을 반환", result.got === "hello custom element"],
  ["textarea.name === 'body'", result.textareaName === "body"],
  ["textarea.value가 동기화됨", result.textareaValue === "hello custom element"],
];

let allPass = errors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
