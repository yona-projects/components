// defineCustomElement 빌드(dist-element/yona-pagination-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/pagination-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

const checks = [];
function check(label, pass) {
  checks.push([label, pass]);
}

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-pagination")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-pagination").shadowRoot));

// 1. 기본 렌더링: current=3, totalPages=10 (양쪽 다 활성)
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 3 });
});
await page.waitForTimeout(50);

let result = await page.evaluate(() => {
  const el = document.querySelector("yona-pagination");
  const root = el.shadowRoot;
  const input = root.querySelector("input");
  return {
    hasWrap: !!root.querySelector(".page-navigation-wrap"),
    inputValue: input.value,
    inputName: input.name,
    totalText: root.querySelectorAll(".page-num")[3]?.textContent,
    prevIsLink: !!root.querySelector(".page-num.ikon a[href]"),
    prevOff: !!root.querySelector(".page-num.ikon i.off"),
  };
});
check("update() 렌더링: page-navigation-wrap 생성", result.hasWrap);
check("update() 렌더링: 입력값이 current로 채워짐", result.inputValue === "3");
check("update() 렌더링: 기본 파라미터명 pageNum", result.inputName === "pageNum");
check("update() 렌더링: 총 페이지 수 표시", result.totalText === "10");
check("current=3/totalPages=10: prev가 활성 링크", result.prevIsLink === true);
check("current=3/totalPages=10: off 아이콘 없음", result.prevOff === false);

// 2. current === firstPage(1)이면 hasPrev 자동 false(off 상태 마크업)
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 1 });
});
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const root = document.querySelector("yona-pagination").shadowRoot;
  const items = root.querySelectorAll(".page-num.ikon");
  return {
    prevOff: !!items[0].querySelector("i.off"),
    prevHasLink: !!items[0].querySelector("a"),
    nextHasLink: !!items[1].querySelector("a"),
  };
});
check("current=firstPage: prev가 off 마크업(아이콘+span, <a> 없음)", result.prevOff === true && result.prevHasLink === false);
check("current=firstPage: next는 여전히 활성", result.nextHasLink === true);

// 3. current === totalPages이면 hasNext 자동 false
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 10 });
});
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const root = document.querySelector("yona-pagination").shadowRoot;
  const items = root.querySelectorAll(".page-num.ikon");
  return {
    nextOff: !!items[1].querySelector("i.off"),
    prevHasLink: !!items[0].querySelector("a"),
  };
});
check("current=totalPages: next가 off 마크업", result.nextOff === true);
check("current=totalPages: prev는 여전히 활성", result.prevHasLink === true);

// 4. paramNameForPage 커스텀 - input의 name 속성 반영(원본은 클릭-전체선택이 이
//    경우 동작 안 했던 버그가 있었다 - 아래 6번에서 이 컴포넌트는 정상 동작함을 확인)
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(5, { current: 2, paramNameForPage: "page" });
});
await page.waitForTimeout(50);
result = await page.evaluate(() => document.querySelector("yona-pagination").shadowRoot.querySelector("input").name);
check("paramNameForPage 커스텀이 input name에 반영됨", result === "page");

// 5. 입력값 클램프: min 미만/max 초과 보정
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 5 });
});
await page.waitForTimeout(50);
await page.locator("yona-pagination").locator("input").first().fill("0");
result = await page.evaluate(() => document.querySelector("yona-pagination").shadowRoot.querySelector("input").value);
check("입력값이 min(1) 미만이면 1로 보정", result === "1");

await page.locator("yona-pagination").locator("input").first().fill("999");
result = await page.evaluate(() => document.querySelector("yona-pagination").shadowRoot.querySelector("input").value);
check("입력값이 max(totalPages) 초과면 max로 보정", result === "10");

// 6. 클릭 시 select() 핸들러가 paramNameForPage와 무관하게 항상 실행됨(원본은
//    input[name="pageNum"] 하드코딩이라 커스텀 이름에서는 실행 경로 자체를 못 탔다).
//    단, 실측 확인 결과 type="number" 입력창은 최신 브라우저에서 select()/
//    selectionStart가 전부 무동작(null)이다(원본도 동일 - 브라우저 플랫폼 한계라
//    시각적 선택 자체는 검증 대상이 아니다 - 에러 없이 클릭이 처리되는지만 확인).
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 5, paramNameForPage: "page" });
});
await page.waitForTimeout(50);
await page.locator("yona-pagination").locator("input").first().click();
result = await page.evaluate(() => {
  const input = document.querySelector("yona-pagination").shadowRoot.querySelector("input");
  return { selectionApiIsNullOnNumberInput: input.selectionStart === null && input.selectionEnd === null };
});
check("클릭 핸들러가 paramNameForPage 커스텀에서도 에러 없이 실행됨", errors.length === 0);
check("(참고) number 입력창의 select() 무동작은 원본과 동일한 브라우저 제약", result.selectionApiIsNullOnNumberInput === true);

// 7. submit 콜백 모드: prev/next 클릭 + 입력 시 실제 네비게이션 없이 submit(pageNum) 호출
await page.evaluate(() => {
  window.__submitCalls = [];
  document.querySelector("yona-pagination").update(10, {
    current: 5,
    submit: (pageNum) => window.__submitCalls.push(pageNum),
  });
});
await page.waitForTimeout(50);
const urlBeforeSubmitClicks = page.url();
await page.locator("yona-pagination").locator(".page-num.ikon a").first().click();
result = await page.evaluate(() => window.__submitCalls.slice());
check("submit 모드: prev 클릭 시 submit(current-1) 호출", result[result.length - 1] === 4);
check("submit 모드: prev 클릭해도 실제 네비게이션 없음", page.url() === urlBeforeSubmitClicks);

await page.locator("yona-pagination").locator(".page-num.ikon a").last().click();
result = await page.evaluate(() => window.__submitCalls.slice());
check("submit 모드: next 클릭 시 submit(current+1) 호출", result[result.length - 1] === 6);

await page.locator("yona-pagination").locator("input").first().fill("7");
result = await page.evaluate(() => window.__submitCalls.slice());
check("submit 모드: 입력만으로도(Enter 없이) submit 호출", result[result.length - 1] === 7);
check("submit 모드: 입력해도 실제 네비게이션 없음", page.url() === urlBeforeSubmitClicks);

// 8. 동기 모드(submit 없음): prev/next 링크의 href가 실제 pageNum으로 정확히 구성됨
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 5 });
});
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const root = document.querySelector("yona-pagination").shadowRoot;
  const links = root.querySelectorAll(".page-num.ikon a");
  return { prevHref: links[0].getAttribute("href"), nextHref: links[1].getAttribute("href") };
});
check("동기 모드: prev href에 pageNum=4", new URL(result.prevHref, pageUrl).searchParams.get("pageNum") === "4");
check("동기 모드: next href에 pageNum=6", new URL(result.nextHref, pageUrl).searchParams.get("pageNum") === "6");

// 9. 실제 클릭으로 진짜 네비게이션(동기 모드) - 여기부터는 실제로 페이지가 이동한다.
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 5 });
});
await page.waitForTimeout(50);
await Promise.all([
  page.waitForURL((url) => url.searchParams.get("pageNum") === "6"),
  page.locator("yona-pagination").locator(".page-num.ikon a").last().click(),
]);
check("실제 next 링크 클릭으로 실제 pageNum=6으로 네비게이션", new URL(page.url()).searchParams.get("pageNum") === "6");

// 10. 실제 Enter 키 입력으로 진짜 네비게이션(동기 모드)
await page.waitForFunction(() => document.querySelector("yona-pagination")?.shadowRoot);
await page.evaluate(() => {
  document.querySelector("yona-pagination").update(10, { current: 6 });
});
await page.waitForTimeout(50);
const input = page.locator("yona-pagination").locator("input").first();
await input.fill("9");
await Promise.all([
  page.waitForURL((url) => url.searchParams.get("pageNum") === "9"),
  input.press("Enter"),
]);
check("입력 후 Enter로 실제 pageNum=9로 네비게이션", new URL(page.url()).searchParams.get("pageNum") === "9");

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
