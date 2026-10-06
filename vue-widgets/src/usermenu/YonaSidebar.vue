<script setup lang="ts">
// 왼쪽 사이드바(즐겨찾기/프로젝트 탭). iframe 안에 본문을 띄우던 layout_framed 구조를 걷어내고, 모든 페이지에 직접
// 들어가는 Shadow DOM 컴포넌트로 다시 쓴 것이다. 데이터는 GET /-_-api/v1/usermenu(JSON)에서 가져온다.
//
// 전부 Shadow DOM에 그리지 않는 부분: 사용자 헤더(프로필/설정/로그아웃)는 서버가 라이트 DOM으로 그려 <slot name="header">로
// 투과한다. 로그아웃은 전역 `.js-logout-link` document 클릭 델리게이트가 POST로 바꿔 보내는데, 버튼이 Shadow DOM 안에
// 있으면 클릭 target이 host로 리타겟되어 이 델리게이트가 찾지 못하기 때문이다(다른 위젯에서 이미 확인된 경계 문제).
//
// 항목은 실제 <a href>다. 본문이 iframe이 아니므로 target 없이 일반 이동하고, Ctrl/Cmd 클릭, 새 탭, 키보드 포커스를
// 브라우저가 그대로 처리한다. 테마는 CSS 변수(--yona-sidebar-*)로 받는다.
import { computed, onMounted, ref, useHost, watch } from "vue";
import {
  applyFavorite,
  applyOrganizationFavorite,
  filterOrganizations,
  filterProjects,
  normalizeMenu,
  visibleOrgProjects,
  type MenuOrganization,
  type MenuProject,
  type UserMenu,
} from "./usermenu";
import {
  readActiveTab,
  readOpen,
  readUiState,
  writeActiveTab,
  writeOpen,
  writeUiState,
  type ActiveTab,
  type ProjectTab,
  type StorageLike,
} from "./sidebar-state";

const props = withDefaults(
  defineProps<{
    apiUrl?: string;
    favoriteProjectUrl?: string;
    favoriteOrganizationUrl?: string;
  }>(),
  {
    apiUrl: "/-_-api/v1/usermenu",
    favoriteProjectUrl: "/-_-api/v1/favoriteProjects/",
    favoriteOrganizationUrl: "/-_-api/v1/favoriteOrganizations/",
  },
);

const host = useHost();

declare function Messages(key: string): string;

// 전역 Messages()는 번역이 없는 키를 키 문자열 그대로 돌려주므로(빈 값이 아니다), 키가 돌아오면 없는 것으로 보고 기본 문구를 쓴다.
function msg(key: string, fallback: string): string {
  const value = typeof Messages === "function" ? Messages(key) : "";
  return value && value !== key ? value : fallback;
}

// localStorage 접근 자체가 예외를 던지는 환경(차단된 사이트 데이터)에서도 컴포넌트가 깨지지 않게 한다.
const noopStorage: StorageLike = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
function storage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return noopStorage;
  }
}

const menu = ref<UserMenu | null>(null);
const loading = ref(false);
const failed = ref(false);
const open = ref(host?.hasAttribute("open") || readOpen(storage()));
const activeTab = ref<ActiveTab>(readActiveTab(storage()));
const projectTab = ref<ProjectTab>("recentlyVisited");
const orgQuery = ref("");
const projectQuery = ref("");
const expanded = ref<Set<string>>(new Set());
// 로드 시점의 즐겨찾기 스냅샷. 별을 눌러 해제해도 접힌 조직에서 그 항목이 바로 사라지지 않게 한다.
const pinnedIds = ref<Set<number>>(new Set());

const loginId = computed(() => host?.getAttribute("login-id") || menu.value?.loginId || "");

watch(
  open,
  (value) => {
    host?.toggleAttribute("open", value);
    if (value && !menu.value && !loading.value) void load();
  },
  { immediate: true },
);

function setOpen(next: boolean): void {
  if (open.value === next) return;
  open.value = next;
  writeOpen(storage(), next);
  host?.dispatchEvent(new CustomEvent("yona-sidebar-toggle", { detail: { open: next }, bubbles: true, composed: true }));
}

function toggle(): void {
  setOpen(!open.value);
}

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const response = await fetch(props.apiUrl, { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (!response.ok) throw new Error(String(response.status));
    const loaded = normalizeMenu(await response.json());
    pinnedIds.value = new Set(
      [...loaded.personal, ...loaded.favoriteOrganizations.flatMap((o) => o.projects), ...loaded.organizations.flatMap((o) => o.projects)]
        .filter((p) => p.favorite)
        .map((p) => p.id),
    );
    menu.value = loaded;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

// 사용자가 확정되면(서버가 준 login-id 또는 응답의 loginId) 그 사용자의 하위 탭/검색어를 복원한다.
watch(
  loginId,
  (id) => {
    if (!id) return;
    const state = readUiState(storage(), id);
    projectTab.value = state.projectTab;
    orgQuery.value = state.orgQuery;
    projectQuery.value = state.projectQuery;
  },
  { immediate: true },
);

function persistUiState(): void {
  writeUiState(storage(), loginId.value, { projectTab: projectTab.value, orgQuery: orgQuery.value, projectQuery: projectQuery.value });
}

function selectTab(tab: ActiveTab): void {
  activeTab.value = tab;
  writeActiveTab(storage(), tab);
}

function selectProjectTab(tab: ProjectTab): void {
  projectTab.value = tab;
  persistUiState();
}

function toggleExpanded(key: string): void {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

async function post(url: string): Promise<{ favored: boolean } | null> {
  try {
    const response = await fetch(url, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return null;
    return { favored: ((await response.json()) as { favored?: unknown }).favored === true };
  } catch {
    return null;
  }
}

async function toggleProjectStar(project: MenuProject): Promise<void> {
  const result = await post(props.favoriteProjectUrl + project.id);
  if (result && menu.value) menu.value = applyFavorite(menu.value, project.id, result.favored);
}

async function toggleOrganizationStar(organization: MenuOrganization): Promise<void> {
  const result = await post(props.favoriteOrganizationUrl + organization.id);
  if (result && menu.value) menu.value = applyOrganizationFavorite(menu.value, organization.id, result.favored);
}

const tabs = computed(() => [
  { id: "myOrganizationList" as const, label: msg("title.favorite", "즐겨찾기") },
  { id: "myProjectList" as const, label: msg("title.project", "프로젝트") },
]);

const projectTabs = computed(() => [
  { id: "recentlyVisited" as const, label: msg("common.order.recentlyVisited", "최근 방문") },
  { id: "createdByMe" as const, label: msg("common.order.createdByMe", "내가 만든") },
  { id: "watching" as const, label: msg("common.order.watching", "지켜보는") },
  { id: "joinmember" as const, label: msg("common.order.joinmember", "참여 중인") },
]);

// 즐겨찾기 탭: 내가 만든 프로젝트(개인 영역) → 즐겨찾기 조직 → 그 외 가입 조직. 개인 영역은 조직과 같은 형태로 다룬다.
const PERSONAL_KEY = "personal";
const orgGroups = computed(() => {
  const current = menu.value;
  if (!current) return [];
  const personal: MenuOrganization = { id: -1, name: current.loginId, favorite: false, projects: current.personal };
  const all = [personal, ...current.favoriteOrganizations, ...current.organizations];
  return filterOrganizations(all, orgQuery.value).map((org) => ({
    org,
    key: org.id === -1 ? PERSONAL_KEY : `org-${org.id}`,
    personal: org.id === -1,
    // 검색 중에는 접힌 프로젝트까지 보여준다.
    projects: visibleOrgProjects(org, expanded.value.has(org.id === -1 ? PERSONAL_KEY : `org-${org.id}`) || orgQuery.value.trim() !== "", (p) => pinnedIds.value.has(p.id)),
  }));
});

const etcFavorites = computed(() => filterProjects(menu.value?.favoriteProjects ?? [], orgQuery.value));
const projectRows = computed(() => filterProjects(menu.value?.[projectTab.value] ?? [], projectQuery.value));
const noOrganizations = computed(() => orgGroups.value.length === 0 && etcFavorites.value.length === 0);

defineExpose({ toggle, setOpen, reload: load });

onMounted(() => {
  if (open.value && !menu.value && !loading.value) void load();
});
</script>

<template>
  <aside class="sidebar" part="sidebar" :hidden="!open" role="complementary" :aria-label="msg('title.sidebar', 'Sidebar')">
    <slot name="header"></slot>

    <div class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        role="tab"
        :data-tab="tab.id"
        :aria-selected="activeTab === tab.id"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="failed" class="error" role="alert">
      {{ msg("sidebar.loadFailed", "목록을 불러오지 못했습니다.") }}
      <button class="retry" type="button" @click="load">{{ msg("sidebar.retry", "다시 시도") }}</button>
    </div>
    <div v-else-if="!menu" class="status" role="status">{{ msg("sidebar.loading", "불러오는 중…") }}</div>

    <template v-else>
      <section v-show="activeTab === 'myOrganizationList'" class="pane" id="myOrganizationList">
        <input
          v-model="orgQuery"
          class="search-input org-search"
          type="text"
          autocomplete="off"
          :placeholder="msg('sidebar.searchPlaceholder', '검색할 이름')"
          @input="persistUiState"
        />
        <div v-if="noOrganizations" class="no-result">{{ msg("title.no.results", "결과 없음") }}</div>
        <ul v-else class="user-ul orgs">
          <li v-for="group in orgGroups" :key="group.key" class="org-li" :class="{ personal: group.personal }">
            <div class="org-row">
              <button class="org-list" type="button" :aria-expanded="expanded.has(group.key)" @click="toggleExpanded(group.key)">
                <span class="org-name">{{ group.org.name }}</span>
                <span class="sub-project-counter">{{ group.org.projects.length || "" }}</span>
              </button>
              <button
                v-if="!group.personal"
                class="star-org"
                type="button"
                :aria-pressed="group.org.favorite"
                :aria-label="msg('sidebar.favoriteOrganization', '조직 즐겨찾기')"
                @click="toggleOrganizationStar(group.org)"
              >
                <span class="star" :class="{ starred: group.org.favorite }">★</span>
              </button>
            </div>
            <ul class="project-ul">
              <li v-for="project in group.projects" :key="project.id" class="user-li">
                <a class="project-list" :href="project.href" :title="project.overview ?? undefined">
                  <span class="project-name">{{ project.name }}</span>
                </a>
                <button class="star-project" type="button" :aria-pressed="project.favorite" :aria-label="msg('sidebar.favoriteProject', '즐겨찾기')" @click="toggleProjectStar(project)">
                  <span class="star" :class="{ starred: project.favorite }">★</span>
                </button>
              </li>
            </ul>
          </li>
          <li v-for="project in etcFavorites" :key="`etc-${project.id}`" class="user-li etc-favorites">
            <a class="project-list" :href="project.href" :title="project.overview ?? undefined">
              <span class="project-name">{{ project.name }}</span>
              <span class="project-owner">{{ project.owner }}</span>
            </a>
            <button class="star-project" type="button" :aria-pressed="project.favorite" :aria-label="msg('sidebar.favoriteProject', '즐겨찾기')" @click="toggleProjectStar(project)">
              <span class="star" :class="{ starred: project.favorite }">★</span>
            </button>
          </li>
        </ul>
      </section>

      <section v-show="activeTab === 'myProjectList'" class="pane" id="myProjectList">
        <input
          v-model="projectQuery"
          class="search-input project-search"
          type="text"
          autocomplete="off"
          :placeholder="msg('sidebar.searchPlaceholder', '검색할 이름')"
          @input="persistUiState"
        />
        <div class="subtabs" role="tablist">
          <button
            v-for="sub in projectTabs"
            :key="sub.id"
            class="subtab"
            :class="{ active: projectTab === sub.id }"
            type="button"
            role="tab"
            :data-subtab="sub.id"
            :aria-selected="projectTab === sub.id"
            @click="selectProjectTab(sub.id)"
          >
            {{ sub.label }}
          </button>
        </div>
        <div v-if="projectRows.length === 0" class="no-result">{{ msg("title.no.results", "결과 없음") }}</div>
        <ul v-else class="user-ul">
          <li v-for="project in projectRows" :key="project.id" class="user-li">
            <a class="project-list" :href="project.href" :title="project.overview ?? undefined">
              <span class="project-name">{{ project.name }}</span>
              <span class="project-owner">{{ project.owner }}</span>
            </a>
            <button class="star-project" type="button" :aria-pressed="project.favorite" :aria-label="msg('sidebar.favoriteProject', '즐겨찾기')" @click="toggleProjectStar(project)">
              <span class="star" :class="{ starred: project.favorite }">★</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>

<style>
/* :host는 scoped 블록 안에서 [data-v-xxx]가 뒤에 붙어 무효화되므로 반드시 별도 non-scoped 블록에 둔다. */
:host {
  display: block;
}
</style>

<style scoped>
/* 테마는 CSS 변수로 받는다. 값은 기존 yona.css/usermenu.css의 .sidebar 계열 규칙과 같은 기본값이다. */
.sidebar {
  box-sizing: border-box;
  width: var(--yona-sidebar-width, 270px);
  background-color: var(--yona-sidebar-bg, #333333);
  color: var(--yona-sidebar-fg, white);
  border-right: 1px solid var(--yona-sidebar-border, black);
  min-height: 100%;
  font-size: 14px;
}
.sidebar[hidden] {
  display: none;
}
.tabs {
  display: flex;
}
.tab {
  background: transparent;
  border: none;
  padding: 8px 10px;
  color: var(--yona-sidebar-tab-fg, lightgray);
  cursor: pointer;
  font: inherit;
}
.tab:hover,
.tab.active {
  color: var(--yona-sidebar-accent, #f36c22);
  background-color: var(--yona-sidebar-tab-active-bg, black);
}
.pane {
  padding: 0 8px;
}
.search-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  margin: 8px 0 0;
  border: none;
  padding: 0 6px;
  font-size: 14px;
  background-color: var(--yona-sidebar-input-bg, black);
  color: var(--yona-sidebar-fg, white);
}
.search-input:focus {
  outline: 1px solid var(--yona-sidebar-search-accent, #e91e63);
}
.subtabs {
  display: flex;
  flex-wrap: wrap;
  padding: 10px 0 5px;
}
.subtab {
  background: transparent;
  border: none;
  padding: 2px 8px;
  color: var(--yona-sidebar-tab-fg, lightgray);
  cursor: pointer;
  font: inherit;
}
.subtab.active {
  color: var(--yona-sidebar-accent, #f36c22);
}
.user-ul {
  padding: 0;
  margin: 0 0 10px;
  list-style: none;
  overflow-y: auto;
  max-height: 80vh;
}
.project-ul {
  padding: 0;
  margin: 0;
  list-style: none;
}
.org-li {
  margin: 3px 0 8px;
}
.org-row,
.user-li {
  display: flex;
  align-items: center;
}
.org-list {
  flex: 1 1 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  padding: 1px 4px;
  background: transparent;
  border: none;
  color: var(--yona-sidebar-fg, white);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}
.org-name {
  color: var(--yona-sidebar-org, #00bcd4);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-project-counter {
  color: var(--yona-sidebar-muted, grey);
  font-size: 12px;
  font-weight: 400;
}
.user-li {
  line-height: normal;
}
.project-list {
  flex: 1 1 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  padding: 4px 0 4px 22px;
  color: var(--yona-sidebar-fg, white);
  text-decoration: none;
}
.project-list:hover,
.org-list:hover {
  background-color: var(--yona-sidebar-hover, rgba(255, 255, 255, 0.15));
  text-decoration: none;
}
.project-name {
  min-width: 50px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-owner {
  color: var(--yona-sidebar-muted, grey);
  padding: 0 10px;
  font-size: 12px;
  max-width: 50px;
  min-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.etc-favorites {
  border-top: 1px dashed gray;
}
.star-project,
.star-org {
  flex-shrink: 0;
  width: 29px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--yona-sidebar-star-off, #eeeeee);
}
.star {
  font-size: 16px;
}
.star.starred {
  color: var(--yona-sidebar-star-on, #e91e63);
}
.star-project:hover .star,
.star-org:hover .star {
  color: var(--yona-sidebar-star-on, #e91e63);
}
.no-result,
.status {
  color: var(--yona-sidebar-empty, mediumvioletred);
  text-align: center;
  margin: 10px 0 25px;
}
.error {
  padding: 12px;
  color: var(--yona-sidebar-empty, mediumvioletred);
  text-align: center;
}
.retry {
  margin-left: 6px;
  cursor: pointer;
}
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--yona-sidebar-accent, #f36c22);
  outline-offset: -2px;
}
</style>
