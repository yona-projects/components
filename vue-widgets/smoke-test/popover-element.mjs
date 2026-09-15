// defineCustomElement 빌드(dist-element/yona-popover-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/popover-element.html`;

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
await page.waitForFunction(() => document.querySelector("yona-popover")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-popover").shadowRoot));

// 1. showTooltip: 실제 body 자식으로 생성 + title -> data-original-title 이동
await page.evaluate(() => document.querySelector("yona-popover").showTooltip(document.getElementById("tooltip-trigger")));
await page.waitForTimeout(50);
let result = await page.evaluate(() => {
  const trigger = document.getElementById("tooltip-trigger");
  const tooltip = document.body.querySelector(":scope > .tooltip");
  return {
    hasTooltip: !!tooltip,
    text: tooltip?.querySelector(".tooltip-inner")?.textContent,
    triggerTitle: trigger.getAttribute("title"),
    triggerDataOriginalTitle: trigger.getAttribute("data-original-title"),
    hasInClass: tooltip?.classList.contains("in"),
    placementClass: tooltip?.classList.contains("top"),
  };
});
check("showTooltip으로 실제 body 자식에 .tooltip 생성", result.hasTooltip === true);
check("실제 title 텍스트가 tooltip-inner에 반영됨", result.text === "툴팁 내용");
check("원본 title 속성이 비워짐(네이티브 브라우저 툴팁 중복 방지)", result.triggerTitle === "");
check("title이 data-original-title로 이동함", result.triggerDataOriginalTitle === "툴팁 내용");
check("fade in 클래스가 붙어 보이는 상태", result.hasInClass === true);
check("기본 placement(top) 클래스 반영", result.placementClass === true);

// 2. 같은 트리거에 다시 showTooltip해도 중복 생성 안 됨
await page.evaluate(() => document.querySelector("yona-popover").showTooltip(document.getElementById("tooltip-trigger")));
await page.waitForTimeout(50);
result = await page.evaluate(() => document.body.querySelectorAll(":scope > .tooltip").length);
check("같은 트리거 재호출은 중복 생성 안 함(idempotent)", result === 1);

// 3. hideTooltip: fade-out 트랜지션 이후 제거(폴백 500ms 이내 실제로 사라짐)
await page.evaluate(() => document.querySelector("yona-popover").hideTooltip(document.getElementById("tooltip-trigger")));
await page.waitForTimeout(50);
result = await page.evaluate(() => document.body.querySelector(":scope > .tooltip")?.classList.contains("in"));
check("hideTooltip 호출 즉시 in 클래스가 빠짐(페이드아웃 시작)", result === false);
await page.waitForTimeout(600);
result = await page.evaluate(() => !!document.body.querySelector(":scope > .tooltip"));
check("hideTooltip 후 실제로 완전히 제거됨(폴백 500ms 이내)", result === false);

// 4. data-html="true" 툴팁은 innerHTML로 반영됨
await page.evaluate(() => document.querySelector("yona-popover").showTooltip(document.getElementById("tooltip-html-trigger")));
await page.waitForTimeout(50);
result = await page.evaluate(() => document.body.querySelector(":scope > .tooltip .tooltip-inner")?.innerHTML);
check("data-html=true면 실제 HTML로 렌더링됨(굵게 태그 실제로 존재)", result === "<b>굵게</b>");
await page.evaluate(() => document.querySelector("yona-popover").hideTooltip(document.getElementById("tooltip-html-trigger")));
await page.waitForTimeout(600);

// 5. showPopoverError: 즉시(트랜지션 대기 없이) 생성, 기본 placement=left
await page.evaluate(() => document.querySelector("yona-popover").showPopoverError(document.getElementById("error-target"), "필수 입력값입니다"));
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const popover = document.body.querySelector(":scope > .popover");
  return { hasPopover: !!popover, text: popover?.querySelector(".popover-content")?.textContent, placementClass: popover?.classList.contains("left"), hasTitle: !!popover?.querySelector(".popover-title") };
});
check("showPopoverError로 실제 .popover 생성", result.hasPopover === true);
check("실제 에러 메시지가 popover-content에 반영됨", result.text === "필수 입력값입니다");
check("기본 placement(left) 클래스 반영", result.placementClass === true);
check("title 없으면 popover-title 자체가 없음", result.hasTitle === false);

// 6. showPopoverError 재호출은 기존 것을 즉시 교체
await page.evaluate(() => document.querySelector("yona-popover").showPopoverError(document.getElementById("error-target"), "다른 메시지", "right"));
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const popovers = document.body.querySelectorAll(":scope > .popover");
  return { count: popovers.length, text: popovers[0]?.querySelector(".popover-content")?.textContent, placement: Array.from(popovers[0]?.classList || []) };
});
check("재호출 시 기존 popover 1개만 유지(교체)", result.count === 1);
check("재호출한 새 메시지로 갱신됨", result.text === "다른 메시지");
check("재호출한 새 placement(right)로 갱신됨", result.placement.includes("right"));

// 7. hidePopoverError: 트랜지션 대기 없이 즉시 제거
await page.evaluate(() => document.querySelector("yona-popover").hidePopoverError(document.getElementById("error-target")));
await page.waitForTimeout(20);
result = await page.evaluate(() => !!document.body.querySelector(":scope > .popover"));
check("hidePopoverError 호출로 즉시(트랜지션 대기 없이) 제거됨", result === false);

// 8. initHoverPopovers: 실제 마우스 호버로 실제 팝오버 표시/제거(100ms 디바운스)
await page.evaluate(() => document.querySelector("yona-popover").initHoverPopovers("[data-toggle='popover']"));
await page.hover("#hover-trigger");
await page.waitForTimeout(200);
result = await page.evaluate(() => {
  const popover = document.body.querySelector(":scope > .popover");
  return { hasPopover: !!popover, title: popover?.querySelector(".popover-title")?.textContent, content: popover?.querySelector(".popover-content")?.textContent };
});
check("실제 마우스 호버로 실제 팝오버가 표시됨", result.hasPopover === true);
check("data-original-title이 popover-title로 반영됨", result.title === "팝오버 제목");
check("data-content가 popover-content로 반영됨", result.content === "호버 팝오버 내용");

await page.mouse.move(0, 0);
await page.waitForTimeout(200);
result = await page.evaluate(() => !!document.body.querySelector(":scope > .popover"));
check("실제 마우스 아웃으로 실제 팝오버가 제거됨", result === false);

// 9. dialog-awareness: 열린 dialog 안 트리거의 툴팁은 dialog의 자식으로 그려짐
await page.evaluate(() => document.getElementById("test-dialog").showModal());
await page.evaluate(() => document.querySelector("yona-popover").showTooltip(document.getElementById("dialog-tooltip-trigger")));
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialog = document.getElementById("test-dialog");
  return { insideDialog: !!dialog.querySelector(":scope > .tooltip"), insideBody: !!document.body.querySelector(":scope > .tooltip") };
});
check("열린 dialog 안 트리거의 툴팁은 dialog 자식으로 렌더링됨(top layer 대응)", result.insideDialog === true);
check("body 직계 자식에는 안 생김", result.insideBody === false);

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);
await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
