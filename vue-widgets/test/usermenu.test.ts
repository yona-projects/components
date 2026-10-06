import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMenu,
  matchesQuery,
  filterProjects,
  filterOrganizations,
  visibleOrgProjects,
  applyFavorite,
  type MenuProject,
  type MenuOrganization,
  type UserMenu,
} from "../src/usermenu/usermenu.js";

const project = (id: number, name: string, owner = "me", favorite = false): MenuProject => ({
  id, name, owner, overview: null, href: `/${owner}/${name}/go`, favorite,
});
const org = (id: number, name: string, projects: MenuProject[], favorite = false): MenuOrganization => ({
  id, name, favorite, projects,
});

test("normalizeMenu: 누락되거나 배열이 아닌 목록은 빈 배열이 되고 loginId는 빈 문자열이 된다", () => {
  const menu = normalizeMenu({ loginId: 5, personal: "x", createdByMe: null });
  assert.equal(menu.loginId, "");
  for (const key of [
    "personal", "favoriteOrganizations", "organizations", "favoriteProjects",
    "recentlyVisited", "createdByMe", "watching", "joinmember", "visitedIssues",
  ] as const) {
    assert.deepEqual(menu[key], [], key);
  }
});

test("normalizeMenu: null/undefined/객체가 아닌 응답도 안전하게 빈 메뉴로 만든다", () => {
  for (const raw of [null, undefined, "oops", 3, []]) {
    assert.equal(normalizeMenu(raw).loginId, "");
    assert.deepEqual(normalizeMenu(raw).personal, []);
  }
});

test("normalizeMenu: 정상 응답의 값은 그대로 보존한다", () => {
  const raw = {
    loginId: "me",
    createdByMe: [project(1, "mine")],
    favoriteOrganizations: [org(20, "acme", [project(2, "inacme", "acme", true)], true)],
    visitedIssues: [{ title: "버그", href: "/me/mine/issue/3" }],
  };
  const menu = normalizeMenu(raw);
  assert.equal(menu.loginId, "me");
  assert.equal(menu.createdByMe[0].href, "/me/mine/go");
  assert.equal(menu.favoriteOrganizations[0].projects[0].favorite, true);
  assert.equal(menu.visitedIssues[0].title, "버그");
});

test("normalizeMenu: id나 name이 없는 깨진 프로젝트 항목은 걸러낸다", () => {
  const menu = normalizeMenu({ createdByMe: [{ name: "no-id" }, project(1, "ok"), { id: 2 }, null] });
  assert.deepEqual(menu.createdByMe.map((p) => p.name), ["ok"]);
});

test("matchesQuery: 대소문자와 앞뒤 공백을 무시하고, 빈 검색어는 전부 일치한다", () => {
  assert.equal(matchesQuery("Yona Core", "  yona "), true);
  assert.equal(matchesQuery("Yona Core", "CORE"), true);
  assert.equal(matchesQuery("Yona Core", "zzz"), false);
  assert.equal(matchesQuery("Yona Core", ""), true);
  assert.equal(matchesQuery("Yona Core", "   "), true);
});

test("filterProjects: 이름 또는 소유자가 일치하는 프로젝트만 남긴다", () => {
  const list = [project(1, "alpha", "me"), project(2, "beta", "acme"), project(3, "gamma", "me")];
  assert.deepEqual(filterProjects(list, "alp").map((p) => p.id), [1]);
  assert.deepEqual(filterProjects(list, "acme").map((p) => p.id), [2]);
  assert.deepEqual(filterProjects(list, "").map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(filterProjects(list, "nothing"), []);
});

test("filterOrganizations: 조직 이름이 일치하면 조직의 모든 프로젝트를 유지한다", () => {
  const orgs = [org(1, "acme", [project(1, "a"), project(2, "b")]), org(2, "beta", [project(3, "c")])];
  const result = filterOrganizations(orgs, "acme");
  assert.deepEqual(result.map((o) => o.name), ["acme"]);
  assert.deepEqual(result[0].projects.map((p) => p.id), [1, 2]);
});

test("filterOrganizations: 프로젝트만 일치하면 그 조직은 일치하는 프로젝트만 가진 채 남는다", () => {
  const orgs = [org(1, "acme", [project(1, "alpha"), project(2, "beta")]), org(2, "zeta", [project(3, "gamma")])];
  const result = filterOrganizations(orgs, "alpha");
  assert.deepEqual(result.map((o) => o.name), ["acme"]);
  assert.deepEqual(result[0].projects.map((p) => p.id), [1]);
});

test("filterOrganizations: 빈 검색어는 입력을 그대로 돌려주고, 입력 객체를 변경하지 않는다", () => {
  const orgs = [org(1, "acme", [project(1, "alpha")])];
  const snapshot = JSON.stringify(orgs);
  assert.deepEqual(filterOrganizations(orgs, ""), orgs);
  filterOrganizations(orgs, "zzz");
  assert.equal(JSON.stringify(orgs), snapshot);
});

test("visibleOrgProjects: 접힌 상태에선 즐겨찾기 프로젝트만, 펼치면 전부 보인다", () => {
  const o = org(1, "acme", [project(1, "a", "acme", true), project(2, "b", "acme", false)]);
  assert.deepEqual(visibleOrgProjects(o, false).map((p) => p.id), [1]);
  assert.deepEqual(visibleOrgProjects(o, true).map((p) => p.id), [1, 2]);
});

test("applyFavorite: 모든 목록에 나타나는 같은 프로젝트의 favorite을 함께 바꾼다", () => {
  const menu: UserMenu = normalizeMenu({
    loginId: "me",
    personal: [project(1, "mine")],
    createdByMe: [project(1, "mine")],
    recentlyVisited: [project(1, "mine"), project(2, "other")],
    organizations: [org(20, "acme", [project(1, "mine")])],
  });
  const next = applyFavorite(menu, 1, true);
  assert.equal(next.personal[0].favorite, true);
  assert.equal(next.createdByMe[0].favorite, true);
  assert.equal(next.recentlyVisited[0].favorite, true);
  assert.equal(next.recentlyVisited[1].favorite, false);
  assert.equal(next.organizations[0].projects[0].favorite, true);
});

test("applyFavorite: 원본 메뉴를 변경하지 않는다", () => {
  const menu = normalizeMenu({ createdByMe: [project(1, "mine")] });
  applyFavorite(menu, 1, true);
  assert.equal(menu.createdByMe[0].favorite, false);
});
