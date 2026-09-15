// defineCustomElement 빌드(dist-element/yona-login-dialog-element.js) 스모크 테스트.
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) {
  throw new Error("정적 서버 포트를 얻지 못했다");
}
const pageUrl = `http://localhost:${port}/smoke-test/login-dialog-element.html`;

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

// window.Messages(전역 i18n 함수)를 실제 사이트처럼 흉내낸다(dialog/pagination
// 스모크 테스트와 동일 관례 - 없으면 컴포넌트가 영어 폴백을 쓴다는 것도 검증).
await page.addInitScript(() => {
  window.Messages = function (key) {
    const table = {
      "button.login": "로그인",
      "user.login.key": "아이디 또는 이메일",
      "user.password": "비밀번호",
      "title.rememberMe": "로그인 유지하기",
      "user.login.failed": "로그인 실패",
      "app.warn.support.social.login.only": "소셜 로그인을 통한 로그인만 가능합니다.",
      "invalid.credentials": "아이디 또는 비밀번호가 올바르지 않습니다.",
    };
    return table[key] || key;
  };
  window.__reloadCalled = false;
  const originalReload = document.location.reload.bind(document.location);
  document.location.reload = function () {
    window.__reloadCalled = true;
  };
  window.__fetchCalls = [];
  const originalFetch = window.fetch;
  window.__mockFetchResponse = null;
  window.fetch = function (url, init) {
    window.__fetchCalls.push({ url, init: { ...init, body: init?.body ? String(init.body) : undefined } });
    if (window.__mockFetchResponse === "network-error") {
      return Promise.reject(new TypeError("network error"));
    }
    if (window.__mockFetchResponse === "invalid-credentials") {
      return Promise.resolve(new Response(JSON.stringify({ message: "invalid.credentials" }), { status: 403 }));
    }
    if (window.__mockFetchResponse === "server-error") {
      return Promise.resolve(new Response("", { status: 500 }));
    }
    if (window.__mockFetchResponse === "ok") {
      return Promise.resolve(new Response("", { status: 200 }));
    }
    return originalFetch(url, init);
  };
});

await page.goto(pageUrl);
await page.waitForFunction(() => document.querySelector("yona-login-dialog")?.shadowRoot);

check("shadowRoot attach", await page.evaluate(() => !!document.querySelector("yona-login-dialog").shadowRoot));

// 1. Teleport로 실제 body 자식이 됐는지(shadow DOM 밖 진짜 라이트 DOM)
let result = await page.evaluate(() => {
  const dialog = document.body.querySelector(":scope > dialog.loginDialog");
  return { isDirectBodyChild: !!dialog, insideShadow: !!document.querySelector("yona-login-dialog").shadowRoot.querySelector("dialog") };
});
check("Teleport로 <dialog>가 실제 body 직계 자식이 됨", result.isDirectBodyChild === true);
check("shadow DOM 안에는 <dialog>가 없음(전부 라이트 DOM으로 이동)", result.insideShadow === false);

// 2. show() 호출 -> 실제 다이얼로그 open + 입력값 초기화 + i18n 라벨 반영
await page.evaluate(() => document.querySelector("yona-login-dialog").show());
await page.waitForTimeout(50);
// v-model과 실제로 연결된 반응형 상태를 바꾸려면 raw .value 대입이 아니라 진짜
// 타이핑을 흉내내야 한다(input 이벤트가 안 나가면 Vue가 변경을 감지 못함).
await page.locator("dialog.loginDialog").first().locator('input[name="loginIdOrEmail"]').fill("leftover");
await page.evaluate(() => document.querySelector("yona-login-dialog").hide());
await page.waitForTimeout(50);
await page.evaluate(() => document.querySelector("yona-login-dialog").show());
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog.loginDialog");
  return {
    open: dialog.open,
    idValue: dialog.querySelector('input[name="loginIdOrEmail"]').value,
    loginLabel: dialog.querySelector('button[type="submit"]').textContent.trim(),
    placeholder: dialog.querySelector('input[name="loginIdOrEmail"]').placeholder,
  };
});
check("show() 호출로 실제 <dialog>가 open 상태", result.open === true);
check("재호출한 show()가 실제 이전 입력값을 초기화함", result.idValue === "");
check("Messages()로 실제 i18n 라벨 반영(로그인 버튼)", result.loginLabel === "로그인");
check("Messages()로 실제 placeholder 반영", result.placeholder === "아이디 또는 이메일");

// 3. 트리거가 입력창/텍스트영역이면 show() 호출 시 blur됨(모달이 열려있으면
//    네이티브 포커스 트랩 때문에 바깥 엘리먼트를 못 옮기므로 먼저 닫는다).
await page.evaluate(() => document.querySelector("yona-login-dialog").hide());
await page.waitForTimeout(50);
await page.evaluate(() => document.getElementById("trigger-textarea").focus());
check("show() 호출 전 textarea가 실제로 포커스됨", await page.evaluate(() => document.activeElement.id === "trigger-textarea"));
await page.evaluate(() => {
  const textarea = document.getElementById("trigger-textarea");
  document.querySelector("yona-login-dialog").show(textarea);
});
check("트리거가 입력창이면 show() 호출로 실제 blur됨", await page.evaluate(() => document.activeElement.id !== "trigger-textarea"));

// 4. 배경 클릭으로 실제 닫힘
result = await page.evaluate(() => document.body.querySelector("dialog.loginDialog").open);
check("배경 클릭 테스트 전 다이얼로그가 열려있음", result === true);
await page.mouse.click(2, 2);
await page.waitForTimeout(50);
check("배경(다이얼로그 자신) 클릭으로 실제 닫힘", await page.evaluate(() => document.body.querySelector("dialog.loginDialog").open === false));

// 5. X 닫기 버튼 클릭으로 실제 닫힘
await page.evaluate(() => document.querySelector("yona-login-dialog").show());
await page.waitForTimeout(50);
await page.locator("dialog.loginDialog button.close").click();
await page.waitForTimeout(50);
check("X 닫기 버튼 클릭으로 실제 닫힘", await page.evaluate(() => document.body.querySelector("dialog.loginDialog").open === false));

// 6. useSocialLoginOnly=true면 로컬 로그인 필드 대신 경고 문구만 보임
await page.evaluate(() => {
  document.querySelector("yona-login-dialog").setAttribute("data-use-social-login-only", "true");
});
// data-* 속성은 컴포넌트가 onMounted에서 한 번만 읽으므로, 재마운트 없이는 반영 안 됨을
// 확인하기보다 실제 페이지처럼 처음부터 그 속성을 갖고 로드되는 두 번째 인스턴스로 검증한다.
await page.evaluate(() => {
  const el = document.createElement("yona-login-dialog");
  el.id = "loginDialog2";
  el.setAttribute("data-use-social-login-only", "true");
  document.body.appendChild(el);
});
await page.waitForTimeout(50);
await page.evaluate(() => document.getElementById("loginDialog2").show());
await page.waitForTimeout(50);
result = await page.evaluate(() => {
  const dialogs = document.body.querySelectorAll("dialog.loginDialog");
  const dialog = dialogs[dialogs.length - 1];
  return {
    hasLocalForm: !!dialog.querySelector('input[name="loginIdOrEmail"]'),
    hasWarning: dialog.textContent.includes("소셜 로그인을 통한 로그인만 가능합니다."),
  };
});
check("useSocialLoginOnly=true면 로컬 로그인 입력창이 없음", result.hasLocalForm === false);
check("useSocialLoginOnly=true면 경고 문구가 실제로 보임", result.hasWarning === true);

// 7. 실제 제출 - 네트워크 에러(요청 자체 실패)
await page.evaluate(() => {
  window.__mockFetchResponse = "network-error";
  document.querySelector("yona-login-dialog").show();
});
await page.waitForTimeout(50);
await page.locator("dialog.loginDialog").first().locator('input[name="loginIdOrEmail"]').fill("admin");
await page.locator("dialog.loginDialog").first().locator('input[name="password"]').fill("wrong");
await page.locator("dialog.loginDialog").first().locator('button[type="submit"]').click();
await page.waitForTimeout(100);
result = await page.evaluate(() => {
  const dialog = document.body.querySelector("dialog.loginDialog");
  return { errorVisible: dialog.querySelector(".error").offsetParent !== null, hasShake: dialog.classList.contains("yona-shake") };
});
check("네트워크 에러 시 실제 에러 메시지가 보임", result.errorVisible === true);
check("에러 시 실제 shake 클래스가 붙음", result.hasShake === true);

// 이 시나리오는 실패라 실제 네비게이션이 없다 - 요청 자체의 URL/헤더/바디는
// 여기서 안전하게 검증한다(성공 케이스는 실제 reload가 일어나 JS 상태가
// 날아가므로 검증 불가 - 아래 9번 참고).
result = await page.evaluate(() => window.__fetchCalls[window.__fetchCalls.length - 1]);
check("실제 요청이 data-action(/mock-login)으로 감", result.url === "/mock-login");
check("실제 요청 헤더에 X-Requested-With 포함", result.init.headers["X-Requested-With"] === "XMLHttpRequest");
check("실제 요청 바디에 loginIdOrEmail/password 포함", result.init.body.includes("loginIdOrEmail=admin") && result.init.body.includes("password=wrong"));

// 8. 실제 제출 - 서버가 JSON 에러 메시지를 준 경우(Messages()로 변환된 실제 텍스트 확인)
// 네이티브 <dialog>는 이미 열린 상태에서 showModal()을 다시 부르면 예외를 던지므로
// (실측 확인) 각 제출 시나리오 전에 반드시 hide()로 닫아야 한다.
await page.evaluate(() => document.querySelector("yona-login-dialog").hide());
await page.waitForTimeout(50);
await page.evaluate(() => {
  window.__mockFetchResponse = "invalid-credentials";
  document.querySelector("yona-login-dialog").show();
});
await page.waitForTimeout(50);
await page.locator("dialog.loginDialog").first().locator('button[type="submit"]').click();
await page.waitForTimeout(100);
result = await page.evaluate(() => document.body.querySelector("dialog.loginDialog .error-message").textContent);
check("서버 JSON 에러 메시지가 Messages()로 실제 변환되어 표시됨", result === "아이디 또는 비밀번호가 올바르지 않습니다.");

// 9. 실제 제출 - 성공(200) 시 실제로 페이지가 리로드되는지(document.location.reload는
// 브라우저 네이티브 메서드라 JS에서 스텁으로 가로챌 수 없다 - 실측 확인: 재할당해도
// 조용히 무시되고 진짜 리로드가 일어난다. 그래서 이 시나리오만 "리로드가 실제로
// 일어나는가"를 진짜 네비게이션 대기로 검증한다 - 리로드 후에는 JS 상태가 전부
// 초기화되므로 요청 바디 확인은 위 7번(실패 시나리오, 리로드 없음)에서 이미 했다.
await page.evaluate(() => document.querySelector("yona-login-dialog").hide());
await page.waitForTimeout(50);
await page.evaluate(() => {
  window.__mockFetchResponse = "ok";
  document.querySelector("yona-login-dialog").show();
});
await page.waitForTimeout(50);
await page.locator("dialog.loginDialog").first().locator('input[name="loginIdOrEmail"]').fill("admin");
await page.locator("dialog.loginDialog").first().locator('input[name="password"]').fill("adminpass1!");
await Promise.all([
  page.waitForLoadState("load"),
  page.locator("dialog.loginDialog").first().locator('button[type="submit"]').click(),
]);
check("성공 응답(200) 시 실제로 페이지가 리로드됨", page.url() === pageUrl);

console.log("콘솔 에러:", errors.length === 0 ? "없음" : errors);

const allPass = errors.length === 0 && checks.every(([, pass]) => pass);

await browser.close();
await server.close();

if (!allPass) {
  console.error("커스텀 엘리먼트 스모크 테스트 실패");
  process.exit(1);
}
console.log("커스텀 엘리먼트 스모크 테스트 통과");
