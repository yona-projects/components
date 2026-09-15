// 도움말 패널 아코디언 동작 스모크 테스트 - Vite 개발 서버로 App.vue를 띄운 뒤 Playwright로
// 확인한다: (a) 초기 상태는 전부 닫혀있음(원본과 동일 - 초기 마크업에 .active 없음),
// (b) 탭 클릭 시 해당 콘텐츠만 열림, (c) 같은 탭을 다시 클릭하면 닫힘, (d) 다른 탭 클릭 시
// 이전 탭은 자동으로 닫히고 새 탭만 열림, (e) 콘솔 에러 없음.
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
await page.waitForSelector(".markdown-help-nav");

const checks = [];

function activeCount() {
  return page.evaluate(() => document.querySelectorAll(".markdown-help-item.active").length);
}

checks.push(["초기 상태: 전부 닫혀있음", (await activeCount()) === 0]);

await page.locator('.help-nav:has-text("Header")').click();
const headerOpen = await page.evaluate(() => {
  const item = document.querySelector(".markdown-help-item.markdownHeaders");
  return item ? item.classList.contains("active") : false;
});
checks.push(["Header 클릭 -> markdownHeaders 열림", headerOpen]);
checks.push(["Header 클릭 -> 딱 1개만 열림", (await activeCount()) === 1]);

await page.locator('.help-nav:has-text("Header")').click();
checks.push(["같은 탭 재클릭 -> 전부 닫힘", (await activeCount()) === 0]);

await page.getByText("Link", { exact: true }).click();
await page.getByText("Table", { exact: true }).click();
const tableOpen = await page.evaluate(() => {
  const item = document.querySelector(".markdown-help-item.markdownTables");
  const linkItem = document.querySelector(".markdown-help-item.markdownLinks");
  return {
    tableActive: item ? item.classList.contains("active") : false,
    linkActive: linkItem ? linkItem.classList.contains("active") : false,
  };
});
checks.push(["다른 탭 클릭 -> 이전 탭(Link) 자동으로 닫힘", tableOpen.linkActive === false]);
checks.push(["다른 탭 클릭 -> 새 탭(Table) 열림", tableOpen.tableActive === true]);

let allPass = errors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

await browser.close();
await server.close();

if (!allPass) {
  console.error("도움말 패널 스모크 테스트 실패");
  process.exit(1);
}
console.log("도움말 패널 스모크 테스트 통과");
