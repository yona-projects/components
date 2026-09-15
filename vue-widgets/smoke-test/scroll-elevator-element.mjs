// defineCustomElement 빌드(dist-element/yona-scroll-elevator-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/scroll-elevator-element.html`;

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
await page.waitForFunction(() => document.querySelector("yona-scroll-elevator")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-scroll-elevator").shadowRoot));

let result = await page.evaluate(() => {
  const div = document.body.querySelector(":scope > div.jq-elevator");
  const insideShadow = !!document.querySelector("yona-scroll-elevator").shadowRoot.querySelector(".jq-elevator");
  return {
    isLightDomChild: !!div,
    insideShadow,
    classes: div ? Array.from(div.classList) : [],
  };
});
check("Teleport로 실제 body 직계 자식이 됨", result.isLightDomChild === true);
check("shadow DOM 안에는 없음(전부 라이트 DOM으로 이동)", result.insideShadow === false);
check("data-shape=rounded가 클래스에 반영됨", result.classes.includes("rounded"));
check("data-glass=true가 glass 클래스로 반영됨", result.classes.includes("glass"));
check("기본 align('bottom right')이 align-bottom/align-right로 반영됨", result.classes.includes("align-bottom") && result.classes.includes("align-right"));

// 페이지 최상단 - top은 작게, bottom은 크게
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(100);
result = await page.evaluate(() => {
  const div = document.body.querySelector("div.jq-elevator");
  return {
    topClass: Array.from(div.querySelector(".jq-top").classList),
    bottomClass: Array.from(div.querySelector(".jq-bottom").classList),
  };
});
check("최상단: top이 jq-sml", result.topClass.includes("jq-sml"));
check("최상단: bottom이 jq-big", result.bottomClass.includes("jq-big"));

// 중간 스크롤 - 둘 다 중간 크기
await page.evaluate(() => window.scrollTo(0, 1500));
await page.waitForTimeout(100);
result = await page.evaluate(() => {
  const div = document.body.querySelector("div.jq-elevator");
  return {
    topClass: Array.from(div.querySelector(".jq-top").classList),
    bottomClass: Array.from(div.querySelector(".jq-bottom").classList),
  };
});
check("중간 스크롤: top이 jq-mid", result.topClass.includes("jq-mid"));
check("중간 스크롤: bottom이 jq-mid", result.bottomClass.includes("jq-mid"));

// 최하단 - top은 크게, bottom은 작게
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(100);
result = await page.evaluate(() => {
  const div = document.body.querySelector("div.jq-elevator");
  return {
    topClass: Array.from(div.querySelector(".jq-top").classList),
    bottomClass: Array.from(div.querySelector(".jq-bottom").classList),
  };
});
check("최하단: top이 jq-big", result.topClass.includes("jq-big"));
check("최하단: bottom이 jq-sml", result.bottomClass.includes("jq-sml"));

// 실제 클릭으로 실제 스크롤 동작
await page.locator("div.jq-elevator .jq-top").click();
await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 });
check("실제 top 링크 클릭으로 실제 최상단까지 스크롤됨", await page.evaluate(() => window.scrollY === 0));

await page.locator("div.jq-elevator .jq-bottom").click();
await page.waitForFunction(
  () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
  null,
  { timeout: 3000 },
);
check("실제 bottom 링크 클릭으로 실제 최하단까지 스크롤됨", true);

// title/tooltip 표현 방식(기본은 title 속성, tooltips=true면 내부 span)
result = await page.evaluate(() => {
  const div = document.body.querySelector("div.jq-elevator");
  return { titleAttr: div.querySelector(".jq-top").getAttribute("title"), hasSpan: !!div.querySelector(".jq-title") };
});
check("tooltips=false(기본)면 title 속성으로 표시", result.titleAttr === "Move to Top");
check("tooltips=false(기본)면 내부 span은 없음", result.hasSpan === false);

await page.evaluate(() => {
  const el = document.createElement("yona-scroll-elevator");
  el.setAttribute("data-tooltips", "true");
  document.body.appendChild(el);
});
await page.waitForTimeout(100);
result = await page.evaluate(() => {
  const divs = document.body.querySelectorAll(":scope > div.jq-elevator");
  const div = divs[divs.length - 1];
  return { titleAttr: div.querySelector(".jq-top").getAttribute("title"), spanText: div.querySelector(".jq-title")?.textContent };
});
check("tooltips=true면 title 속성 없음", result.titleAttr === null);
check("tooltips=true면 내부 span으로 타이틀 표시", result.spanText === "Move to Top");

// destroy() - 리스너 해제 + host 제거로 완전히 사라지는지
const beforeCount = await page.evaluate(() => document.body.querySelectorAll("div.jq-elevator").length);
await page.evaluate(() => {
  const el = document.querySelector("yona-scroll-elevator");
  el.destroy();
  el.remove();
});
await page.waitForTimeout(100);
const afterCount = await page.evaluate(() => document.body.querySelectorAll("div.jq-elevator").length);
check("destroy() + host 제거로 실제 위젯이 완전히 사라짐", afterCount === beforeCount - 1);

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);
await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
