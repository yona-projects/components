// defineCustomElement 빌드(dist-element/yona-typeahead-element.js) 스모크 테스트 -
// toast-element.mjs/dropdown-element.mjs와 동일한 이유/방식.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/typeahead-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-typeahead")?.shadowRoot);

// 0. 입력 필드가 document 레벨에서 여전히 검색 가능(라이트 DOM 유지 확인)
const discoverable = await page.evaluate(() => !!document.getElementById("tag-input"));

// 1. 타이핑 -> 필터링 + 정렬 + 하이라이트
await page.locator("#tag-input").click();
await page.locator("#tag-input").type("d");
await page.waitForTimeout(50);
const afterType = await page.evaluate(() => {
  const el = document.querySelector("yona-typeahead");
  const menu = el.shadowRoot.querySelector(".typeahead");
  const items = Array.from(menu.querySelectorAll("li a")).map((a) => a.textContent);
  const activeItem = menu.querySelector("li.active a")?.textContent;
  const highlighted = menu.querySelector("li a").innerHTML;
  return { display: getComputedStyle(menu).display, items, activeItem, highlighted };
});

// 2. 화살표 아래로 활성 항목 이동
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(30);
const afterArrowDown = await page.evaluate(() =>
  document.querySelector("yona-typeahead").shadowRoot.querySelector("li.active a")?.textContent,
);

// 3. Enter로 선택 -> 실제 입력값 반영 + change 이벤트 발생 + 메뉴 닫힘
const changeFired = await page.evaluate(() => {
  window.__changed = false;
  document.getElementById("tag-input").addEventListener("change", () => { window.__changed = true; });
  return true;
});
await page.keyboard.press("Enter");
await page.waitForTimeout(50);
const afterEnter = await page.evaluate(() => ({
  inputValue: document.getElementById("tag-input").value,
  changed: window.__changed,
  menuDisplay: getComputedStyle(document.querySelector("yona-typeahead").shadowRoot.querySelector(".typeahead")).display,
}));

// 4. 클릭으로도 선택되는지
await page.fill("#tag-input", "");
await page.locator("#tag-input").type("f");
await page.waitForTimeout(50);
await page.locator("yona-typeahead").locator("css=li a").first().click();
await page.waitForTimeout(50);
const afterClick = await page.evaluate(() => document.getElementById("tag-input").value);

// 5. ESC로 닫히는지
await page.fill("#tag-input", "");
await page.locator("#tag-input").type("b");
await page.waitForTimeout(50);
await page.keyboard.press("Escape");
await page.waitForTimeout(50);
const afterEscape = await page.evaluate(() =>
  getComputedStyle(document.querySelector("yona-typeahead").shadowRoot.querySelector(".typeahead")).display,
);

const checks = [
  ["입력 필드가 document 레벨에서 여전히 검색 가능", discoverable === true],
  ["타이핑 후 메뉴 표시", afterType.display === "block"],
  ["필터링+정렬 결과 정확(documentation, duplicate 순)", JSON.stringify(afterType.items) === JSON.stringify(["documentation", "duplicate"])],
  ["첫 항목이 기본 활성", afterType.activeItem === "documentation"],
  ["매치된 부분이 <strong>으로 하이라이트", afterType.highlighted.includes("<strong>d</strong>") || afterType.highlighted.includes("<strong>D</strong>")],
  ["ArrowDown으로 활성 항목 이동", afterArrowDown === "duplicate"],
  ["Enter로 선택 시 입력값 반영", afterEnter.inputValue === "duplicate"],
  ["Enter로 선택 시 실제 change 이벤트 발생", afterEnter.changed === true],
  ["Enter로 선택 후 메뉴 닫힘", afterEnter.menuDisplay === "none"],
  ["클릭으로 선택 시 입력값 반영", afterClick === "feature"],
  ["ESC로 메뉴 닫힘", afterEscape === "none"],
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
