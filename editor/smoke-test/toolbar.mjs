// 3단계(툴바 + CSS 테마 계약) 스모크 테스트.
// 확인 항목: 9개 툴바 커맨드가 실제 클릭+키보드 선택(사용자 상호작용과 최대한 가깝게)으로
// 기대한 마크다운 텍스트를 만들어내는지, preview placeholder가 문서를 건드리지 않는지, 콘솔
// 에러가 없는지. 이 저장소는 yona 본체와 완전히 분리돼 있으므로(README 참고) 실제 yona 서버
// 없이 격리된 정적 HTML(toolbar.html)만으로 검증한다 - yobicon 아이콘 폰트(@font-face)는 yona
// 쪽에만 전역 등록되어 있어 이 페이지에서는 아이콘이 tofu 박스로 보일 수 있지만(정상), 그건
// 이 스모크 테스트의 검증 범위가 아니다(아이콘 렌더링은 yona 실서버 기준 Playwright 실증에서
// 확인 - P3-46 티켓 문서 참고).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.join(__dirname, "toolbar.html");

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(pageUrl);

async function runCase(initialText, buttonPart) {
  // 6단계: jQuery data(...) shim이 걷어내지고 컴포넌트 자신의 .value
  // getter/setter로 대체됐다 - 이 스모크 테스트도 그 네이티브 프로퍼티를 직접 쓴다.
  await page.evaluate((initialText) => {
    const el = document.querySelector("yona-markdown-editor");
    el.value = initialText;
  }, initialText);

  const cmContent = page.locator("yona-markdown-editor .cm-content");
  await cmContent.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.locator(`yona-markdown-editor [part~="${buttonPart}"]`).click();

  return page.evaluate(() => document.querySelector("yona-markdown-editor").value);
}

const cases = [
  ["bold", "hello", "button-bold", "**hello**"],
  ["italic", "hello", "button-italic", "*hello*"],
  ["heading", "Title", "button-heading", "# Title"],
  ["quote", "hello", "button-quote", "> hello"],
  ["checklist", "buy milk", "button-checklist", "- [ ] buy milk"],
  ["unordered-list", "item", "button-unordered-list", "* item"],
  ["ordered-list", "item", "button-ordered-list", "1. item"],
  ["link", "click here", "button-link", "[click here](https://)"],
  ["image", "alt text", "button-image", "![alt text](https://)"],
];

let allPass = true;
for (const [name, initial, part, expected] of cases) {
  const result = await runCase(initial, part);
  const pass = result === expected;
  allPass = allPass && pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${name}: got=${JSON.stringify(result)} expected=${JSON.stringify(expected)}`);
}

const previewResult = await runCase("unchanged", "button-preview");
const previewPass = previewResult === "unchanged";
allPass = allPass && previewPass;
console.log(`${previewPass ? "OK  " : "FAIL"} preview placeholder(문서 변경 없어야 함): got=${JSON.stringify(previewResult)}`);

console.log("콘솔 에러:", consoleErrors.length === 0 ? "없음" : consoleErrors);
await browser.close();

if (!allPass || consoleErrors.length > 0) {
  console.error("3단계 툴바 스모크 테스트 실패");
  process.exit(1);
}
console.log("3단계 툴바 스모크 테스트 통과");
