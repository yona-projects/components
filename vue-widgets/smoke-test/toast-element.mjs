// defineCustomElement 빌드(dist-element/yona-toast-element.js) 스모크 테스트 -
// editor-element.mjs/help-element.mjs와 동일한 이유/방식(es 모듈이라 file://로 직접 열면
// module script의 상대 임포트가 CORS로 막혀서 로컬 정적 서버를 거친다).
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/toast-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-toast")?.shadowRoot);

await page.evaluate(() => {
  document.querySelector("yona-toast").push("hello", 0, "제목");
});
await page.waitForTimeout(100);

const result = await page.evaluate(() => {
  const el = document.querySelector("yona-toast");
  const msg = el.shadowRoot.querySelector(".toast .msg");
  return { hasShadow: !!el.shadowRoot, html: msg?.innerHTML };
});

const checks = [
  ["shadowRoot attach", result.hasShadow === true],
  ["push()로 토스트가 렌더링됨", result.html === "<strong>제목</strong><br>hello"],
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
