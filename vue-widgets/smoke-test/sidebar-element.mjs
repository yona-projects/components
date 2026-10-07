import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const project = (id, name, owner, favorite = false, overview = null) => ({ id, name, owner, overview, href: `/${owner}/${name}`, favorite });
const MENU = {
  loginId: "me",
  personal: [project(10, "mine", "me", true, "내 프로젝트"), project(11, "mine2", "me", false)],
  favoriteOrganizations: [{ id: 20, name: "acme", favorite: true, projects: [project(12, "inacme", "acme", true)] }],
  organizations: [{ id: 21, name: "beta", favorite: false, projects: [project(13, "inbeta", "beta", false)] }],
  favoriteProjects: [project(14, "loose", "someone", true)],
  recentlyVisited: [project(10, "mine", "me", true), project(15, "recent", "someone", false)],
  createdByMe: [project(10, "mine", "me", true), project(11, "mine2", "me", false), project(16, "<img src=x onerror=window.__xss=1>", "me", false)],
  watching: [],
  joinmember: [project(12, "inacme", "acme", true)],
  visitedIssues: [],
};

const server = await createServer({ root: "..", server: { port: 0 }, logLevel: "warn" });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === "object" && address !== null ? address.port : null;
if (!port) throw new Error("정적 서버 포트를 얻지 못했다");
const pageUrl = `http://localhost:${port}/smoke-test/sidebar-element.html`;

const browser = await chromium.launch();
const failures = [];
let apiCalls = 0;
let apiMode = "ok";
let apiDelayMs = 0;
let apiBody = null;
const loginPageUrl = `http://localhost:${port}/smoke-test/sidebar-element-login.html`;
const favoritePosts = [];

async function newPage(storage = {}, extraInit = null, extraArg = undefined) {
  const context = await browser.newContext();
  if (extraInit) await context.addInitScript(extraInit, extraArg);
  await context.addInitScript((initial) => {
    if (!sessionStorage.getItem("__init")) {
      sessionStorage.setItem("__init", "1");
      for (const [k, v] of Object.entries(initial)) localStorage.setItem(k, v);
    }
  }, storage);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/-_-api/v1/usermenu", async (route) => {
    apiCalls += 1;
    if (apiDelayMs) await new Promise((r) => setTimeout(r, apiDelayMs));
    if (apiMode === "fail") return route.fulfill({ status: 500, body: "boom" });
    return route.fulfill({ json: apiBody ?? MENU });
  });
  await page.route("**/-_-api/v1/favoriteProjects/*", (route) => {
    favoritePosts.push(route.request().url().split("/").pop());
    return route.fulfill({ json: { projectId: "10", favored: false } });
  });
  return { page, errors, context };
}

async function check(name, fn) {
  try {
    await fn();
    console.log("  ok  -", name);
  } catch (e) {
    failures.push(name);
    console.log("  FAIL-", name, "\n       ", String(e.message).split("\n")[0]);
  }
}

const ready = (page) => page.waitForFunction(() => document.querySelector("yona-sidebar")?.shadowRoot?.querySelector(".sidebar"));
const q = (page, sel) => page.evaluate((s) => document.querySelector("yona-sidebar").shadowRoot.querySelectorAll(s).length, sel);
const text = (page, sel) => page.evaluate((s) => [...document.querySelector("yona-sidebar").shadowRoot.querySelectorAll(s)].map((e) => e.textContent.trim()), sel);

// ---- 시나리오 1: 렌더링/링크/검색/별/XSS (열림 상태로 시작)
{
  const { page, errors, context } = await newPage({ yonaLeftSidebarOpen: "true" });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });

  await check("서버가 그린 헤더가 라이트 DOM 슬롯으로 투과된다(전역 .js-logout-link 핸들러가 계속 찾을 수 있다)", async () => {
    assert.equal(await page.locator(".js-logout-link").count(), 1);
    const assigned = await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('slot[name="header"]').assignedElements().length);
    assert.equal(assigned, 1);
  });
  await check("탭 두 개(즐겨찾기/프로젝트)가 있고 기본은 즐겨찾기가 활성이다", async () => {
    assert.equal(await q(page, '.tabs > [role="tab"]'), 2);
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('.tabs > [role="tab"][aria-selected="true"]').dataset.tab), "myOrganizationList");
  });
  await check("프로젝트 항목은 실제 하이퍼링크(<a href>)이고 target이 없어 일반 이동이다", async () => {
    const link = await page.evaluate(() => { const a = document.querySelector("yona-sidebar").shadowRoot.querySelector("a.project-list"); return { href: a.getAttribute("href"), target: a.getAttribute("target"), title: a.getAttribute("title") }; });
    assert.equal(link.href, "/me/mine");
    assert.equal(link.target, null);
    assert.equal(link.title, "내 프로젝트");
  });
  await check("접힌 조직은 즐겨찾기 프로젝트만 보이고, 조직 머리글을 누르면 전부 보인다", async () => {
    const before = (await text(page, ".personal a.project-list .project-name")).length;
    assert.equal(before, 1);
    await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".personal .org-list").click());
    assert.equal((await text(page, ".personal a.project-list .project-name")).length, 2);
  });
  await check("검색하면 접힌 프로젝트까지 찾아 보여준다", async () => {
    await page.evaluate(() => { const i = document.querySelector("yona-sidebar").shadowRoot.querySelector(".org-search"); i.value = "inbeta"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector("yona-sidebar").shadowRoot.querySelectorAll("#myOrganizationList a.project-list").length === 1);
    assert.deepEqual(await text(page, "#myOrganizationList a.project-list .project-name"), ["inbeta"]);
  });
  await check("별 버튼은 즐겨찾기 API를 POST하고 상태를 바꾸되 페이지를 이동하지 않는다", async () => {
    await page.evaluate(() => { const i = document.querySelector("yona-sidebar").shadowRoot.querySelector(".org-search"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
    const star = page.locator("yona-sidebar .personal .star-project").first();
    assert.equal(await star.getAttribute("aria-pressed"), "true");
    await star.click();
    await page.waitForFunction(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".personal .star-project").getAttribute("aria-pressed") === "false");
    assert.deepEqual(favoritePosts, ["10"]);
    assert.equal(new URL(page.url()).pathname, "/smoke-test/sidebar-element.html");
  });
  await check("프로젝트 이름의 HTML은 텍스트로만 표시되어 스크립트가 실행되지 않는다", async () => {
    await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('[data-tab="myProjectList"]').click());
    await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('[data-subtab="createdByMe"]').click());
    await page.waitForFunction(() => [...document.querySelector("yona-sidebar").shadowRoot.querySelectorAll("a.project-list .project-name")].some((e) => e.textContent.includes("<img")));
    assert.equal(await q(page, "img[src='x']"), 0);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
  });
  await check("CSS 변수로 테마를 투과시킬 수 있다", async () => {
    await page.evaluate(() => document.querySelector("yona-sidebar").style.setProperty("--yona-sidebar-bg", "rgb(1, 2, 3)"));
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector("yona-sidebar").shadowRoot.querySelector(".sidebar")).backgroundColor);
    assert.equal(bg, "rgb(1, 2, 3)");
  });
  await check("페이지 오류가 없다", async () => assert.deepEqual(errors, []));
  await context.close();
}

// ---- 시나리오 2: 탭/하위 탭/검색어 복원 (새로고침)
{
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('[data-tab="myProjectList"]').click());
  await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('[data-subtab="createdByMe"]').click());
  await page.evaluate(() => { const i = document.querySelector("yona-sidebar").shadowRoot.querySelector(".project-search"); i.value = "mine2"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.reload();
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await check("새로고침 후 활성 탭, 하위 탭, 검색어가 복원된다", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('.tabs > [role="tab"][aria-selected="true"]').dataset.tab), "myProjectList");
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector('[data-subtab][aria-selected="true"]').dataset.subtab), "createdByMe");
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".project-search").value), "mine2");
    assert.deepEqual(await text(page, "#myProjectList a.project-list .project-name"), ["mine2"]);
  });
  await context.close();
}

// ---- 시나리오 3: 열림 상태 저장/복원/옛 키 이전
{
  const { page, context } = await newPage();
  await page.goto(pageUrl);
  await ready(page);
  await check("저장된 값이 없으면 닫힌 상태로 시작한다", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").hasAttribute("open")), false);
  });
  await check("toggle()은 열림을 저장하고 yona-sidebar-toggle 이벤트를 낸다", async () => {
    const detail = await page.evaluate(() => new Promise((resolve) => {
      const el = document.querySelector("yona-sidebar");
      el.addEventListener("yona-sidebar-toggle", (e) => resolve(e.detail), { once: true });
      el.toggle();
    }));
    assert.deepEqual(detail, { open: true });
    assert.equal(await page.evaluate(() => localStorage.getItem("yonaLeftSidebarOpen")), "true");
  });
  await page.reload();
  await ready(page);
  await check("새로고침해도 열림 상태가 유지된다", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").hasAttribute("open")), true);
  });
  await context.close();
}
{
  const { page, context } = await newPage({ shallWeOpenLeftNavigation: "true" });
  await page.goto(pageUrl);
  await ready(page);
  await check("옛 shallWeOpenLeftNavigation=true는 열림으로 이전되고 옛 키는 지워진다", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").hasAttribute("open")), true);
    assert.equal(await page.evaluate(() => localStorage.getItem("yonaLeftSidebarOpen")), "true");
    assert.equal(await page.evaluate(() => localStorage.getItem("shallWeOpenLeftNavigation")), null);
  });
  await context.close();
}

// ---- 시나리오 4: API 실패 → 재시도
{
  apiMode = "fail";
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .error");
  await check("API가 실패하면 오류 메시지와 재시도 버튼이 보이고, 재시도하면 목록이 나타난다", async () => {
    assert.equal(await q(page, ".error button.retry"), 1);
    apiMode = "ok";
    await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".error button.retry").click());
    await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
    assert.equal(await q(page, ".error"), 0);
  });
  await context.close();
}

// ---- 시나리오 5: 전역 Messages()가 번역이 없는 키를 키 그대로 돌려줘도 기본 문구를 쓴다
{
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, () => { window.Messages = (key) => key; });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await check("번역이 없어 Messages()가 키를 그대로 돌려주면 기본 문구를 쓴다(키가 화면에 노출되지 않는다)", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".org-search").placeholder), "검색할 이름");
    assert.deepEqual(await text(page, ".tabs > [role=\"tab\"]"), ["즐겨찾기", "프로젝트"]);
    const visible = await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.textContent);
    assert.equal(/\b(sidebar|title|common)\.[a-zA-Z.]+/.test(visible), false, visible.slice(0, 120));
  });
  await context.close();
}
{
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, () => {
    const t = { "sidebar.searchPlaceholder": "Search by name", "title.favorite": "Favorite" };
    window.Messages = (key) => t[key] ?? key;
  });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await check("번역이 있으면 번역을 쓰고, 없는 키만 기본 문구로 채운다", async () => {
    assert.equal(await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".org-search").placeholder), "Search by name");
    assert.deepEqual(await text(page, ".tabs > [role=\"tab\"]"), ["Favorite", "프로젝트"]);
  });
  await context.close();
}

// ---- 시나리오 6: sessionStorage 캐시(페이지 이동 직후 바로 그리기)
const mk = (name) => ({
  loginId: "me", personal: [project(30, name, "me", true)], favoriteOrganizations: [], organizations: [], favoriteProjects: [],
  recentlyVisited: [project(30, name, "me", true)], createdByMe: [project(30, name, "me", true)], watching: [], joinmember: [], visitedIssues: [],
});
const seedCache = ([menuJson, ageMs]) => {
  if (sessionStorage.getItem("__cacheinit")) return;
  sessionStorage.setItem("__cacheinit", "1");
  sessionStorage.setItem("yona.sidebar.cache.me", JSON.stringify({ savedAt: Date.now() - ageMs, menu: JSON.parse(menuJson) }));
};
const visibleNames = (page) => text(page, "#myOrganizationList a.project-list .project-name");
{
  // 오래된(60초) 캐시 + 느린 API: 캐시를 즉시 그리고, 응답이 오면 새 데이터로 바뀌며 캐시도 갱신된다.
  apiDelayMs = 1500; apiBody = mk("fresh-proj"); apiCalls = 0;
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, seedCache, [JSON.stringify(mk("cached-proj")), 60_000]);
  await page.goto(loginPageUrl);
  await ready(page);
  await check("캐시가 있으면 API 응답 전에 캐시된 목록을 즉시 그리고 '불러오는 중'을 보이지 않는다", async () => {
    await page.waitForFunction(() => document.querySelector("yona-sidebar").shadowRoot.querySelectorAll("#myOrganizationList a.project-list").length > 0, null, { timeout: 800 });
    assert.deepEqual(await visibleNames(page), ["cached-proj"]);
    assert.equal(await q(page, ".status"), 0);
    assert.equal(await q(page, ".error"), 0);
  });
  await check("오래된 캐시는 서버 응답으로 갱신되고 캐시에도 새 데이터가 저장된다", async () => {
    await page.waitForFunction(() => document.querySelector("yona-sidebar").shadowRoot.querySelector("#myOrganizationList a.project-list .project-name")?.textContent.trim() === "fresh-proj", null, { timeout: 5000 });
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("yona.sidebar.cache.me")).menu.personal[0].name);
    assert.equal(stored, "fresh-proj");
    assert.equal(apiCalls, 1);
  });
  await context.close();
  apiDelayMs = 0; apiBody = null;
}
{
  // 신선한(2초) 캐시: 서버에 다시 묻지 않는다(페이지 이동마다 DB 조회를 하지 않기 위해).
  apiCalls = 0;
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, seedCache, [JSON.stringify(mk("cached-proj")), 2_000]);
  await page.goto(loginPageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await page.waitForTimeout(600);
  await check("15초 이내의 신선한 캐시는 API를 호출하지 않고 캐시로 그린다", async () => {
    assert.equal(apiCalls, 0);
    assert.deepEqual(await visibleNames(page), ["cached-proj"]);
  });
  await context.close();
}
{
  // 오래된 캐시 + API 실패: 캐시를 계속 보여주고 오류 배너를 띄우지 않는다.
  apiMode = "fail";
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, seedCache, [JSON.stringify(mk("cached-proj")), 60_000]);
  await page.goto(loginPageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await page.waitForTimeout(800);
  await check("갱신이 실패해도 캐시된 목록을 유지하고 오류 배너를 띄우지 않는다", async () => {
    assert.deepEqual(await visibleNames(page), ["cached-proj"]);
    assert.equal(await q(page, ".error"), 0);
  });
  await context.close();
  apiMode = "ok";
}
{
  // 별 토글은 캐시를 즉시 갱신한다(다음 페이지가 방금 바꾼 상태를 바로 본다).
  favoritePosts.length = 0;
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, seedCache, [JSON.stringify(MENU), 2_000]);
  await page.route("**/-_-api/v1/favoriteProjects/*", (route) => route.fulfill({ json: { projectId: "10", favored: false } }));
  await page.goto(loginPageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await page.evaluate(() => document.querySelector("yona-sidebar").shadowRoot.querySelector(".personal .star-project").click());
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("yona.sidebar.cache.me")).menu.personal.find((p) => p.id === 10).favorite === false, null, { timeout: 3000 });
  await check("별을 토글하면 캐시의 즐겨찾기 상태도 바로 갱신된다", async () => {
    const fav = await page.evaluate(() => JSON.parse(sessionStorage.getItem("yona.sidebar.cache.me")).menu.personal.find((p) => p.id === 10).favorite);
    assert.equal(fav, false);
  });
  await context.close();
}
{
  // login-id 속성이 없으면(사용자를 서버가 확정해 주지 않으면) 캐시를 읽지도 쓰지도 않는다.
  apiDelayMs = 600; apiBody = mk("fresh-proj");
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" }, seedCache, [JSON.stringify(mk("cached-proj")), 60_000]);
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  await check("login-id 속성이 없으면 캐시를 쓰지 않는다(다른 사용자의 목록이 보일 수 없다)", async () => {
    assert.deepEqual(await visibleNames(page), ["fresh-proj"]);
  });
  await context.close();
  apiDelayMs = 0; apiBody = null;
}

// ---- 시나리오 7: 닫을 때 내용을 바로 지우지 않는다(호스트가 슬라이드 아웃하는 동안 내용이 보여야 한다)
{
  const { page, context } = await newPage({ yonaLeftSidebarOpen: "true" });
  await page.goto(pageUrl);
  await ready(page);
  await page.waitForSelector("yona-sidebar .user-li", { state: "attached" });
  const asideState = () => page.evaluate(() => { const a = document.querySelector("yona-sidebar").shadowRoot.querySelector(".sidebar"); const cs = getComputedStyle(a); return { display: cs.display, visibility: cs.visibility, h: Math.round(a.getBoundingClientRect().height) }; });
  await check("--yona-sidebar-slide가 없으면(단독 사용) 닫는 즉시 숨겨진다", async () => {
    await page.evaluate(() => document.querySelector("yona-sidebar").setOpen(false));
    await page.waitForTimeout(60);
    assert.equal((await asideState()).visibility, "hidden");
  });
  await page.evaluate(() => { const el = document.querySelector("yona-sidebar"); el.setOpen(true); el.style.setProperty("--yona-sidebar-slide", "400ms"); });
  await page.waitForTimeout(100);
  await check("슬라이드 시간이 있으면 닫는 도중에도 내용이 그대로 렌더링되어 있다(display:none이 아니고 높이가 있다)", async () => {
    await page.evaluate(() => document.querySelector("yona-sidebar").setOpen(false));
    await page.waitForTimeout(120);
    const mid = await asideState();
    assert.notEqual(mid.display, "none");
    assert.equal(mid.visibility, "visible");
    assert.ok(mid.h > 0, "높이 " + mid.h);
  });
  await check("슬라이드 시간이 지나면 숨겨져 포커스와 스크린리더에서 빠진다", async () => {
    await page.waitForTimeout(500);
    assert.equal((await asideState()).visibility, "hidden");
  });
  await check("다시 열면 즉시 보인다", async () => {
    await page.evaluate(() => document.querySelector("yona-sidebar").setOpen(true));
    await page.waitForTimeout(60);
    assert.equal((await asideState()).visibility, "visible");
  });
  await context.close();
}

await browser.close();
await server.close();
if (failures.length) {
  console.log(`\n실패 ${failures.length}건:`, failures);
  process.exit(1);
}
console.log("\n모든 검증 통과");
