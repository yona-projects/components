// defineCustomElement 빌드(dist-element/yona-new-label-form-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/new-label-form-element.html`;

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

await page.addInitScript(() => {
  // lib/rgbcolor.js(전역 RGBColor)의 최소 스텁 - 이 스모크 테스트가 실제로 쓰는
  // 두 형식(#rrggbb류 hex, rgb(r,g,b))만 커버한다(전체 파서 재구현 아님).
  window.RGBColor = function (colorString) {
    this.ok = false;
    const hexMatch = /^#?([0-9a-f]{6})$/i.exec(colorString.trim());
    if (hexMatch) {
      this.ok = true;
      this.r = parseInt(hexMatch[1].slice(0, 2), 16);
      this.g = parseInt(hexMatch[1].slice(2, 4), 16);
      this.b = parseInt(hexMatch[1].slice(4, 6), 16);
    }
    const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(colorString.trim());
    if (rgbMatch) {
      this.ok = true;
      this.r = parseInt(rgbMatch[1], 10);
      this.g = parseInt(rgbMatch[2], 10);
      this.b = parseInt(rgbMatch[3], 10);
    }
    this.toHex = () => {
      const toPart = (n) => n.toString(16).padStart(2, "0");
      return `#${toPart(this.r)}${toPart(this.g)}${toPart(this.b)}`;
    };
  };

  window.Messages = function (key, ...args) {
    const table = {
      "label.new": "새 라벨",
      "label.category": "카테고리",
      "label.name": "이름",
      "label.add": "추가",
      "label.error.empty": "빈 항목이 있습니다.",
      "label.error.color": `색상 오류: ${args[0]}`,
      "label.error.duplicated": "이미 존재하는 라벨입니다.",
      "label.category.new.confirm": `새 카테고리 "${args[0]}"를 만들까요?`,
      "label.category.option.multiple": "다중 선택",
      "label.category.option.single": "단일 선택",
      "label.failedTo": `${args[0]} 실패`,
    };
    return table[key] ?? key;
  };
});

// document.location.reload는 실 Chromium에서 재할당해도 무시되고 진짜 리로드가
// 일어난다(login-dialog-element.mjs 9번 시나리오에서 실측 확인) - 그 리로드에
// window.fetch 스텁 등 페이지 JS 상태가 전부 날아가므로, 실제 요청 바디는 페이지
// 상태가 아니라 Playwright 쪽(네트워크 레이어)에서 직접 캡처한다.
const capturedRequests = [];
await page.route("**/mock-labels", async (route, request) => {
  capturedRequests.push({ url: request.url(), body: request.postData() });
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 1 }) });
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-new-label-form")?.shadowRoot);
await page.waitForFunction(() => document.querySelector("yona-dialog")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-new-label-form").shadowRoot));

// 1. "Teleport to self": .new-label-wrap이 실제 host의 라이트 DOM 자식이 됨(shadow
//    안이 아님) + .label-editor-wrap 조상 스코프 CSS가 실제로 적용됨.
let result = await page.evaluate(() => {
  const host = document.querySelector("yona-new-label-form");
  const lightChild = host.querySelector(":scope > form.new-label-wrap");
  const insideShadow = host.shadowRoot.querySelector("form.new-label-wrap");
  return {
    isLightDomChild: !!lightChild,
    insideShadow: !!insideShadow,
    bgColor: lightChild ? getComputedStyle(lightChild).backgroundColor : null,
  };
});
check("Teleport로 form.new-label-wrap이 실제 host의 라이트 DOM 자식이 됨", result.isLightDomChild === true);
check("shadow DOM 안에는 form이 없음", result.insideShadow === false);
check(".label-editor-wrap 조상 스코프 CSS가 실제로 적용됨(rgb(17, 17, 17))", result.bgColor === "rgb(17, 17, 17)");

// 2. host 자신의 위치는 그대로(.label-editor-wrap의 직계 자식) - 옮겨지지 않음
result = await page.evaluate(() => {
  const wrap = document.querySelector(".label-editor-wrap");
  return wrap.querySelector(":scope > yona-new-label-form") !== null;
});
check("host 자신의 원래 위치는 그대로 유지됨", result === true);

// 3. 카테고리 typeahead가 실제 라벨 목록(default)으로 configure됨
await page.locator("#target").locator('input[name="category"]').click();
await page.locator("#target").locator('input[name="category"]').type("d");
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const menu = document.querySelector("yona-typeahead")?.shadowRoot.querySelector(".typeahead");
  return Array.from(menu?.querySelectorAll("li a") ?? []).map((a) => a.textContent);
});
check("카테고리 typeahead가 실제 목록(default)으로 필터링됨", JSON.stringify(result) === JSON.stringify(["default"]));
await page.keyboard.press("Escape");

// 4. 기존 카테고리에 포커스 -> 색상 피커가 보이고 카테고리의 첫 라벨 색으로 자동 채워짐
await page.locator("#target").locator('input[name="category"]').fill("default");
await page.locator("#target").locator('input[name="name"]').click();
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const host = document.querySelector("yona-new-label-form");
  const picker = host.querySelector(".label-preset-colors");
  const colorInput = host.querySelector(".input-label-color");
  return {
    visible: getComputedStyle(picker).display !== "none",
    colorValue: colorInput.value,
  };
});
check("기존 카테고리에 포커스 시 색상 피커가 보임", result.visible === true);
check("기존 카테고리의 첫 라벨 색으로 색상값이 자동 채워짐(#f44336)", result.colorValue.toLowerCase() === "#f44336");

// 5. 같은 카테고리에 이미 존재하는 라벨명으로 제출 -> 실제 중복 에러 알림
await page.locator("#target").locator('input[name="name"]').fill("bug");
await page.locator("#target").locator("button.btn-submit").click();
await page.waitForTimeout(80);
result = await page.evaluate(() => document.querySelector("yona-dialog").shadowRoot.querySelector(".msg").textContent);
check("중복 라벨명 제출 시 실제 중복 에러 다이얼로그가 뜸", result === "이미 존재하는 라벨입니다.");
await page.locator("yona-dialog").locator('css=[slot="buttons"]').first().click();
await page.waitForTimeout(50);

// 6. 새 카테고리로 제출 -> 카테고리 종류(단일/다중) 확인 다이얼로그가 뜨고, 선택에 따라
//    실제 요청 바디에 categoryIsExclusive가 반영됨
await page.locator("#target").locator('input[name="category"]').fill("newcat");
await page.locator("#target").locator('input[name="name"]').fill("feature");
await page.locator("#target").locator(".input-label-color").fill("#00ff00");
await page.locator("#target").locator(".input-label-color").dispatchEvent("blur");
await page.waitForTimeout(50);
await page.locator("#target").locator("button.btn-submit").click();
await page.waitForTimeout(80);
result = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  const buttons = Array.from(el.querySelectorAll('[slot="buttons"]'));
  return { msg: el.shadowRoot.querySelector(".msg").textContent, labels: buttons.map((b) => b.textContent) };
});
check("새 카테고리면 종류 확인 다이얼로그가 뜸", result.msg === '새 카테고리 "newcat"를 만들까요?');
check("확인 다이얼로그 버튼이 다중/단일 순서로 보임", JSON.stringify(result.labels) === JSON.stringify(["다중 선택", "단일 선택"]));

await Promise.all([
  page.waitForLoadState("load"),
  page.locator("yona-dialog").locator('css=[slot="buttons"]').nth(1).click(),
]);
result = capturedRequests[capturedRequests.length - 1];
check("실제 요청이 data-action(/mock-labels)으로 감", result?.url.endsWith("/mock-labels"));
check("실제 요청 바디에 categoryIsExclusive=true 반영(단일 선택)", result?.body.includes("categoryIsExclusive=true"));
check("실제 요청 바디에 새 카테고리명 반영", result?.body.includes("categoryName=newcat"));
check("성공(200) 응답 시 실제로 페이지가 리로드됨", page.url() === pageUrl);

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
