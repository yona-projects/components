// defineCustomElement 빌드(dist-element/yona-dropdown-element.js) 스모크 테스트 -
// toast-element.mjs/switch-element.mjs와 동일한 이유/방식.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/dropdown-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-dropdown")?.shadowRoot);

// 0. 버튼/목록이 여전히 document 레벨에서 검색 가능(라이트 DOM 유지 - 전역
//    [data-toggle="dropdown"] 델리게이트가 실제 yona에서 이걸로 찾는다)
const discoverable = await page.evaluate(() => !!document.querySelector('[data-toggle="dropdown"]'));

// 1. data-selected=true 기본값이 마운트 시 자동 선택되는지(_selectDefault)
const initial = await page.evaluate(() => ({
  label: document.querySelector(".d-label").textContent,
  hiddenValue: document.querySelector('input[name="state"]')?.value,
  activeItem: document.querySelector("li.active")?.getAttribute("data-value"),
}));

// 2. 실제 클릭으로 다른 항목 선택
await page.locator('li[data-value="OPEN"] a').click();
await page.waitForTimeout(50);
const afterClick = await page.evaluate(() => ({
  label: document.querySelector(".d-label").textContent,
  hiddenValue: document.querySelector('input[name="state"]')?.value,
  activeItem: document.querySelector("li.active")?.getAttribute("data-value"),
}));

// 3. defineExpose된 getValue/onChange/selectByValue 확인
const exposed = await page.evaluate(() => {
  const el = document.querySelector("yona-dropdown");
  let changedTo = null;
  el.onChange((v) => { changedTo = v; });
  el.selectByValue("CLOSED");
  return { getValueAfterSelect: el.getValue(), changedTo };
});
await page.waitForTimeout(20);
const changedToAfterTimeout = await page.evaluate(() => {
  // onChange는 setTimeout(0)로 비동기 호출되므로 별도로 확인
  return document.querySelector('input[name="state"]').value;
});

const checks = [
  ["버튼이 document 레벨에서 여전히 검색 가능(data-toggle=dropdown)", discoverable === true],
  ["초기 data-selected=true 기본값 자동 선택", initial.label === "닫힘" && initial.hiddenValue === "CLOSED" && initial.activeItem === "CLOSED"],
  ["클릭 후 라벨 갱신", afterClick.label === "열림"],
  ["클릭 후 hidden input 갱신", afterClick.hiddenValue === "OPEN"],
  ["클릭 후 active 클래스 이동", afterClick.activeItem === "OPEN"],
  ["selectByValue() 이후 getValue() 반영", exposed.getValueAfterSelect === "CLOSED"],
  ["selectByValue() 이후 hidden input 반영", changedToAfterTimeout === "CLOSED"],
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
