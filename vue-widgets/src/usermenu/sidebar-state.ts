// 왼쪽 사이드바의 열림 상태와 UI 상태(탭, 검색어)를 저장소에 보관/복원한다. DOM에 의존하지 않아 node:test로 검증한다.
// 저장소는 막힌 환경(사생활 보호 모드, 차단된 사이트 데이터)에서 접근만으로 예외를 던질 수 있어 모든 접근을 감싼다.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const OPEN_KEY = "yonaLeftSidebarOpen";
// iframe 시절 키. 값이 남아 있는 사용자의 열림 상태를 한 번 새 키로 옮기고 지운다.
export const LEGACY_OPEN_KEY = "shallWeOpenLeftNavigation";

export type ActiveTab = "myOrganizationList" | "myProjectList";
export type ProjectTab = "recentlyVisited" | "createdByMe" | "watching" | "joinmember";

const ACTIVE_TAB_KEY = "sidebarActiveMenu"; // 기존 키와 호환
const ACTIVE_TABS: readonly ActiveTab[] = ["myOrganizationList", "myProjectList"];
const PROJECT_TABS: readonly ProjectTab[] = ["recentlyVisited", "createdByMe", "watching", "joinmember"];

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readOpen(storage: StorageLike): boolean {
  return safe(() => {
    const current = storage.getItem(OPEN_KEY);
    if (current !== null) return current === "true";
    const legacy = storage.getItem(LEGACY_OPEN_KEY);
    if (legacy === null) return false;
    const open = legacy === "true";
    storage.setItem(OPEN_KEY, String(open));
    storage.removeItem(LEGACY_OPEN_KEY);
    return open;
  }, false);
}

export function writeOpen(storage: StorageLike, open: boolean): void {
  safe(() => storage.setItem(OPEN_KEY, String(open)), undefined);
}

export function readActiveTab(storage: StorageLike): ActiveTab {
  const stored = safe(() => storage.getItem(ACTIVE_TAB_KEY), null);
  return ACTIVE_TABS.find((tab) => tab === stored) ?? "myOrganizationList";
}

export function writeActiveTab(storage: StorageLike, tab: ActiveTab): void {
  if (!ACTIVE_TABS.includes(tab)) return;
  safe(() => storage.setItem(ACTIVE_TAB_KEY, tab), undefined);
}

export interface UiState {
  projectTab: ProjectTab;
  orgQuery: string;
  projectQuery: string;
}

const DEFAULT_UI_STATE: UiState = { projectTab: "recentlyVisited", orgQuery: "", projectQuery: "" };

const uiKey = (loginId: string) => `yona.sidebar.${loginId}`;

// 같은 브라우저에서 계정을 바꿔도 이전 사용자의 검색어가 보이지 않도록 loginId별로 분리한다.
export function readUiState(storage: StorageLike, loginId: string): UiState {
  if (!loginId) return { ...DEFAULT_UI_STATE };
  return safe(() => {
    const raw = storage.getItem(uiKey(loginId));
    if (raw === null) return { ...DEFAULT_UI_STATE };
    const parsed: unknown = JSON.parse(raw);
    const source = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    return {
      projectTab: PROJECT_TABS.find((t) => t === source.projectTab) ?? DEFAULT_UI_STATE.projectTab,
      orgQuery: typeof source.orgQuery === "string" ? source.orgQuery : "",
      projectQuery: typeof source.projectQuery === "string" ? source.projectQuery : "",
    };
  }, { ...DEFAULT_UI_STATE });
}

export function writeUiState(storage: StorageLike, loginId: string, state: UiState): void {
  if (!loginId) return;
  safe(() => storage.setItem(uiKey(loginId), JSON.stringify(state)), undefined);
}
