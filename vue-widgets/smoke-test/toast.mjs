// 토스트 위젯 스모크 테스트 - Vite 개발 서버로 App.vue를 띄운 뒤 Playwright로 확인한다:
// (a) push()가 실제 DOM에 토스트를 추가하는지, (b) title이 있으면 굵게 렌더링되는지,
// (c) duration이 지나면 자동으로 사라지는지, (d) 클릭하면(duration 없어도) 사라지는지,
// (e) clear()가 전부 지우는지, (f) 콘솔 에러가 없는지.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("Vite dev server 포트를 얻지 못했다");
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => !!window.__yonaToast?.value);

function toastCount() {
  return page.evaluate(() => document.querySelectorAll(".toast").length);
}

const checks = [];

// (a)(b) title 있는 영구 토스트
await page.evaluate(() => window.__yonaToast.value.push("본문 내용", 0, "제목"));
await page.waitForTimeout(50);
const html = await page.evaluate(() => document.querySelector(".toast .msg")?.innerHTML);
checks.push(["push() 직후 토스트 1개 표시", (await toastCount()) === 1]);
checks.push(["title이 <strong>로 렌더링됨", html === "<strong>제목</strong><br>본문 내용"]);

// (d) 클릭하면 사라짐(leave 트랜지션 0.3초 감안해서 대기)
await page.locator(".toast").first().click();
await page.waitForTimeout(500);
checks.push(["클릭하면 사라짐", (await toastCount()) === 0]);

// (c) duration 있는 토스트는 자동으로 사라짐
await page.evaluate(() => window.__yonaToast.value.push("자동 소멸", 500));
await page.waitForTimeout(50);
checks.push(["duration 토스트 표시됨", (await toastCount()) === 1]);
await page.waitForTimeout(1200);
checks.push(["duration 경과 후 자동으로 사라짐", (await toastCount()) === 0]);

// (e) clear()
await page.evaluate(() => {
  window.__yonaToast.value.push("a", 0);
  window.__yonaToast.value.push("b", 0);
});
await page.waitForTimeout(50);
checks.push(["clear 전 토스트 2개", (await toastCount()) === 2]);
await page.evaluate(() => window.__yonaToast.value.clear());
await page.waitForTimeout(500);
checks.push(["clear() 후 전부 사라짐", (await toastCount()) === 0]);

let allPass = errors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

await browser.close();
await server.close();

if (!allPass) {
  console.error("토스트 스모크 테스트 실패");
  process.exit(1);
}
console.log("토스트 스모크 테스트 통과");
