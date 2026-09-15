// defineCustomElement 빌드(vite.element.config.ts -> dist-element/
// yona-markdown-editor-vue-element.js) 스모크 테스트.
//
// yona 쪽에 실제로 벤더링하는 형태(Vue 앱 부트스트랩 없이 태그 하나로 정적 HTML에 꽂기)와
// 동일한 방식으로 element.html에 로드해, (a) 콘솔 에러 없이 정의되는지, (b) shadowRoot가
// attach되는지, (c) defineExpose된 getValue/setValue가 실제 커스텀 엘리먼트 인스턴스에서
// 호출 가능한지, (d) 그 값이 shadow 안의 light-DOM 호환 textarea(name/value)와 동기화되는지
// 확인한다.
//
// es 모듈 포맷으로 바꾼 뒤(vite.element.config.ts 참고)로는 file:// 프로토콜로 직접 열 수
// 없다 - 브라우저가 file:// 오리진에서의 module script 상대 임포트(공유 청크 등)를 CORS로
// 막는다("Cross origin requests are only supported for protocol schemes: http, https, ...",
// 실측으로 확인). yona 실서비스는 항상 http(s)로 서빙되니 문제 없지만, 이 스모크 테스트는
// 로컬 정적 서버를 하나 띄워 http://로 열어야 한다.
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
