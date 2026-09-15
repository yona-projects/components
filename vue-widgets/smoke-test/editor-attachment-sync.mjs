// 첨부파일 위젯(yona.Attachments.js/yona.CommentAttachmentsUpdate.js) 연동 스모크 테스트 -
// element.ts의 light DOM textarea 계약을 실제 사용 패턴 그대로 재현해서 확인한다:
//   1) document.querySelector(...)로 (Shadow DOM을 모르는) 외부 코드가 실제 textarea를
//      찾을 수 있는가 (_initElement의 elTextarea 해석과 동일한 셀렉터 패턴).
//   2) 그 textarea.value를 raw로 직접 계산해 넣은 뒤(_insertLinkToTextarea와 동일한 패턴),
//   3) welTextarea.closest("yona-markdown-editor-vue").value = welTextarea.value로
//      되돌려 반영했을 때(_syncMarkdownEditor와 동일한 패턴) 에디터의 CM6 상태
//      (getValue())에 실제로 반영되는가.
// P3-50에서 발견됐던 "CM6가 나중에 자신의 예전 버퍼로 textarea를 덮어써 방금 넣은 링크가
// 사라지는" 회귀가 이 경로에서도 재현되지 않는지까지 확인한다(문서가 다시 바뀌지 않는 한
// getValue()가 그대로 유지되는지).
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`http://localhost:${port}/smoke-test/editor-element.html`);
await page.waitForFunction(() => document.querySelector("yona-markdown-editor-vue")?.shadowRoot);

// 초기 본문 텍스트(첨부 링크 삽입 전 상태)
await page.evaluate(() => {
  document.querySelector("yona-markdown-editor-vue").setValue("본문입니다.");
});

const result = await page.evaluate(() => {
  // yona.Attachments.js._initElement()의 elTextarea 해석과 동일한 패턴 - Shadow DOM을
  // 전혀 모르는 순수 document.querySelector.
  const welTextarea = document.querySelector('textarea[data-editor-mode="content-body"]');
  if (!welTextarea) {
    return { found: false };
  }

  // _insertLinkToTextarea와 동일한 패턴 - raw textarea.value를 직접 계산해서 넣는다.
  const sLink = "[testfile.txt](/files/1)";
  const nPos = welTextarea.value.length;
  welTextarea.value = welTextarea.value + " " + sLink;

  // _syncMarkdownEditor와 동일한 패턴 - closest()로 에디터를 찾아 .value로 되돌려 반영.
  const elEditor = welTextarea.closest("yona-markdown-editor-vue");
  if (!elEditor) {
    return { found: true, elEditorFound: false };
  }
  elEditor.value = welTextarea.value;

  return {
    found: true,
    elEditorFound: true,
    textareaName: welTextarea.name,
    afterSyncGetValue: elEditor.getValue(),
    textareaValueAfterSync: welTextarea.value,
  };
});

const expected = "본문입니다. [testfile.txt](/files/1)";

const checks = [
  ["document.querySelector로 light DOM textarea를 찾음", result.found === true],
  ["textarea.name이 'body'", result.textareaName === "body"],
  ["closest(\"yona-markdown-editor-vue\")로 에디터를 찾음", result.elEditorFound === true],
  ["동기화 직후 getValue()에 삽입한 링크가 반영됨", result.afterSyncGetValue === expected],
];

// P3-50 회귀 재현 방지: 약간 대기한 뒤에도(비동기로 CM6가 스스로 되돌리지 않는지) 값이
// 그대로인지 재확인.
await page.waitForTimeout(300);
const afterWait = await page.evaluate(() =>
  document.querySelector("yona-markdown-editor-vue").getValue(),
);
checks.push(["대기 후에도 값 유지됨(P3-50류 회귀 없음)", afterWait === expected]);

let allPass = errors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

await browser.close();
await server.close();

if (!allPass) {
  console.error("첨부파일 연동 스모크 테스트 실패");
  process.exit(1);
}
console.log("첨부파일 연동 스모크 테스트 통과");
