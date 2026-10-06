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
const favoritePosts = [];

async function newPage(storage = {}) {
  const context = await browser.newContext();
  await context.addInitScript((initial) => {
    if (!sessionStorage.getItem("__init")) {
      sessionStorage.setItem("__init", "1");
      for (const [k, v] of Object.entries(initial)) localStorage.setItem(k, v);
    }
  }, storage);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/-_-api/v1/usermenu", (route) => {
    apiCalls += 1;
    if (apiMode === "fail") return route.fulfill({ status: 500, body: "boom" });
    return route.fulfill({ json: MENU });
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

await browser.close();
await server.close();
if (failures.length) {
  console.log(`\n실패 ${failures.length}건:`, failures);
  process.exit(1);
}
console.log("\n모든 검증 통과");
