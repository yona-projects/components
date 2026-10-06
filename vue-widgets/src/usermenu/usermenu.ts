// 슬라이드 사이드바 데이터(GET /-_-api/v1/usermenu)의 타입과 순수 로직. DOM/Vue에 의존하지 않아 node:test로 검증한다.

export interface MenuProject {
  id: number;
  name: string;
  owner: string;
  overview: string | null;
  href: string;
  favorite: boolean;
}

export interface MenuOrganization {
  id: number;
  name: string;
  favorite: boolean;
  projects: MenuProject[];
}

export interface MenuIssue {
  title: string;
  href: string;
}

export interface UserMenu {
  loginId: string;
  personal: MenuProject[];
  favoriteOrganizations: MenuOrganization[];
  organizations: MenuOrganization[];
  favoriteProjects: MenuProject[];
  recentlyVisited: MenuProject[];
  createdByMe: MenuProject[];
  watching: MenuProject[];
  joinmember: MenuProject[];
  visitedIssues: MenuIssue[];
}

const PROJECT_LISTS = ["personal", "favoriteProjects", "recentlyVisited", "createdByMe", "watching", "joinmember"] as const;
const ORGANIZATION_LISTS = ["favoriteOrganizations", "organizations"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProject(raw: unknown): MenuProject | null {
  if (!isObject(raw) || typeof raw.id !== "number" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    owner: typeof raw.owner === "string" ? raw.owner : "",
    overview: typeof raw.overview === "string" ? raw.overview : null,
    href: typeof raw.href === "string" ? raw.href : "#",
    favorite: raw.favorite === true,
  };
}

function toProjects(raw: unknown): MenuProject[] {
  return Array.isArray(raw) ? raw.map(toProject).filter((p): p is MenuProject => p !== null) : [];
}

function toOrganizations(raw: unknown): MenuOrganization[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o) =>
    isObject(o) && typeof o.id === "number" && typeof o.name === "string"
      ? [{ id: o.id, name: o.name, favorite: o.favorite === true, projects: toProjects(o.projects) }]
      : [],
  );
}

function toIssues(raw: unknown): MenuIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) =>
    isObject(i) && typeof i.title === "string" && typeof i.href === "string" ? [{ title: i.title, href: i.href }] : [],
  );
}

// 서버 응답이 어떤 모양이든 컴포넌트가 깨지지 않도록 항상 완전한 UserMenu로 만든다.
export function normalizeMenu(raw: unknown): UserMenu {
  const source = isObject(raw) ? raw : {};
  return {
    loginId: typeof source.loginId === "string" ? source.loginId : "",
    personal: toProjects(source.personal),
    favoriteOrganizations: toOrganizations(source.favoriteOrganizations),
    organizations: toOrganizations(source.organizations),
    favoriteProjects: toProjects(source.favoriteProjects),
    recentlyVisited: toProjects(source.recentlyVisited),
    createdByMe: toProjects(source.createdByMe),
    watching: toProjects(source.watching),
    joinmember: toProjects(source.joinmember),
    visitedIssues: toIssues(source.visitedIssues),
  };
}

export function matchesQuery(text: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  return q === "" || text.toLowerCase().includes(q);
}

export function filterProjects(projects: MenuProject[], query: string): MenuProject[] {
  return projects.filter((p) => matchesQuery(`${p.name} ${p.owner}`, query));
}

// 조직 이름이 일치하면 소속 프로젝트를 전부 유지하고, 프로젝트만 일치하면 일치하는 프로젝트만 남긴다.
export function filterOrganizations(orgs: MenuOrganization[], query: string): MenuOrganization[] {
  if (query.trim() === "") return orgs;
  return orgs.flatMap((o) => {
    if (matchesQuery(o.name, query)) return [o];
    const projects = filterProjects(o.projects, query);
    return projects.length > 0 ? [{ ...o, projects }] : [];
  });
}

// 조직(개인 영역 포함)은 접힌 상태에서 즐겨찾기 프로젝트만 보여주고, 펼치면 전부 보여준다.
// isPinned로 "기본 노출" 기준을 바꿀 수 있다. 화면에서는 로드 시점의 즐겨찾기 스냅샷을 넘겨, 별을 눌러 해제해도 그 항목이 즉시 사라지지 않게 한다.
export function visibleOrgProjects(
  org: MenuOrganization,
  expanded: boolean,
  isPinned: (project: MenuProject) => boolean = (p) => p.favorite,
): MenuProject[] {
  return expanded ? org.projects : org.projects.filter(isPinned);
}

// 같은 프로젝트가 여러 목록에 나타나므로 모든 곳의 favorite을 함께 바꾼다. 원본은 변경하지 않는다.
export function applyFavorite(menu: UserMenu, projectId: number, favorite: boolean): UserMenu {
  const mark = (p: MenuProject): MenuProject => (p.id === projectId ? { ...p, favorite } : p);
  const next: UserMenu = { ...menu };
  for (const key of PROJECT_LISTS) next[key] = menu[key].map(mark);
  for (const key of ORGANIZATION_LISTS) next[key] = menu[key].map((o) => ({ ...o, projects: o.projects.map(mark) }));
  return next;
}

// 조직 즐겨찾기 토글 결과를 반영한다. 목록 간 이동은 하지 않고(다음 로드에서 재배치) 표시 상태만 바꾼다.
export function applyOrganizationFavorite(menu: UserMenu, organizationId: number, favorite: boolean): UserMenu {
  const mark = (o: MenuOrganization): MenuOrganization => (o.id === organizationId ? { ...o, favorite } : o);
  return {
    ...menu,
    favoriteOrganizations: menu.favoriteOrganizations.map(mark),
    organizations: menu.organizations.map(mark),
  };
}
