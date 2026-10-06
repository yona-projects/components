// 사이드바 데이터의 마지막 응답을 sessionStorage에 보관해, 페이지를 이동한 직후에도 "불러오는 중"을 거치지 않고 바로
// 그리게 한다. 사용자별 키로 분리하고, 값은 항상 normalizeMenu를 거쳐 읽는다. DOM에 의존하지 않아 node:test로 검증한다.
import type { StorageLike } from "./sidebar-state";
import { normalizeMenu, type UserMenu } from "./usermenu";

// 이보다 오래된 캐시는 쓰지 않는다(탭을 오래 열어 둔 뒤 낡은 목록을 보여주지 않기 위해).
export const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
// 이 안이면 서버에 다시 묻지 않는다. 별 토글은 캐시를 즉시 갱신하므로 이 창 안에서도 내 변경과 어긋나지 않는다.
export const FRESH_MS = 15 * 1000;

export interface CachedMenu {
  menu: UserMenu;
  savedAt: number;
}

export const cacheKey = (loginId: string) => `yona.sidebar.cache.${loginId}`;

export function readCache(storage: StorageLike, loginId: string, now: number): CachedMenu | null {
  if (!loginId) return null;
  try {
    const raw = storage.getItem(cacheKey(loginId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { savedAt, menu } = parsed as { savedAt?: unknown; menu?: unknown };
    if (typeof savedAt !== "number") return null;
    // 미래 시각(시계가 되돌려진 경우)이나 너무 오래된 항목은 신뢰하지 않는다.
    if (savedAt > now || now - savedAt > CACHE_MAX_AGE_MS) return null;
    const normalized = normalizeMenu(menu);
    // 다른 사용자의 데이터를 이 키에 넣어 두었더라도 보여주지 않는다.
    if (normalized.loginId !== loginId) return null;
    return { menu: normalized, savedAt };
  } catch {
    return null;
  }
}

export function writeCache(storage: StorageLike, loginId: string, menu: UserMenu, now: number): void {
  if (!loginId) return;
  try {
    storage.setItem(cacheKey(loginId), JSON.stringify({ savedAt: now, menu }));
  } catch {
    // 용량 초과나 차단된 저장소에서도 사이드바는 캐시 없이 동작해야 한다.
  }
}

export function isFresh(cached: CachedMenu | null, now: number): boolean {
  return cached !== null && now - cached.savedAt <= FRESH_MS;
}
