// defineCustomElement 빌드(dist-element/yona-label-edit-dialog-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/label-edit-dialog-element.html`;

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
  // lib/rgbcolor.js(전역 RGBColor)의 최소 스텁 - new-label-form-element.mjs와
  // 동일한 이유/방식(이 스모크 테스트가 실제로 쓰는 두 형식만 커버).
  window.RGBColor = function (colorString) {
    this.ok = false;
    const hexMatch = /^#?([0-9a-f]{6})$/i.exec(colorString.trim());
    if (hexMatch) {
      this.ok = true;
      this.r = parseInt(hexMatch[1].slice(0, 2), 16);
      this.g = parseInt(hexMatch[1].slice(2, 4), 16);
      this.b = parseInt(hexMatch[1].slice(4, 6), 16);
    }
    this.toHex = () => {
      const toPart = (n) => n.toString(16).padStart(2, "0");
      return `#${toPart(this.r)}${toPart(this.g)}${toPart(this.b)}`;
    };
  };

  window.Messages = function (key, ...args) {
    const table = {
      "label.name": "이름",
      "button.save": "저장",
      "button.cancel": "취소",
      "label.edit": "라벨 수정",
      "label.error.color": `색상 오류: ${args[0]}`,
      "label.error.duplicated.in.category": `카테고리 ${args[0]}에 이미 같은 이름의 라벨이 있습니다.`,
      "label.failedTo": `${args[0]} 실패`,
      "error.failedTo": `${args[0]} 실패 (${args[1]} ${args[2]})`,
    };
    return table[key] ?? key;
  };
});

const capturedRequests = [];
await page.route("**/mock-label/**", async (route, request) => {
  capturedRequests.push({ method: request.method(), url: request.url(), body: request.postData() });
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
});

// 실제 페이지의 전역 TomSelect 스캐너(site/layout.html, 이 컴포넌트의 소유가
// 아님)가 <select data-toggle="tomselect">를 초기화한 것과 동일한 상태를
// 흉내낸다 - 이 스모크 테스트는 그 전역 스캐너 자체를 갖고 있지 않으므로
// 직접 심어서 "TomSelect가 실제로 붙었을 때"의 계약을 검증한다.
async function attachFakeTomSelect() {
  await page.evaluate(() => {
    const select = document.querySelector('yona-label-edit-dialog').shadowRoot
      ? null
      : null;
    const dialog = Array.from(document.querySelectorAll('dialog')).find((d) => d.id === 'editLabel');
    const el = dialog.querySelector('select[name="category.id"]');
    if (el.tomselect) return;
    el.tomselect = {
      getValue: () => el.value,
      setValue: (v) => { el.value = v; },
      options: {
        1: { value: "1", text: "default" },
        2: { value: "2", text: "priority" },
      },
    };
  });
}

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-label-edit-dialog")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-label-edit-dialog").shadowRoot));

let result = await page.evaluate(() => {
  const dialog = document.body.querySelector(":scope > dialog#editLabel");
  return { isDirectBodyChild: !!dialog, insideShadow: !!document.querySelector("yona-label-edit-dialog").shadowRoot.querySelector("dialog") };
});
check("Teleport로 <dialog>가 실제 body 직계 자식이 됨", result.isDirectBodyChild === true);
check("shadow DOM 안에는 <dialog>가 없음", result.insideShadow === false);

await page.evaluate(() => {
  document.querySelector("yona-label-edit-dialog").show({
    categoryId: "1", labelName: "bug", labelColor: "#f44336", updateUri: "/mock-label/10",
  });
});
await page.waitForTimeout(50);
await attachFakeTomSelect();
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog#editLabel");
  return {
    open: dialog.open,
    nameValue: dialog.querySelector('input[name="name"]').value,
    colorValue: dialog.querySelector(".input-label-color").value,
    saveLabel: dialog.querySelector(".btnSubmit").textContent.trim(),
  };
});
check("show() 호출로 실제 <dialog>가 open 상태", result.open === true);
check("실제 라벨명이 입력값으로 반영됨", result.nameValue === "bug");
check("실제 라벨 색상이 색상 입력값으로 반영됨", result.colorValue === "#f44336");
check("Messages()로 실제 저장 버튼 라벨 반영", result.saveLabel === "저장");

// fixture상 "default" 카테고리에는 bug/feature 두 라벨이 있다 - "urgent"는 "priority"
// 카테고리 소속이라 dup 시나리오로는 못 쓴다.
await page.locator("dialog#editLabel input[name=\"name\"]").fill("feature");
await page.locator("dialog#editLabel .btnSubmit").click();
await page.waitForTimeout(80);
result = await page.evaluate(() => {
  const popover = document.querySelector("dialog#editLabel .popover .popover-content");
  return popover?.textContent;
});
check("같은 카테고리 내 중복 이름이면 실제 팝오버 에러가 뜸", result === "카테고리 default에 이미 같은 이름의 라벨이 있습니다.");
check("중복 에러 시 다이얼로그는 안 닫힘(열린 채 유지)", await page.evaluate(() => document.body.querySelector("dialog#editLabel").open === true));

// 원본 _onBlurEditColor는 blur 시점에 색이 무효해도 조용히 무시한다 - alert를 띄우는 새 라벨
// 폼의 blur 핸들러와는 다른 동작이라, 두 폼이 공유하는 YonaColorPicker에서도 이 비대칭은
// 보존해야 한다. .fill()은 keyup을 안 쏘는데 YonaColorPicker의 v-model 동기화는 keyup에서
// 일어나므로, pressSequentially로 실제 타이핑을 흉내내야 제출 시점 검증에서도 값이 반영된다.
await page.locator("dialog#editLabel input[name=\"name\"]").fill("bug");
await page.locator("dialog#editLabel .input-label-color").fill("");
await page.locator("dialog#editLabel .input-label-color").pressSequentially("not-a-color");
await page.locator("dialog#editLabel .input-label-color").dispatchEvent("blur");
await page.waitForTimeout(50);
result = await page.evaluate(() => document.querySelector("yona-dialog").shadowRoot.querySelector(".msg").textContent);
check("무효한 색을 blur해도 실제로 alert가 안 뜸(원본과 동일한 침묵)", result === "");

const beforeCount = capturedRequests.length;
await page.locator("dialog#editLabel .btnSubmit").click();
await page.waitForTimeout(80);
// 이전 중복 이름 팝오버가 이 시점까지 안 지워진 채 남아있을 수 있다(원본도 서로 다른 대상의
// 팝오버를 자동으로 안 지운다) - 그래서 첫 매치가 아니라 모든 팝오버 텍스트 중 포함 여부로 확인한다.
result = await page.evaluate(() =>
  Array.from(document.querySelectorAll("dialog#editLabel .popover .popover-content")).map((el) => el.textContent),
);
check("제출 시점에 무효한 색이면 실제 팝오버 색상 에러가 뜸", result.includes("색상 오류: not-a-color"));
check("무효한 색이면 실제 네트워크 요청이 안 나감", capturedRequests.length === beforeCount);
check("무효한 색 제출 실패 후에도 다이얼로그는 열린 채 유지", await page.evaluate(() => document.body.querySelector("dialog#editLabel").open === true));

await page.locator("dialog#editLabel .input-label-color").fill("");
await page.locator("dialog#editLabel .input-label-color").pressSequentially("#00ff00");
await page.locator("dialog#editLabel .input-label-color").dispatchEvent("blur");
await page.waitForTimeout(50);
await page.evaluate(() => {
  const dialog = Array.from(document.querySelectorAll('dialog')).find((d) => d.id === 'editLabel');
  const select = dialog.querySelector('select[name="category.id"]');
  select.tomselect.setValue("2");
});
await Promise.all([
  page.waitForLoadState("load"),
  page.locator("dialog#editLabel .btnSubmit").click(),
]);
result = capturedRequests[capturedRequests.length - 1];
check("실제 요청이 PUT 메서드로 감", result?.method?.toLowerCase() === "put");
check("실제 요청이 updateUri(/mock-label/10)로 감", result?.url.endsWith("/mock-label/10"));
check("실제 요청 바디에 바뀐 이름 반영", result?.body.includes("name=bug"));
check("실제 요청 바디에 바뀐 색상 반영", result?.body.includes(encodeURIComponent("#00ff00")) || result?.body.includes("color=%2300ff00"));
check("실제 요청 바디에 바뀐 category.id 반영", result?.body.includes("category.id=2"));
check("성공 응답 시 실제로 페이지가 리로드됨", page.url() === pageUrl);

const unexpectedErrors = errors.filter((e) => !e.includes("Failed to load resource"));
console.log("콘솔 에러:", unexpectedErrors.length === 0 ? "없음" : unexpectedErrors);

const allPass = unexpectedErrors.length === 0 && checks.every(([, pass]) => pass);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
