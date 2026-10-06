import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OPEN_KEY,
  LEGACY_OPEN_KEY,
  readOpen,
  writeOpen,
  readActiveTab,
  writeActiveTab,
  readUiState,
  writeUiState,
  type StorageLike,
} from "../src/usermenu/sidebar-state.js";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

// 저장소가 막힌 환경(사생활 보호 모드, 차단된 사이트 데이터)에서는 접근 자체가 예외를 던진다.
const throwingStorage: StorageLike = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

test("readOpen: 저장된 값이 없으면 닫힘", () => {
  assert.equal(readOpen(memoryStorage()), false);
});

test("readOpen: 새 키 true면 열림, false면 닫힘", () => {
  assert.equal(readOpen(memoryStorage({ [OPEN_KEY]: "true" })), true);
  assert.equal(readOpen(memoryStorage({ [OPEN_KEY]: "false" })), false);
});

test("readOpen: 새 키가 없고 옛 키(shallWeOpenLeftNavigation)가 true면 열림으로 이전하고 옛 키를 지운다", () => {
  const storage = memoryStorage({ [LEGACY_OPEN_KEY]: "true" });
  assert.equal(readOpen(storage), true);
  assert.equal(storage.data[OPEN_KEY], "true");
  assert.equal(LEGACY_OPEN_KEY in storage.data, false);
});

test("readOpen: 옛 키가 false면 닫힘으로 이전한다", () => {
  const storage = memoryStorage({ [LEGACY_OPEN_KEY]: "false" });
  assert.equal(readOpen(storage), false);
  assert.equal(storage.data[OPEN_KEY], "false");
  assert.equal(LEGACY_OPEN_KEY in storage.data, false);
});

test("readOpen: 새 키가 있으면 옛 키보다 우선하고 옛 키는 건드리지 않는다", () => {
  const storage = memoryStorage({ [OPEN_KEY]: "false", [LEGACY_OPEN_KEY]: "true" });
  assert.equal(readOpen(storage), false);
  assert.equal(storage.data[LEGACY_OPEN_KEY], "true");
});

test("readOpen: true/false 이외의 값은 닫힘으로 취급한다", () => {
  assert.equal(readOpen(memoryStorage({ [OPEN_KEY]: "yes" })), false);
});

test("readOpen/writeOpen: 저장소가 예외를 던져도 닫힘으로 동작하고 예외를 밖으로 내지 않는다", () => {
  assert.equal(readOpen(throwingStorage), false);
  assert.doesNotThrow(() => writeOpen(throwingStorage, true));
});

test("writeOpen: 새 키에 true/false 문자열로 저장한다", () => {
  const storage = memoryStorage();
  writeOpen(storage, true);
  assert.equal(storage.data[OPEN_KEY], "true");
  writeOpen(storage, false);
  assert.equal(storage.data[OPEN_KEY], "false");
});

test("readActiveTab: 기존 sidebarActiveMenu 키와 호환되고, 알 수 없는 값은 즐겨찾기로 되돌린다", () => {
  assert.equal(readActiveTab(memoryStorage()), "myOrganizationList");
  assert.equal(readActiveTab(memoryStorage({ sidebarActiveMenu: "myProjectList" })), "myProjectList");
  assert.equal(readActiveTab(memoryStorage({ sidebarActiveMenu: "hacked" })), "myOrganizationList");
  assert.equal(readActiveTab(throwingStorage), "myOrganizationList");
});

test("writeActiveTab: 유효한 탭만 저장한다", () => {
  const storage = memoryStorage();
  writeActiveTab(storage, "myProjectList");
  assert.equal(storage.data.sidebarActiveMenu, "myProjectList");
  writeActiveTab(storage, "bogus" as never);
  assert.equal(storage.data.sidebarActiveMenu, "myProjectList");
});

test("readUiState: 사용자별로 분리되어 다른 사용자의 상태가 섞이지 않는다", () => {
  const storage = memoryStorage();
  writeUiState(storage, "alice", { projectTab: "createdByMe", orgQuery: "ac", projectQuery: "" });
  assert.deepEqual(readUiState(storage, "alice"), { projectTab: "createdByMe", orgQuery: "ac", projectQuery: "" });
  assert.deepEqual(readUiState(storage, "bob"), { projectTab: "recentlyVisited", orgQuery: "", projectQuery: "" });
});

test("readUiState: 깨진 JSON/알 수 없는 하위 탭은 기본값으로 되돌린다", () => {
  const storage = memoryStorage({ "yona.sidebar.alice": "{not json" });
  assert.deepEqual(readUiState(storage, "alice"), { projectTab: "recentlyVisited", orgQuery: "", projectQuery: "" });
  const bad = memoryStorage({ "yona.sidebar.alice": JSON.stringify({ projectTab: "evil", orgQuery: 5 }) });
  assert.deepEqual(readUiState(bad, "alice"), { projectTab: "recentlyVisited", orgQuery: "", projectQuery: "" });
});

test("readUiState/writeUiState: loginId가 비어 있으면 아무것도 저장/복원하지 않는다", () => {
  const storage = memoryStorage();
  writeUiState(storage, "", { projectTab: "watching", orgQuery: "x", projectQuery: "y" });
  assert.deepEqual(storage.data, {});
  assert.equal(readUiState(storage, "").projectTab, "recentlyVisited");
});

test("writeUiState: 저장소가 예외를 던져도 밖으로 내지 않는다", () => {
  assert.doesNotThrow(() => writeUiState(throwingStorage, "alice", { projectTab: "watching", orgQuery: "", projectQuery: "" }));
});
