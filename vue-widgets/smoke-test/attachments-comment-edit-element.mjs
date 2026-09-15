// yona.CommentAttachmentsUpdate.js 흡수(댓글 수정 폼) 시나리오 스모크 테스트 -
// resourceType/resourceId 기반 비동기 조회 없이, 서버가 렌더링해둔 마커
// 엘리먼트만으로 기존 첨부파일이 표시되고, 삭제/새 업로드가 정상 동작하는지 확인.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/attachments-comment-edit-element.html`;

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

const capturedRequests = [];
await page.route("**/files/**", async (route, request) => {
  capturedRequests.push({ method: request.method(), url: request.url(), body: request.postData() });
  await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-attachments")?.shadowRoot);

// 1. 네트워크 조회 없이(마커만으로) 기존 첨부파일 두 개가 실제로 표시됨
let result = await page.evaluate(() => {
  const host = document.querySelector("yona-attachments");
  const items = Array.from(host.shadowRoot.querySelectorAll(".attached-file"));
  return items.map((el) => ({
    name: el.querySelector(".name")?.textContent,
    size: el.querySelector(".size")?.textContent,
    complete: el.classList.contains("complete"),
  }));
});
check("추가 네트워크 조회 없이 마커 기반 기존 첨부파일 2개가 표시됨", result.length === 2);
check("실제 파일명이 마커의 data-name에서 반영됨", result[0]?.name === "existing.png" && result[1]?.name === "doc.pdf");
check("실제 크기가 마커의 data-size(바이트)에서 사람이 읽을 수 있는 단위로 변환됨", result[0]?.size === "2.0KB");
check("기존 첨부파일은 complete 상태(진행률 바 없음)로 표시됨", result[0]?.complete === true && result[1]?.complete === true);
check("마커 데이터를 읽기 위한 별도 네트워크 요청이 전혀 없었음", capturedRequests.length === 0);

// 2. 기존 첨부파일 삭제 - 실제 DELETE 요청 + 카드 제거
await page.locator("yona-attachments").locator(".attached-file").first().locator(".btn-delete").click();
await page.waitForTimeout(80);
result = await page.evaluate(() => document.querySelector("yona-attachments").shadowRoot.querySelectorAll(".attached-file").length);
check("삭제 후 실제로 카드가 하나 줄어듦", result === 1);
check("실제 삭제 요청이 마커의 data-href(/files/10)로 감", capturedRequests[0]?.url.endsWith("/files/10"));
check("실제 삭제 요청 바디에 _method=delete 포함", capturedRequests[0]?.body === "_method=delete");

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
