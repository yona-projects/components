// <yona-markdown-editor-vue>가 조상 <form>의 FormData에 실제로 실리는지 확인하는 스모크
// 테스트. defineCustomElement가 컴포넌트 전체(내부 textarea 포함)를 Shadow DOM 안에
// 마운트하는 탓에, ElementInternals 연동 없이는 이 값이 FormData에 전혀 안 잡히는 회귀가
// 있었다(실제 <form>에 넣어보고서야 발견 - element.ts 주석 참고). 이 테스트는 그 회귀를
// 다시 잡기 위한 것: 초기값/setValue()/실제 타이핑 세 경로 전부 FormData에 반영돼야 한다.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("Vite dev server 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/editor-form-participation.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-markdown-editor-vue")?.shadowRoot);

function formData() {
  return page.evaluate(() => Object.fromEntries(new FormData(document.getElementById("f")).entries()));
}

const initial = await formData();

await page.evaluate(() => document.querySelector("yona-markdown-editor-vue").setValue("hello from vue editor"));
await page.waitForTimeout(50);
const afterSetValue = await formData();

await page.locator("yona-markdown-editor-vue .cm-content").click();
await page.keyboard.type(" typed too");
await page.waitForTimeout(50);
const afterTyping = await formData();

const checks = [
  ["초기값도 FormData에 실림(빈 문자열)", initial.body === ""],
  ["setValue() 결과가 FormData에 실림", afterSetValue.body === "hello from vue editor"],
  ["실제 타이핑 결과가 FormData에 실림", afterTyping.body === "hello from vue editor typed too"],
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
  console.error("폼 참여 스모크 테스트 실패");
  process.exit(1);
}
console.log("폼 참여 스모크 테스트 통과");
