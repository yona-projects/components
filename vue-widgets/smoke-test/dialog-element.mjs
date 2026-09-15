// defineCustomElement 빌드(dist-element/yona-dialog-element.js) 스모크 테스트 -
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
const pageUrl = `http://localhost:${port}/smoke-test/dialog-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-dialog")?.shadowRoot);

// 1. 기본(alert) 형태: 버튼 지정 없이 show() -> 기본 확인 버튼 1개
const afterAlertShow = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  el.show("첫 번째 메시지\n두 번째 줄", "설명입니다");
  const dialog = el.shadowRoot.querySelector("dialog");
  const buttons = Array.from(el.querySelectorAll('[slot="buttons"]'));
  return {
    open: dialog.open,
    msgHtml: el.shadowRoot.querySelector(".msg").innerHTML,
    descText: el.shadowRoot.querySelector(".desc").textContent,
    buttonCount: buttons.length,
    buttonClass: buttons[0]?.className,
  };
});

// 2. 기본 버튼 클릭 -> 닫히고 메시지가 비워지는지
await page.locator("yona-dialog").locator('css=[slot="buttons"]').first().click();
await page.waitForTimeout(50);
const afterDefaultClick = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  const dialog = el.shadowRoot.querySelector("dialog");
  return {
    open: dialog.open,
    msgHtml: el.shadowRoot.querySelector(".msg").innerHTML,
    buttonCount: el.querySelectorAll('[slot="buttons"]').length,
  };
});

// 3. confirm 형태: 커스텀 버튼 2개 + fOnClickButton 콜백
const confirmSetup = await page.evaluate(() => {
  window.__clicked = [];
  const el = document.querySelector("yona-dialog");
  el.show("정말 삭제할까요?", "", {
    aButtonLabels: ["취소", "삭제"],
    aButtonStyles: ["ybtn-default", "ybtn-danger"],
    fOnClickButton: (arg) => { window.__clicked.push(arg.nButtonIndex); },
  });
  const buttons = Array.from(el.querySelectorAll('[slot="buttons"]'));
  return { count: buttons.length, classes: buttons.map((b) => b.className), labels: buttons.map((b) => b.textContent) };
});

await page.locator("yona-dialog").locator('css=[slot="buttons"]').nth(1).click();
await page.waitForTimeout(50);
const afterConfirmClick = await page.evaluate(() => ({
  clicked: window.__clicked,
  open: document.querySelector("yona-dialog").shadowRoot.querySelector("dialog").open,
}));

// 4. fOnClickButton이 false를 반환하면 닫히지 않아야 함
const cancelResult = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  el.show("취소돼야 함", "", {
    aButtonLabels: ["확인"],
    fOnClickButton: () => false,
  });
  return true;
});
await page.locator("yona-dialog").locator('css=[slot="buttons"]').first().click();
await page.waitForTimeout(50);
const stillOpen = await page.evaluate(() => document.querySelector("yona-dialog").shadowRoot.querySelector("dialog").open);

// 5. X 닫기 버튼으로 닫히는지
await page.locator("yona-dialog").locator("css=.btn-dismiss button").click();
await page.waitForTimeout(50);
const afterXClose = await page.evaluate(() => document.querySelector("yona-dialog").shadowRoot.querySelector("dialog").open);

// 6. 배경(백드롭) 클릭으로 닫히는지 - dialog 자신에게 클릭 디스패치(백드롭 클릭의 네이티브 동작 재현)
await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  el.show("배경 클릭 테스트");
});
await page.waitForTimeout(50);
const afterBackdropClick = await page.evaluate(() => {
  const el = document.querySelector("yona-dialog");
  const dialog = el.shadowRoot.querySelector("dialog");
  dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return dialog.open;
});

const checks = [
  ["기본 alert: dialog가 open 상태", afterAlertShow.open === true],
  ["기본 alert: 메시지 개행이 <br>로 변환", afterAlertShow.msgHtml === "첫 번째 메시지<br>두 번째 줄"],
  ["기본 alert: 설명 텍스트 반영", afterAlertShow.descText === "설명입니다"],
  ["기본 alert: 버튼 1개(기본 확인 버튼)", afterAlertShow.buttonCount === 1],
  ["기본 alert: 버튼 클래스 ybtn ybtn-info", afterAlertShow.buttonClass === "ybtn ybtn-info"],
  ["기본 버튼 클릭 후 닫힘", afterDefaultClick.open === false],
  ["닫힌 후 메시지 비워짐", afterDefaultClick.msgHtml === ""],
  // 원본도 hide() 시 버튼을 지우지 않는다(다음 show()가 덮어쓸 때까지 DOM에 남아있음 -
  // yona.ui.Dialog.js의 _onHiddenDialog는 .msg만 비운다) - 그대로 재현.
  ["닫힌 후에도 직전 버튼은 남아있음(원본과 동일)", afterDefaultClick.buttonCount === 1],
  ["confirm: 커스텀 버튼 2개", confirmSetup.count === 2],
  ["confirm: 버튼 클래스 정확", confirmSetup.classes[0] === "ybtn ybtn-default" && confirmSetup.classes[1] === "ybtn ybtn-danger"],
  ["confirm: 버튼 라벨 정확", confirmSetup.labels[0] === "취소" && confirmSetup.labels[1] === "삭제"],
  ["confirm: 두 번째(삭제) 클릭 시 nButtonIndex=1 콜백", JSON.stringify(afterConfirmClick.clicked) === "[1]"],
  ["confirm: 클릭 후 닫힘", afterConfirmClick.open === false],
  ["fOnClickButton이 false 반환 시 안 닫힘", stillOpen === true],
  ["X 닫기 버튼으로 닫힘", afterXClose === false],
  ["배경 클릭으로 닫힘", afterBackdropClick === false],
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
