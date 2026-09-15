// 페이지 소유 위임 리스너 순수 모듈(dist-element/yona-label-list-adapter.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/label-list-adapter.html`;

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
  window.Messages = function (key, ...args) {
    const table = {
      "label.confirm.delete": "정말 삭제하시겠습니까?",
      "button.cancel": "취소",
      "button.confirm": "확인",
    };
    return table[key] ?? key;
  };
});

const capturedRequests = [];
await page.route("**/mock-label/**", async (route, request) => {
  capturedRequests.push({ method: request.method(), url: request.url(), body: request.postData() });
  await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-dialog")?.shadowRoot);

// 1. 삭제 버튼 클릭 -> 실제 확인 다이얼로그(취소/확인 두 버튼, $yona.confirm 기본값)
await page.locator("tr[data-label-id=\"11\"] .btn-delete-label").click();
await page.waitForTimeout(50);
let result = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  const buttons = Array.from(el.querySelectorAll('[slot="buttons"]'));
  return { msg: el.shadowRoot.querySelector(".msg").textContent, labels: buttons.map((b) => b.textContent) };
});
check("삭제 버튼 클릭 시 실제 확인 메시지가 뜸", result.msg === "정말 삭제하시겠습니까?");
check("확인 다이얼로그가 취소/확인 두 버튼($yona.confirm 기본값)으로 뜸", JSON.stringify(result.labels) === JSON.stringify(["취소", "확인"]));

// 2. 취소 클릭 -> 실제로 삭제 요청이 안 나가고 행도 안 지워짐
await page.locator("yona-dialog").locator('css=[slot="buttons"]').first().click();
await page.waitForTimeout(80);
check("취소 시 실제 네트워크 요청이 안 나감", capturedRequests.length === 0);
check("취소 시 실제로 행이 안 지워짐", await page.evaluate(() => !!document.querySelector('tr[data-label-id="11"]')));

// 3. 확인 클릭 -> 실제 DELETE(POST + _method=delete) 요청 + 행 제거(카테고리는 아직 안 빔)
await page.locator("tr[data-label-id=\"11\"] .btn-delete-label").click();
await page.waitForTimeout(50);
await page.locator("yona-dialog").locator('css=[slot="buttons"]').nth(1).click();
await page.waitForTimeout(80);
result = capturedRequests[capturedRequests.length - 1];
check("실제 요청이 deleteUri(/mock-label/11)로 감", result?.url.endsWith("/mock-label/11"));
check("실제 요청 메서드는 post(_method=delete 오버라이드, 원본과 동일)", result?.method?.toLowerCase() === "post");
check("실제 요청 바디에 _method=delete 포함", result?.body === "_method=delete");
check("성공 후 실제로 그 행이 사라짐", await page.evaluate(() => !document.querySelector('tr[data-label-id="11"]')));
check("카테고리에 라벨이 남아있으면 카테고리 자체는 안 지워짐", await page.evaluate(() => !!document.querySelector('div[data-category-name="default"]')));

// 4. 마지막 라벨까지 삭제하면 실제로 빈 카테고리 자체가 제거됨
await page.locator("tr[data-label-id=\"10\"] .btn-delete-label").click();
await page.waitForTimeout(50);
await page.locator("yona-dialog").locator('css=[slot="buttons"]').nth(1).click();
await page.waitForTimeout(80);
check("마지막 라벨 삭제 후 실제로 빈 카테고리가 통째로 제거됨", await page.evaluate(() => !document.querySelector('div[data-category-name="default"]')));

// 5. 라벨 수정 버튼 클릭 -> 실제 yona-label-edit-dialog.show()가 올바른 데이터로 호출됨
// (다시 초기 상태로 리로드해서 검증 - 위 4번에서 DOM이 다 지워졌으므로)
await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-dialog")?.shadowRoot);
await page.locator("tr[data-label-id=\"10\"] .btn-edit-label").click();
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog#editLabel");
  return {
    open: dialog?.open,
    name: dialog?.querySelector('input[name="name"]')?.value,
    color: dialog?.querySelector(".input-label-color")?.value,
  };
});
check("라벨 수정 버튼 클릭으로 실제 yona-label-edit-dialog가 열림", result.open === true);
check("실제 라벨명/색상이 버튼의 data-*에서 올바르게 전달됨", result.name === "bug" && result.color === "#f44336");

// 6. 카테고리 수정 버튼 클릭 -> 실제 yona-category-edit-dialog.show()가 올바른
//    데이터로 호출됨(_coerceDataValue의 "true" 문자열 -> 불리언 강제변환 포함)
// 직전(5번)에 연 라벨 수정 다이얼로그부터 먼저 닫아야 한다(안 그러면 그
// <dialog>가 화면 위를 덮어 카테고리 버튼 클릭을 가로챈다).
await page.evaluate(() => document.querySelector("yona-label-edit-dialog").hide());
await page.waitForTimeout(50);
await page.locator(".btn-edit-category").click();
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog#editCategory");
  return {
    open: dialog?.open,
    name: dialog?.querySelector('input[name="name"]')?.value,
    exclusiveValue: dialog?.querySelector('select[name="isExclusive"]')?.value,
  };
});
check("카테고리 수정 버튼 클릭으로 실제 yona-category-edit-dialog가 열림", result.open === true);
check("실제 카테고리명이 버튼의 data-*에서 올바르게 전달됨", result.name === "default");
// data-category-is-exclusive="true"(문자열)가 실제로 불리언 true로 강제변환된
// 뒤 다시 select 값으로 반영돼야 한다 - coerceDataValue가 없었다면 문자열
// "true" === true(불리언) 비교가 항상 false가 돼서 이 값이 거꾸로
// "false"로 잘못 전달됐을 것이다(_coerceDataValue 재현이 실제로 필요한 이유).
check("문자열 'true'가 실제로 불리언으로 강제변환돼 select에 반영됨", result.exclusiveValue === "true");

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
