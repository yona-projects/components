// defineCustomElement 빌드(dist-element/yona-help-markdown-element.js) 스모크 테스트 -
// editor2/smoke-test/element.mjs와 동일한 이유. yona 쪽에 실제로 벤더링하는 형태(Vue 앱
// 부트스트랩 없이 태그 하나로 정적 HTML에 꽂기)와 동일한 방식으로 확인한다.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.join(__dirname, "element.html");

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-help-markdown")?.shadowRoot);

function activeCount() {
  return page.evaluate(() =>
    document.querySelector("yona-help-markdown").shadowRoot.querySelectorAll(".markdown-help-item.active").length,
  );
}

const hasShadow = await page.evaluate(() => !!document.querySelector("yona-help-markdown").shadowRoot);

// 클릭과 그 결과 확인을 별도 evaluate 호출로 나눈다 - Vue의 리렌더링은 nextTick(마이크로태스크)
// 이후에 반영되므로, 같은 동기 evaluate 블록 안에서 클릭 직후 바로 읽으면 아직 갱신 전 DOM을
// 보게 된다.
await page.evaluate(() => {
  document.querySelector("yona-help-markdown").shadowRoot.querySelector(".help-nav").click();
});
const opened = (await activeCount()) === 1;

await page.evaluate(() => {
  document.querySelector("yona-help-markdown").shadowRoot.querySelector(".help-nav").click();
});
const closed = (await activeCount()) === 0;

const checks = [
  ["shadowRoot attach", hasShadow === true],
  ["탭 클릭 시 콘텐츠 열림", opened],
  ["재클릭 시 콘텐츠 닫힘", closed],
];

// markdownImages 예시가 실제 yona 정적 에셋(/assets/images/ico-like-small.png)을 가리키는데
// (원본과 동일 - examples.ts 주석 참고), 이 격리된 file:// 스모크 테스트 환경에는 그 경로가
// 없어 리소스 로드 실패 콘솔 에러가 난다 - yona에 실제로 vendoring됐을 때만 정상 로드되는,
// 알려진/의도된 제약이라 이 특정 메시지만 걸러낸다.
const unexpectedErrors = errors.filter((e) => !e.includes("Failed to load resource"));

let allPass = unexpectedErrors.length === 0;
for (const [label, pass] of checks) {
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}`);
}
console.log("콘솔 에러(이미지 404 제외):", unexpectedErrors.length === 0 ? "없음" : unexpectedErrors);

await browser.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
