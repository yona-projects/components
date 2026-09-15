// defineCustomElement 빌드(dist-element/yona-page-slide-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/page-slide-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

const checks = [];
function check(label, pass) {
  checks.push([label, pass]);
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-page-slide")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-page-slide").shadowRoot));
check("초기 상태는 isVisible() false", await page.evaluate(() => document.querySelector("yona-page-slide").isVisible() === false));

// 1. show() 호출 -> 즉시 패널이 보이고, iframe은 즉시가 아니라 300ms 뒤에 채워진다.
await page.evaluate(() => document.querySelector("yona-page-slide").show("/mock-page", "left"));
let result = await page.evaluate(() => {
  const root = document.querySelector("yona-page-slide").shadowRoot;
  const div = root.querySelector("div");
  return {
    visible: document.querySelector("yona-page-slide").isVisible(),
    hasIframeImmediately: !!div.querySelector("iframe"),
    right: div.style.right,
    left: div.style.left,
  };
});
check("show() 호출 즉시 isVisible() true", result.visible === true);
check("show() 호출 직후에는 iframe이 아직 없음(300ms 지연 재현)", result.hasIframeImmediately === false);
check("direction='left'면 right:0px로 배치", result.right === "0px");

await page.waitForTimeout(400);
result = await page.evaluate(() => {
  const root = document.querySelector("yona-page-slide").shadowRoot;
  return root.querySelector("iframe")?.src;
});
check("300ms 뒤 실제 iframe이 채워지고 src가 반영됨", result?.endsWith("/mock-page"));

// 2. hide() 호출 -> 패널이 사라짐
await page.evaluate(() => document.querySelector("yona-page-slide").hide());
result = await page.evaluate(() => {
  const root = document.querySelector("yona-page-slide").shadowRoot;
  return { visible: document.querySelector("yona-page-slide").isVisible(), hasDiv: !!root.querySelector("div") };
});
check("hide() 호출로 isVisible() false", result.visible === false);
check("hide() 호출로 실제 패널 DOM이 사라짐(v-if)", result.hasDiv === false);

// 3. hide()를 300ms 지연 안에 호출하면 iframe이 아예 안 채워짐(타이머 취소 확인)
await page.evaluate(() => document.querySelector("yona-page-slide").show("/should-not-load", "left"));
await page.waitForTimeout(100);
await page.evaluate(() => document.querySelector("yona-page-slide").hide());
await page.waitForTimeout(400);
result = await page.evaluate(() => document.querySelector("yona-page-slide").isVisible());
check("지연 중 hide()하면 계속 닫힌 상태 유지(타이머로 되살아나지 않음)", result === false);

// 4. direction='right'면 반대쪽에 배치
await page.evaluate(() => document.querySelector("yona-page-slide").show("/mock-page-2", "right"));
result = await page.evaluate(() => {
  const div = document.querySelector("yona-page-slide").shadowRoot.querySelector("div");
  return { left: div.style.left, right: div.style.right };
});
check("direction='right'면 left:0px로 배치", result.left === "0px");

// 5. 이미 열려있는 상태에서 다시 show()하면 이전 iframe이 즉시 제거되고 새로 채워짐
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector("yona-page-slide").show("/mock-page-3", "right"));
result = await page.evaluate(() => {
  const root = document.querySelector("yona-page-slide").shadowRoot;
  return !!root.querySelector("iframe");
});
check("재호출 직후 이전 iframe이 즉시 제거됨", result === false);
await page.waitForTimeout(400);
result = await page.evaluate(() => document.querySelector("yona-page-slide").shadowRoot.querySelector("iframe")?.src);
check("재호출 300ms 뒤 새 iframe이 새 src로 채워짐", result?.endsWith("/mock-page-3"));

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);
await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
