import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_MAX_AGE_MS,
  FRESH_MS,
  cacheKey,
  readCache,
  writeCache,
  isFresh,
} from "../src/usermenu/sidebar-cache.js";
import { normalizeMenu } from "../src/usermenu/usermenu.js";
import type { StorageLike } from "../src/usermenu/sidebar-state.js";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("quota"); },
  removeItem: () => { throw new Error("blocked"); },
};

const menuOf = (loginId: string) =>
  normalizeMenu({
    loginId,
    createdByMe: [{ id: 1, name: "mine", owner: loginId, overview: null, href: `/${loginId}/mine`, favorite: true }],
  });

const NOW = 1_000_000;

test("writeCache/readCache: 저장한 메뉴를 그대로 돌려준다", () => {
  const storage = memoryStorage();
  writeCache(storage, "alice", menuOf("alice"), NOW);
  const cached = readCache(storage, "alice", NOW + 1000);
  assert.deepEqual(cached?.menu, menuOf("alice"));
  assert.equal(cached?.savedAt, NOW);
});

test("readCache: 저장된 것이 없으면 null", () => {
  assert.equal(readCache(memoryStorage(), "alice", NOW), null);
});

test("사용자별로 분리된다: 다른 사용자의 캐시는 읽히지 않는다", () => {
  const storage = memoryStorage();
  writeCache(storage, "alice", menuOf("alice"), NOW);
  assert.equal(readCache(storage, "bob", NOW), null);
  assert.notEqual(cacheKey("alice"), cacheKey("bob"));
});

test("loginId가 비어 있으면 읽지도 쓰지도 않는다", () => {
  const storage = memoryStorage();
  writeCache(storage, "", menuOf("alice"), NOW);
  assert.deepEqual(storage.data, {});
  assert.equal(readCache(storage, "", NOW), null);
});

test("readCache: 최대 보관 시간(30분)을 넘기면 버린다", () => {
  const storage = memoryStorage();
  writeCache(storage, "alice", menuOf("alice"), NOW);
  assert.notEqual(readCache(storage, "alice", NOW + CACHE_MAX_AGE_MS), null);
  assert.equal(readCache(storage, "alice", NOW + CACHE_MAX_AGE_MS + 1), null);
});

test("readCache: 시계가 거꾸로 간 항목(미래 시각)은 신뢰하지 않는다", () => {
  const storage = memoryStorage();
  writeCache(storage, "alice", menuOf("alice"), NOW + 60_000);
  assert.equal(readCache(storage, "alice", NOW), null);
});

test("readCache: 깨진 JSON이나 모양이 다른 값은 null", () => {
  assert.equal(readCache(memoryStorage({ [cacheKey("alice")]: "{not json" }), "alice", NOW), null);
  assert.equal(readCache(memoryStorage({ [cacheKey("alice")]: "42" }), "alice", NOW), null);
  assert.equal(readCache(memoryStorage({ [cacheKey("alice")]: JSON.stringify({ savedAt: "x", menu: {} }) }), "alice", NOW), null);
});

test("readCache: 저장된 메뉴의 loginId가 요청한 사용자와 다르면 버린다(키를 가로채 넣은 값 방어)", () => {
  const storage = memoryStorage({ [cacheKey("alice")]: JSON.stringify({ savedAt: NOW, menu: menuOf("mallory") }) });
  assert.equal(readCache(storage, "alice", NOW), null);
});

test("readCache: 저장된 값은 항상 normalizeMenu를 거쳐 완전한 메뉴로 돌아온다", () => {
  const storage = memoryStorage({ [cacheKey("alice")]: JSON.stringify({ savedAt: NOW, menu: { loginId: "alice", createdByMe: [{ name: "no-id" }] } }) });
  const cached = readCache(storage, "alice", NOW);
  assert.deepEqual(cached?.menu.createdByMe, []);
  assert.deepEqual(cached?.menu.watching, []);
});

test("저장소가 예외를 던져도(차단/용량 초과) 밖으로 내지 않는다", () => {
  assert.doesNotThrow(() => writeCache(throwingStorage, "alice", menuOf("alice"), NOW));
  assert.equal(readCache(throwingStorage, "alice", NOW), null);
});

test("isFresh: 15초 이내면 신선하고 그 이후는 아니다", () => {
  const cached = { menu: menuOf("alice"), savedAt: NOW };
  assert.equal(isFresh(cached, NOW + FRESH_MS), true);
  assert.equal(isFresh(cached, NOW + FRESH_MS + 1), false);
  assert.equal(isFresh(null, NOW), false);
});
