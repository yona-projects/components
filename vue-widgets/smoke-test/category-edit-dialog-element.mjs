// defineCustomElement 빌드(dist-element/yona-category-edit-dialog-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/category-edit-dialog-element.html`;

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
      "label.category": "카테고리",
      "label.category.option": "이 카테고리에서는",
      "label.category.option.multiple": "다중 선택 가능",
      "label.category.option.single": "단일 선택만 가능",
      "button.save": "저장",
      "button.cancel": "취소",
      "label.category.edit": "카테고리 수정",
      "label.failedTo": `${args[0]} 실패`,
      "error.failedTo": `${args[0]} 실패 (${args[1]} ${args[2]})`,
    };
    return table[key] ?? key;
  };
});

const capturedRequests = [];
await page.route("**/mock-category/**", async (route, request) => {
  capturedRequests.push({ method: request.method(), url: request.url(), body: request.postData() });
  if (request.url().includes("fail")) {
    await route.fulfill({ status: 500, body: "" });
    return;
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-category-edit-dialog")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-category-edit-dialog").shadowRoot));

// 1. Teleport로 실제 body 자식이 됐는지
let result = await page.evaluate(() => {
  const dialog = document.body.querySelector(":scope > dialog#editCategory");
  return { isDirectBodyChild: !!dialog, insideShadow: !!document.querySelector("yona-category-edit-dialog").shadowRoot.querySelector("dialog") };
});
check("Teleport로 <dialog>가 실제 body 직계 자식이 됨", result.isDirectBodyChild === true);
check("shadow DOM 안에는 <dialog>가 없음", result.insideShadow === false);

// 2. show() 호출 -> 실제 다이얼로그 open + 입력값 초기화 + i18n 라벨 반영
await page.evaluate(() => {
  document.querySelector("yona-category-edit-dialog").show({
    projectId: "1",
    categoryId: "5",
    categoryName: "default",
    categoryIsExclusive: true,
    categoryUpdateUri: "/mock-category/5",
  });
});
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog#editCategory");
  return {
    open: dialog.open,
    nameValue: dialog.querySelector('input[name="name"]').value,
    exclusiveValue: dialog.querySelector('select[name="isExclusive"]').value,
    saveLabel: dialog.querySelector(".btnSubmit").textContent.trim(),
    cancelLabel: dialog.querySelector(".ybtn-default[data-dismiss=\"modal\"]").textContent.trim(),
  };
});
check("show() 호출로 실제 <dialog>가 open 상태", result.open === true);
check("실제 카테고리명이 입력값으로 반영됨", result.nameValue === "default");
check("배타(single) 여부가 select 값에 반영됨(TomSelect 미로드 환경의 네이티브 폴백)", result.exclusiveValue === "true");
check("Messages()로 실제 저장 버튼 라벨 반영", result.saveLabel === "저장");
check("Messages()로 실제 취소 버튼 라벨 반영", result.cancelLabel === "취소");

// 3. 배경 클릭으로 실제 닫힘
await page.mouse.click(2, 2);
await page.waitForTimeout(50);
check("배경(다이얼로그 자신) 클릭으로 실제 닫힘", await page.evaluate(() => document.body.querySelector("dialog#editCategory").open === false));

// 4. X 닫기 버튼 클릭으로 실제 닫힘
await page.evaluate(() => document.querySelector("yona-category-edit-dialog").show({
  projectId: "1", categoryId: "5", categoryName: "default", categoryIsExclusive: false, categoryUpdateUri: "/mock-category/5",
}));
await page.waitForTimeout(50);
await page.locator("dialog#editCategory .btn-dismiss button").click();
await page.waitForTimeout(50);
check("X 닫기 버튼 클릭으로 실제 닫힘", await page.evaluate(() => document.body.querySelector("dialog#editCategory").open === false));

// 5. 저장 클릭 -> 실제 PUT 요청 + 이름 수정 반영 + 성공 시 실제 페이지 리로드
await page.evaluate(() => document.querySelector("yona-category-edit-dialog").show({
  projectId: "1", categoryId: "5", categoryName: "default", categoryIsExclusive: false, categoryUpdateUri: "/mock-category/5",
}));
await page.waitForTimeout(50);
await page.locator("dialog#editCategory input[name=\"name\"]").fill("renamed");
await Promise.all([
  page.waitForLoadState("load"),
  page.locator("dialog#editCategory .btnSubmit").click(),
]);
result = capturedRequests[capturedRequests.length - 1];
check("실제 요청이 PUT 메서드로 감", result?.method === "put" || result?.method === "PUT");
check("실제 요청이 categoryUpdateUri(/mock-category/5)로 감", result?.url.endsWith("/mock-category/5"));
check("실제 요청 바디에 변경된 이름 반영", result?.body.includes("name=renamed"));
check("실제 요청 바디에 project.id 반영", result?.body.includes("project.id=1"));
check("성공 응답 시 실제로 페이지가 리로드됨", page.url() === pageUrl);

// 6. 서버 에러(500) 시 실제 에러 다이얼로그 표시
// 직전 시나리오의 성공 응답이 실제 페이지 리로드를 일으켰다(reload는 재할당으로
// 가로챌 수 없다 - login-dialog-element.mjs에서 실측 확인한 것과 동일). Vite
// dev 클라이언트가 그 진짜 리로드 직후 자기 것대로 한 번 더(HMR 재연결 감지로
// 추정) 리로드를 일으키는 게 실측으로 확인돼(framenavigated 이벤트 2회), 그
// 두 번째 리로드가 끝나기 전에 다음 show()를 부르면 그 사이 detach된 엘리먼트를
// 잡는다 - networkidle까지 기다려 안정화를 보장한다.
await page.waitForLoadState("networkidle");
await page.waitForFunction(() => document.querySelector("yona-category-edit-dialog")?.shadowRoot);
await page.evaluate(() => document.querySelector("yona-category-edit-dialog").show({
  projectId: "1", categoryId: "9", categoryName: "broken", categoryIsExclusive: false, categoryUpdateUri: "/mock-category/9/fail",
}));
await page.waitForTimeout(50);
await page.locator("dialog#editCategory .btnSubmit").click();
await page.waitForTimeout(100);
result = await page.evaluate(() => document.querySelector("yona-dialog").shadowRoot.querySelector(".msg").textContent);
check("서버 에러 시 실제 에러 메시지가 Messages()로 조합되어 표시됨", result.includes("카테고리 수정 실패") && result.includes("500"));
check("서버 에러 후 실제로 다이얼로그가 닫힘(finally hide)", await page.evaluate(() => document.body.querySelector("dialog#editCategory").open === false));

// 6번 시나리오가 의도적으로 500 응답을 라우트로 흘려보내는데, 그 자체가
// Chromium 콘솔에 "Failed to load resource" 에러를 남긴다(실제 네트워크
// 계층에서 나는 메시지라 JS 쪽에서 억제할 수 없다) - help-element.mjs와 동일한
// 이유로 이 특정 메시지만 걸러낸다.
const unexpectedErrors = errors.filter((e) => !e.includes("Failed to load resource"));
console.log("콘솔 에러(의도된 500 응답 로그 제외):", unexpectedErrors.length === 0 ? "없음" : unexpectedErrors);

const allPass = unexpectedErrors.length === 0 && checks.every(([, pass]) => pass);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
