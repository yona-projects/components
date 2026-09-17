// service/yona.user.Setting.js가 document.querySelectorAll(".notiUpdate")로 체크박스를 직접 찾아
// change 리스너를 붙인다 - <yona-switch>로 감싼 뒤에도 체크박스는 라이트 DOM에 실존해야 한다.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/switch-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-switch")?.shadowRoot);

const discoverable = await page.evaluate(() => !!document.querySelector(".notiUpdate"));

const initial = await page.evaluate(() => {
  const el = document.querySelector("yona-switch");
  const inner = el.shadowRoot.querySelector(".switch-animate");
  return {
    ariaChecked: el.shadowRoot.querySelector('[role="checkbox"]').getAttribute("aria-checked"),
    innerClass: inner.className,
  };
});

await page.evaluate(() => {
  window.__changeFired = 0;
  document.querySelector(".notiUpdate").addEventListener("change", () => { window.__changeFired++; });
});
await page.locator("yona-switch").locator("css=.switch-left").click();
await page.waitForTimeout(50);

const afterOffClick = await page.evaluate(() => ({
  checkboxChecked: document.querySelector(".notiUpdate").checked,
  ariaChecked: document.querySelector("yona-switch").shadowRoot.querySelector('[role="checkbox"]').getAttribute("aria-checked"),
  innerClass: document.querySelector("yona-switch").shadowRoot.querySelector(".switch-animate").className,
  changeFired: window.__changeFired,
}));

await page.locator("yona-switch").locator("css=.switch-right").click();
await page.waitForTimeout(50);
const afterOnClick = await page.evaluate(() => ({
  checkboxChecked: document.querySelector(".notiUpdate").checked,
  changeFired: window.__changeFired,
}));

await page.locator("yona-switch").locator('[role="checkbox"]').focus();
await page.keyboard.press("Space");
await page.waitForTimeout(50);
const afterSpace = await page.evaluate(() => ({
  checkboxChecked: document.querySelector(".notiUpdate").checked,
  changeFired: window.__changeFired,
}));

const checks = [
  ["체크박스가 document 레벨에서 여전히 검색 가능", discoverable === true],
  ["초기 aria-checked=true", initial.ariaChecked === "true"],
  ["초기 switch-on 클래스", initial.innerClass.includes("switch-on")],
  [".switch-left 클릭 후 체크박스 off", afterOffClick.checkboxChecked === false],
  [".switch-left 클릭 후 aria-checked=false", afterOffClick.ariaChecked === "false"],
  [".switch-left 클릭 후 switch-off 클래스", afterOffClick.innerClass.includes("switch-off")],
  [".switch-left 클릭 시 라이트 DOM 체크박스에 실제 change 이벤트 발생", afterOffClick.changeFired === 1],
  [".switch-right 클릭 후 체크박스 on", afterOnClick.checkboxChecked === true],
  [".switch-right 클릭 시 change 이벤트 추가 발생", afterOnClick.changeFired === 2],
  ["스페이스바로 토글(off)", afterSpace.checkboxChecked === false],
  ["스페이스바 토글 시 change 이벤트 발생", afterSpace.changeFired === 3],
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
