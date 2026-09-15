// defineCustomElement 빌드(dist-element/yona-review-form-element.js) 스모크 테스트 -
// toast-element.mjs/dropdown-element.mjs와 동일한 이유/방식. yona.code.Diff.js(861줄,
// 실제 diff 뷰 렌더링)는 이 스모크 테스트의 대상이 아니다 - 원본 CodeCommentBox.js가
// 받는 정확한 계약(data-line을 가진 <tr>, data-thread-id를 가진 버튼)만 재현한
// 합성 마크업으로 이 위젯 자신의 동작(Teleport 재배치/새 인스턴스 강제/hidden
// 필드 계산/show-hide-toggle API)을 검증한다.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/review-form-element.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-review-form")?.shadowRoot);

// 1. 새 댓글(data-line을 가진 tr) - show() 호출 시 실제로 새 tr.comment-form을 만들고
//    그 안으로 실제 라이트 DOM에 텔레포트되는지, blockInfo가 hidden 필드로 정확히
//    변환되는지 확인.
// 주의: show()는 동기 함수지만 실제 텔레포트된 DOM 반영은 Vue의 반응형 렌더 사이클
// (마이크로태스크)을 거친다 - 호출 직후 곧바로 확인하면 아직 반영 전이라 false negative가
// 난다(실측 확인). 호출과 확인 사이에 한 틱 기다린다.
await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  const target = document.getElementById("line5");
  el.show(target, {
    sPlacement: "bottom",
    htBlockInfo: {
      nStartLine: 3,
      sStartSide: "A",
      nEndLine: 5,
      sEndSide: "B",
      bIsReversed: false, // 이 필드는 변환에서 제외되어야 함(원본 aBlockWords)
    },
  });
});
await page.waitForTimeout(50);
const afterShowNew = await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  const target = document.getElementById("line5");
  const newTr = target.nextElementSibling;
  const reviewForm = document.getElementById("review-form");
  const hiddenInputs = reviewForm ? Array.from(reviewForm.querySelectorAll('input[type="hidden"]')).map((i) => [i.name, i.value]) : [];
  return {
    createdNewTr: newTr && newTr.classList.contains("comment-form"),
    reviewFormInsideNewTr: newTr ? newTr.contains(reviewForm) : false,
    arrowClass: reviewForm ? reviewForm.className : null,
    hiddenInputs,
    hasEditor: !!reviewForm?.querySelector("yona-markdown-editor-vue"),
    hasAttachments: !!reviewForm?.querySelector("yona-attachments"),
    avatarSrc: reviewForm?.querySelector(".author-info img")?.getAttribute("src"),
    isVisible: el.isVisible(),
  };
});

// 2. 실제 에디터에 타이핑 후 hide() -> 실제로 임시 tr이 제거되는지
await page.locator("yona-markdown-editor-vue .cm-content").click();
await page.keyboard.type("첫 번째 임시 댓글 초안");
await page.waitForTimeout(100);
const afterTypeThenHide = await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  const trBefore = document.getElementById("line5").nextElementSibling;
  const stillHasCommentFormTr = trBefore && trBefore.classList.contains("comment-form");
  el.hide();
  const trAfter = document.getElementById("line5").nextElementSibling;
  return {
    hadTempTrBeforeHide: stillHasCommentFormTr,
    tempTrRemovedAfterHide: !trAfter || !trAfter.classList.contains("comment-form"),
    isVisibleAfterHide: el.isVisible(),
  };
});

// 3. 답글(data-thread-id를 가진 버튼) - 기존 .comment-thread-wrap의 .write-comment-form
//    으로 실제 텔레포트되는지, 그 컨테이너 자체는 제거되지 않는지, thread.id 필드가
//    정확히 반영되는지, 매번 완전히 새 에디터 인스턴스라 이전 초안이 안 남는지 확인.
await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  const btn = document.getElementById("reply-btn");
  el.show(btn, { sPlacement: "top" });
});
await page.waitForTimeout(50);
const afterShowReply = await page.evaluate(() => {
  const wrap = document.getElementById("thread-1");
  const writeForm = wrap.querySelector(".write-comment-form");
  const reviewForm = document.getElementById("review-form");
  const hiddenInputs = reviewForm ? Array.from(reviewForm.querySelectorAll('input[type="hidden"]')).map((i) => [i.name, i.value]) : [];
  return {
    teleportedIntoThreadWriteForm: writeForm ? writeForm.contains(reviewForm) : false,
    arrowClass: reviewForm ? reviewForm.className : null,
    hiddenInputs,
  };
});
const editorEmptyOnReopen = await page.evaluate(() => {
  // 주의: <yona-markdown-editor-vue>는 Teleport로 <yona-review-form> 밖(목적지의 진짜
  // 라이트 DOM)으로 옮겨지므로 "yona-review-form yona-markdown-editor-vue"로는 못 찾는다 -
  // #review-form(텔레포트된 래퍼 자신) 기준으로 찾아야 한다.
  const editor = document.querySelector("#review-form yona-markdown-editor-vue");
  return editor.value;
});

// 4. hide() 후 스레드 컨테이너 자체는 그대로 남아있는지(임시 tr과 달리 제거되면 안 됨)
const afterHideReply = await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  el.hide();
  return { threadWrapStillExists: !!document.getElementById("thread-1") };
});

// 5. toggle()로 열림/닫힘 전환
const toggleResult = await page.evaluate(() => {
  const el = document.querySelector("yona-review-form");
  const target = document.getElementById("line5");
  el.toggle(target, { sPlacement: "bottom" });
  const firstToggle = el.isVisible();
  el.toggle(target, { sPlacement: "bottom" });
  const secondToggle = el.isVisible();
  return { firstToggle, secondToggle };
});

// 6. 닫기(X) 버튼 실제 클릭으로 hide()가 호출되는지
await page.evaluate(() => {
  document.querySelector("yona-review-form").show(document.getElementById("line5"), { sPlacement: "bottom" });
});
await page.waitForTimeout(50);
await page.locator('#review-form [data-toggle="close"]').first().click();
await page.waitForTimeout(50);
const afterCloseButtonClick = await page.evaluate(() => document.querySelector("yona-review-form").isVisible());

const checks = [
  ["새 댓글: 실제로 새 tr.comment-form 생성", afterShowNew.createdNewTr === true],
  ["새 댓글: review-form이 실제로 그 tr 안에 텔레포트됨(라이트 DOM)", afterShowNew.reviewFormInsideNewTr === true],
  ["새 댓글: bottom 배치 시 화살표가 위쪽(arrow-top)", afterShowNew.arrowClass?.includes("arrow-top")],
  // hiddenInputs에는 review-form 자신의 필드 외에 중첩된 <yona-attachments>가 스스로
  // 만드는 temporaryUploadFiles도 함께 잡힌다(진짜 라이트 DOM 자식이라 정상 - Dialog/
  // Dropdown 검증 때와 동일한 이유) - 정확한 부분집합 포함 여부로 확인한다.
  ["새 댓글: blockInfo가 hidden 필드로 정확히 변환(startLine/startSide/endLine/endSide)",
    [["endLine", "5"], ["endSide", "B"], ["startLine", "3"], ["startSide", "A"]]
      .every(([n, v]) => afterShowNew.hiddenInputs.some(([an, av]) => an === n && av === v))],
  ["새 댓글: bIsReversed 등 제외 필드는 hidden으로 안 남음", !afterShowNew.hiddenInputs.some(([name]) => name === "isReversed")],
  ["실제 마크다운 에디터 자식으로 포함됨", afterShowNew.hasEditor === true],
  ["실제 첨부파일 위젯 자식으로 포함됨", afterShowNew.hasAttachments === true],
  ["아바타 이미지가 configure() 값으로 반영됨", afterShowNew.avatarSrc === "/images/avatar.png"],
  ["show() 직후 isVisible() true", afterShowNew.isVisible === true],
  ["hide() 전에는 임시 tr이 존재", afterTypeThenHide.hadTempTrBeforeHide === true],
  ["hide() 후 임시 tr이 실제로 제거됨", afterTypeThenHide.tempTrRemovedAfterHide === true],
  ["hide() 후 isVisible() false", afterTypeThenHide.isVisibleAfterHide === false],
  ["답글: 기존 .write-comment-form 안으로 실제 텔레포트됨", afterShowReply.teleportedIntoThreadWriteForm === true],
  ["답글: top 배치 시 화살표가 아래쪽(arrow-bottom)", afterShowReply.arrowClass?.includes("arrow-bottom")],
  ["답글: thread.id가 hidden 필드로 정확히 반영", afterShowReply.hiddenInputs.some(([n, v]) => n === "thread.id" && v === "42")],
  ["매 show()마다 완전히 새 에디터라 이전 초안이 안 남음", editorEmptyOnReopen === ""],
  ["답글 hide() 후에도 스레드 컨테이너 자체는 유지됨", afterHideReply.threadWrapStillExists === true],
  ["toggle(): 첫 호출로 열림", toggleResult.firstToggle === true],
  ["toggle(): 두 번째 호출로 닫힘", toggleResult.secondToggle === false],
  ["닫기(X) 버튼 클릭으로 실제 hide() 호출됨", afterCloseButtonClick === false],
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
