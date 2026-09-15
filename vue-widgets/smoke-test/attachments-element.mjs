// defineCustomElement 빌드(dist-element/yona-attachments-element.js) 스모크 테스트 -
// toast-element.mjs/dropdown-element.mjs와 동일한 이유/방식. 실제 서버 대신
// page.route()로 /files 업로드·삭제 응답을 모킹한다(진짜 서버 왕복은 yona 실대치
// 검증에서 확인).
import { chromium } from "playwright";
import { createServer } from "vite";
import fs from "node:fs";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/attachments-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

const deleteRequests = [];
await page.route("**/files", async (route) => {
  if (route.request().method() === "POST") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "101", name: "hello.txt", url: "/files/101", mimeType: "text/plain", size: 11 }),
    });
  } else {
    await route.continue();
  }
});
await page.route("**/files/101", async (route) => {
  deleteRequests.push(route.request().postData());
  await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-attachments")?.shadowRoot);

// 1. 실제 파일 업로드(모킹된 서버 응답)
const tmpFile = "/tmp/yona-attachments-smoke-test.txt";
fs.writeFileSync(tmpFile, "hello world");
const fileInput = page.locator("yona-attachments").locator("css=input[type=file]");
await fileInput.setInputFiles(tmpFile);
await page.waitForTimeout(200);

const afterUpload = await page.evaluate(() => {
  const el = document.querySelector("yona-attachments");
  const item = el.shadowRoot.querySelector(".attached-file");
  return {
    complete: item?.classList.contains("complete"),
    name: item?.querySelector(".name")?.textContent,
    hiddenInputValue: document.querySelector('input[name="temporaryUploadFiles"]')?.value,
  };
});

// 2. 카드 클릭(삭제 버튼 아님) -> 링크가 textarea에 삽입되는지
await page.locator("yona-attachments").locator("css=.attached-file .name").click();
await page.waitForTimeout(50);
const afterInsertClick = await page.evaluate(() => document.getElementById("editor-textarea").value);

// 3. 삭제 버튼 클릭 -> 실제 삭제 요청 발생 + 카드 제거 + 링크 텍스트 제거 + hidden input 갱신
await page.locator("yona-attachments").locator("css=.btn-delete").click();
await page.waitForTimeout(200);
const afterDelete = await page.evaluate(() => ({
  itemCount: document.querySelector("yona-attachments").shadowRoot.querySelectorAll(".attached-file").length,
  textareaValue: document.getElementById("editor-textarea").value,
  hiddenInputValue: document.querySelector('input[name="temporaryUploadFiles"]')?.value,
}));

// 4. 붙여넣기 회귀 방지 테스트: 원본은 붙여넣기가 업로드 컨테이너가 아니라 실제 마크다운
//    에디터의 textarea에 포커스가 있을 때 동작한다 - 컨테이너 자신에만 리스너를 걸면
//    (실제로 겪은 버그) 재현되지 않는다. 여기서는 textarea에 직접 합성 ClipboardEvent를
//    디스패치해 정확히 그 대상에 리스너가 붙어있는지 확인한다.
await page.route("**/files", async (route) => {
  if (route.request().method() === "POST") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "202", name: "pasted.png", url: "/files/202", mimeType: "image/png", size: 5 }),
    });
  } else {
    await route.continue();
  }
});
const pasteResult = await page.evaluate(async () => {
  const textarea = document.getElementById("editor-textarea");
  textarea.focus();
  const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "image/png" });
  const file = new File([blob], "clipboard.png", { type: "image/png" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  const evt = new ClipboardEvent("paste", { clipboardData: dataTransfer, bubbles: true, cancelable: true });
  textarea.dispatchEvent(evt);
  return { immediateValue: textarea.value };
});
await page.waitForTimeout(200);
const afterPaste = await page.evaluate(() => ({
  textareaValue: document.getElementById("editor-textarea").value,
  cardCount: document.querySelector("yona-attachments").shadowRoot.querySelectorAll(".attached-file").length,
}));

const checks = [
  ["업로드 후 카드가 complete 상태", afterUpload.complete === true],
  ["업로드 후 파일명 표시", afterUpload.name === "hello.txt"],
  ["업로드 후 hidden input에 실제 id 반영", afterUpload.hiddenInputValue === "101"],
  ["카드 클릭 시 실제 마크다운 링크가 textarea에 삽입됨", afterInsertClick === "[hello.txt](/files/101) "],
  ["삭제 버튼 클릭 시 실제 삭제 요청 발생", deleteRequests.length === 1 && deleteRequests[0]?.includes("_method=delete")],
  ["삭제 후 카드 제거", afterDelete.itemCount === 0],
  ["삭제 후 textarea에서 링크 텍스트 제거", afterDelete.textareaValue === ""],
  ["삭제 후 hidden input 비워짐", afterDelete.hiddenInputValue === ""],
  ["textarea에 붙여넣기 시 실제 리스너가 붙어있어 카드가 생성됨(회귀 방지)", afterPaste.cardCount === 1],
  ["붙여넣기 완료 후 실제 이미지 링크로 치환됨", afterPaste.textareaValue === "![pasted.png](/files/202) "],
];

let allPass = errors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

await browser.close();
await server.close();
fs.rmSync(tmpFile, { force: true });

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
