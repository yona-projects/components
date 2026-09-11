// yona-markdown-editor 5단계(멘션) - @codemirror/autocomplete 기반 재구현.
//
// 옛 yobi.Mention.js(atjs -> Tribute.js 이식판, common/yobi.Mention.js)의 순수 로직(이모지 배열,
// 커스텀 정렬 알고리즘, 하이라이트 로직)은 CM API와 무관하므로 그대로(동치) 이식했다 -
// menuItemTemplate/selectTemplate만 @codemirror/autocomplete의 Completion 객체 형식에 맞는
// 어댑터로 새로 작성한다(계획서 5단계 절 참고).
//
// 착수 전 조사한 @codemirror/autocomplete API 요약(6.20.3, node_modules 소스 직접 확인):
// - Completion에는 Tribute의 menuItemTemplate에 대응하는 "renderOption" 같은 필드가 없다. 대신
//   CompletionConfig.addToOptions(render(completion, state, view) => Node, position)로 완전히
//   자유로운 DOM을 각 옵션 행에 주입할 수 있다(아이콘 20/라벨 50/detail 80과 같은 좌표 공간을
//   공유). 기본 라벨(label/displayLabel 텍스트, position 50)은 이 옵션과 무관하게 항상 그려지므로,
//   완전한 커스텀 렌더링을 원하면 CSS로 `.cm-completionLabel`을 숨기고 addToOptions로 실제 내용을
//   대체한다(아래 MENTION_STYLES) - Tribute의 menuItemTemplate이 <li> 내부를 통째로 대체하던 것과
//   동일한 자유도를 얻는다.
// - CompletionResult.filter=false로 두면 라이브러리의 퍼지 매칭/정렬을 끄고 우리가 넘긴 순서를
//   그대로 쓴다(옛 커스텀 sorter를 그대로 재사용하기 위해 필수). label을 사람이 읽는 고유 키(예:
//   loginid/emoji 이름/issueNo)로 채워두면 내부 dedup 로직(연속된 동일 label+detail+apply 옵션을
//   병합)에 걸리지 않는다 - 실제로 이모지 배열에 content가 같고 name이 다른 항목(예: "hooray"/
//   "tada" 둘 다 🎉)이 있어 label을 전부 비워두면 이 dedup에 걸려 하나가 사라진다는 것을 소스
//   레벨에서 직접 확인했다.
// - CompletionSource가 promise를 반환하면 CM6가 알아서 이전 키 입력에 대한 오래된 응답을
//   버린다(query.updates를 replay해 validFor 없는 결과는 자동으로 무효화 + 재조회) - 4단계
//   PreviewController처럼 직접 순번을 매길 필요가 없다. 다만 "@"의 300ms debounce(요청 자체를
//   지연시켜 서버 부하를 줄이는 것)는 CM6가 대신해주지 않으므로 CompletionContext.addEventListener
//   ("abort", ..., {onDocChange:true})로 옛 clearTimeout(searchPending)과 동일한 효과를 낸다.
// - autocompletion()의 tooltip DOM은 기본값(config.parent 미지정)일 때 view.dom의 자식으로
//   붙는다(node_modules 소스 확인) - 즉 우리 Shadow DOM 안에 그대로 붙으므로 이 파일이 내보내는
//   MENTION_STYLES를 컴포넌트의 shadow <style>에 얹기만 하면 별도 처리 없이 스코프가 맞는다.
import type { Completion, CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

// ---------------------------------------------------------------------------
// yobi.Mention.js 순수 로직 그대로 이식 (이모지 배열 / MAX_QUERY_LEN / 하이라이트 / 정렬)
// ---------------------------------------------------------------------------

export interface EmojiItem {
  name: string;
  content: string;
}

// yobi.Mention.js의 emojis 배열 그대로(순서/내용 변경 없음).
export const EMOJIS: readonly EmojiItem[] = [
  { name: "+1", content: "👍" },
  { name: "heart", content: "❤️️" },
  { name: "wink", content: "😘" },
  { name: "smile", content: "🙂" },
  { name: "confused", content: "😕" },
  { name: "check", content: "✅" },
  { name: "hooray", content: "🎉" },
  { name: "sad", content: "😢" },
  { name: "-1", content: "👎" },
  { name: "tada", content: "🎉" },
  { name: "x", content: "❌" },
  { name: "o", content: "⭕" },
  { name: "face smile", content: "😄" },
  { name: "face smile kiss", content: "😙" },
  { name: "face kissing", content: "😗" },
  { name: "face astonished", content: "😲" },
  { name: "face angry", content: "😠" },
  { name: "face scream", content: "😱" },
  { name: "face cry", content: "😢" },
  { name: "face neutral", content: "😐" },
  { name: "face heart", content: "😍" },
  { name: "question?", content: "❓" },
  { name: "!", content: "❗️" },
  { name: "bangbang!", content: "‼️" },
  { name: "beer", content: "🍺" },
  { name: "icecream", content: "🍦" },
  { name: "korea", content: "🇰🇷" },
  { name: "us america", content: "🇺🇸" },
  { name: "fr", content: "🇫🇷" },
  { name: "cn china", content: "🇨🇳" },
  { name: "+100", content: "💯" },
  { name: "heavy check", content: "✔️" },
  { name: "+plus", content: "➕" },
  { name: "-minus", content: "➖️" },
  { name: "cactus", content: "🌵️" },
  { name: "animal cat", content: "🐈" },
  { name: "clover", content: "🍀" },
  { name: "v️", content: "✌️" },
  { name: "lock", content: "🔒" },
  { name: "unlock", content: "🔓" },
  { name: "idea bulb", content: "💡" },
  { name: "bomb", content: "💣" },
  { name: "calendar", content: "📆" },
  { name: "date", content: "📅" },
  { name: "chicken", content: "🐔" },
  { name: "mushroom", content: "🍄" },
  { name: "moneybag", content: "💰" },
  { name: "money dollar", content: "💵" },
  { name: "envelope", content: "✉️" },
  { name: "chart upward", content: "📈" },
  { name: "chart downward", content: "📉" },
  { name: "택배 parcel", content: "📦" },
  { name: "박수 clap", content: "👏" },
  { name: "game joker", content: "🃏" },
  { name: "game cards", content: "🎴" },
  { name: "game die", content: "🎲" },
  { name: "tea", content: "🍵" },
  { name: "coffee", content: "☕" },
  { name: "crystal", content: "🔮" },
  { name: "taxi", content: "🚕" },
  { name: "bus", content: "🚌" },
  { name: "train", content: "🚋" },
  { name: "warn", content: "⚠️" },
  { name: "star", content: "⭐" },
  { name: "phone", content: "☎️" },
];

// atjs DEFAULT_CALLBACKS.matcher의 maxLen(기본값 20) 이식 - yobi.Mention.js와 동일.
export const MAX_QUERY_LEN = 20;

/**
 * atjs DEFAULT_CALLBACKS.highlighter 이식(yobi.Mention.js `_highlight` 그대로) - 렌더링될
 * innerHTML 문자열에서 query와 일치하는 첫 구간을 <strong>으로 감싼다. 경계 조건(마지막 필드도
 * 하이라이트되도록 <li>로 감쌌다 벗기는 트릭)까지 원본과 동일하게 유지한다.
 */
export function highlightMatch(innerHtml: string, query: string): string {
  if (!query) {
    return innerHtml;
  }
  const wrapped = "<li>" + innerHtml + "</li>";
  const regexp = new RegExp(">\\s*([^<]*?)(" + query.replace("+", "\\+") + ")([^<]*)\\s*<", "ig");
  const replaced = wrapped.replace(regexp, (_str, p1: string, p2: string, p3: string) => "> " + p1 + "<strong>" + p2 + "</strong>" + p3 + " <");
  return replaced.slice("<li>".length, replaced.length - "</li>".length);
}

/**
 * "@" 트리거용 atjs DEFAULT_CALLBACKS.sorter 이식(yobi.Mention.js `_sortBySearchText`, searchKey=
 * "searchText"). 원본은 매칭 대상 아이템에 atwho_order를 직접 대입(mutate)했지만, 여기서는 부수
 * 효과 없이 동일한 정렬 결과를 내도록 래핑했다 - 순서/컷오프(상위 10개) 동작은 동치.
 */
export function sortUsersBySearchText<T extends { searchText: string }>(query: string, items: readonly T[]): T[] {
  if (!query) {
    return items.slice(0, 10);
  }
  const scored: { item: T; order: number }[] = [];
  for (const item of items) {
    const order = String(item.searchText).toLowerCase().indexOf(query.toLowerCase());
    if (order > -1) {
      scored.push({ item, order });
    }
  }
  scored.sort((a, b) => a.order - b.order);
  return scored.slice(0, 10).map((s) => s.item);
}

/**
 * ":" 트리거(이모지) - 원격 검색 없이 로컬 배열을 필터링/정렬한다(yobi.Mention.js
 * `_fetchEmojis`의 필터/정렬 부분만 순수 함수로 분리 - debounce/콜백 껍데기는 CM 어댑터 쪽 책임).
 */
export function filterEmojis(query: string): EmojiItem[] {
  if (!query) {
    return EMOJIS.slice(0, 10);
  }
  const q = query.toLowerCase();
  const scored: { item: EmojiItem; order: number }[] = [];
  for (const item of EMOJIS) {
    const order = item.name.toLowerCase().indexOf(q);
    if (order > -1) {
      scored.push({ item, order });
    }
  }
  scored.sort((a, b) => a.order - b.order);
  return scored.slice(0, 10).map((s) => s.item);
}

/**
 * "#" 트리거용 yobi.Mention.js `_sortIssues` 그대로 이식(atjs 시절 커스텀 sorter) - 정확히
 * 일치하는 issueNo를 최우선으로, 그 외엔 issueNo/title 내 인덱스 위치 기반 가중치로 정렬한다.
 * 원본과 동일하게 mutate하지 않는 형태로만 다시 썼다(정렬 공식은 100% 동일).
 */
export function sortIssues<T extends { issueNo: string; title: string }>(query: string, items: readonly T[]): T[] {
  if (!query) {
    return items.slice();
  }
  const scored = items.map((item, i) => {
    let order: number;
    if (item.issueNo === query) {
      order = 0;
    } else {
      const issueNoIndexOf = item.issueNo.toLowerCase().indexOf(query.toLowerCase());
      order =
        i +
        1 +
        Math.pow(10, issueNoIndexOf) +
        (issueNoIndexOf > -1 ? 0 : Math.pow(100, item.title.toLowerCase().indexOf(query.toLowerCase())));
    }
    return { item, order };
  });
  scored.sort((a, b) => a.order - b.order);
  return scored.map((s) => s.item);
}

// ---------------------------------------------------------------------------
// 트리거 감지 (순수 로직 - "@"/"#"/":" requireLeadingSpace/allowSpaces:false/menuShowMinLength:0을
// Tribute 없이 직접 재현한다. CM의 CompletionContext에 의존하지 않아 문자열만으로 단위 테스트한다.)
// ---------------------------------------------------------------------------

export interface TriggerMatch {
  /** textBeforeCursor 안에서 트리거 문자가 시작하는 오프셋. */
  from: number;
  /** 트리거 문자 다음에 이어지는 텍스트(빈 문자열이면 트리거만 입력된 상태 - menuShowMinLength:0). */
  query: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 같은 줄에서 커서 바로 앞까지의 텍스트(textBeforeCursor)를 받아, 공백으로 끊기지 않고 trigger로
 * 시작해 문자열 끝(=커서 위치)까지 이어지는 마지막 구간을 찾는다(allowSpaces:false). 그 구간
 * 직전이 공백이거나 줄의 시작이어야 매칭으로 인정한다(requireLeadingSpace:true - 이메일 주소
 * 중간의 "@" 등을 트리거로 오인하지 않기 위한 atjs/Tribute 시절 규칙 그대로). 쿼리가
 * MAX_QUERY_LEN을 넘으면 null(메뉴 닫힘, atjs maxLen 이식).
 */
export function matchMentionTrigger(textBeforeCursor: string, trigger: string): TriggerMatch | null {
  const regex = new RegExp(escapeRegExp(trigger) + "([^\\s]*)$");
  const match = regex.exec(textBeforeCursor);
  if (!match) {
    return null;
  }
  const from = match.index;
  const charBefore = from > 0 ? textBeforeCursor[from - 1] : undefined;
  if (charBefore !== undefined && !/\s/.test(charBefore)) {
    return null;
  }
  const query = match[1] ?? "";
  if (query.length > MAX_QUERY_LEN) {
    return null;
  }
  return { from, query };
}

// ---------------------------------------------------------------------------
// CM 어댑터 - Completion 객체 생성 + CompletionSource + autocompletion() 확장 조립.
// ---------------------------------------------------------------------------

/** Tribute의 item.original을 대신해, menuItemTemplate에 해당하는 완성된(하이라이트 적용) HTML을
 * 옵션마다 실어 나른다. addToOptions 렌더러가 이 필드를 그대로 innerHTML에 꽂는다. */
interface YonaMentionCompletion extends Completion {
  yonaHtml: string;
}

function isYonaMentionCompletion(completion: Completion): completion is YonaMentionCompletion {
  return typeof (completion as { yonaHtml?: unknown }).yonaHtml === "string";
}

export interface MentionProgressLike {
  start(): void;
  done(): void;
}

export interface MentionFetchOptions {
  /** 테스트/컴포넌트 양쪽에서 주입 가능 - 기본값은 전역(패치된) fetch. */
  fetchImpl?: typeof fetch;
  /** yobi.Mention.js의 NProgress.start()/done() 대응 - 전역 NProgress가 있을 때만 호출한다
   * (컴포넌트가 yona 사이트 전역에 하드 의존하지 않도록 preview.ts의 getHljs와 동일한 패턴). */
  getProgress?: () => MentionProgressLike | undefined;
}

interface ResolvedMentionFetchOptions {
  fetchImpl: typeof fetch;
  getProgress: () => MentionProgressLike | undefined;
}

function resolveFetchOptions(options: MentionFetchOptions): ResolvedMentionFetchOptions {
  return {
    fetchImpl: options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
    getProgress:
      options.getProgress ??
      (() => (typeof window !== "undefined" ? (window as unknown as { NProgress?: MentionProgressLike }).NProgress : undefined)),
  };
}

interface UserMentionItem {
  loginid: string;
  name: string;
  image: string;
  searchText: string;
}

interface IssueMentionItem {
  issueNo: string;
  title: string;
}

async function fetchUserMentions(
  url: string,
  query: string,
  opts: ResolvedMentionFetchOptions,
): Promise<UserMentionItem[]> {
  const progress = opts.getProgress();
  progress?.start();
  try {
    const qs = new URLSearchParams({ query, mentionType: "user" });
    const response = await opts.fetchImpl(`${url}?${qs.toString()}`);
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { result?: UserMentionItem[] };
    return sortUsersBySearchText(query, data.result ?? []);
  } catch {
    return [];
  } finally {
    progress?.done();
  }
}

async function fetchIssueMentions(
  url: string,
  query: string,
  opts: ResolvedMentionFetchOptions,
): Promise<IssueMentionItem[]> {
  const progress = opts.getProgress();
  progress?.start();
  try {
    const qs = new URLSearchParams({ query, mentionType: "issue" });
    const response = await opts.fetchImpl(`${url}?${qs.toString()}`);
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { result?: IssueMentionItem[] };
    return sortIssues(query, data.result ?? []).slice(0, 10);
  } catch {
    return [];
  } finally {
    progress?.done();
  }
}

function userToCompletion(item: UserMentionItem, query: string): YonaMentionCompletion {
  const html = `<img style='width:20px;height:20px;' src='${item.image}'> ${item.name} <small>${item.loginid}</small>`;
  return {
    label: item.loginid,
    apply: `@${item.loginid} `,
    yonaHtml: highlightMatch(html, query),
  };
}

function emojiToCompletion(item: EmojiItem, query: string): YonaMentionCompletion {
  const html = `${item.content} <small>${item.name}</small>`;
  return {
    label: item.name,
    apply: `${item.content} `,
    yonaHtml: highlightMatch(html, query),
  };
}

function issueToCompletion(item: IssueMentionItem, query: string): YonaMentionCompletion {
  const html = `<small>#${item.issueNo}</small> ${item.title}`;
  return {
    label: item.issueNo,
    apply: `#${item.issueNo} `,
    yonaHtml: highlightMatch(html, query),
  };
}

/** trigger 문자 하나에 대한 CompletionSource 뼈대 - textBeforeCursor 계산(같은 줄 한정, 원본과
 * 동일 범위)만 CM 쪽에서 하고 나머지는 matchMentionTrigger(순수 함수)에 위임한다. */
function createTriggerSource(
  trigger: string,
  buildResult: (
    query: string,
    from: number,
    context: CompletionContext,
  ) => CompletionResult | null | Promise<CompletionResult | null>,
): CompletionSource {
  return (context: CompletionContext) => {
    const line = context.state.doc.lineAt(context.pos);
    const textBeforeCursor = line.text.slice(0, context.pos - line.from);
    const match = matchMentionTrigger(textBeforeCursor, trigger);
    if (!match) {
      return null;
    }
    return buildResult(match.query, line.from + match.from, context);
  };
}

/** ":" 트리거 - 로컬 배열 필터링뿐이라 debounce가 필요 없다(원본과 동일). */
function createEmojiSource(): CompletionSource {
  return createTriggerSource(":", (query, from) => {
    const items = filterEmojis(query);
    return { from, options: items.map((item) => emojiToCompletion(item, query)), filter: false };
  });
}

/**
 * "@" 트리거 - yobi.Mention.js의 300ms debounce(clearTimeout(searchPending))를 그대로 재현한다.
 * CompletionContext.addEventListener("abort", ..., {onDocChange:true})를 등록해두면, 이 쿼리가
 * 아직 완료되기 전에 문서가 또 바뀔 때(=사용자가 계속 타이핑 중일 때) CM6가 이 핸들러를 불러준다
 * - 여기서 예약된 setTimeout을 취소해 실제 네트워크 요청 자체가 나가지 않도록 막는다(원본의
 * clearTimeout과 동일한 효과 - 마지막 300ms 정지 구간에서만 실제 fetch가 나간다).
 */
function createUserMentionSource(getMentionUrl: () => string | null, opts: ResolvedMentionFetchOptions): CompletionSource {
  return createTriggerSource("@", (query, from, context) => {
    const url = getMentionUrl();
    if (!url) {
      return null;
    }
    return new Promise<CompletionResult | null>((resolve) => {
      let cancelled = false;
      const timer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        fetchUserMentions(url, query, opts).then((items) => {
          if (cancelled) {
            return;
          }
          resolve({ from, options: items.map((item) => userToCompletion(item, query)), filter: false });
        });
      }, 300);
      context.addEventListener(
        "abort",
        () => {
          cancelled = true;
          clearTimeout(timer);
          resolve(null);
        },
        { onDocChange: true },
      );
    });
  });
}

/** "#" 트리거 - yobi.Mention.js `_fetchIssueMentions`와 동일하게 debounce 없이 매 키 입력마다
 * 조회한다("@"와 다른 점 - 원본 코드 그대로 유지). */
function createIssueMentionSource(getMentionUrl: () => string | null, opts: ResolvedMentionFetchOptions): CompletionSource {
  return createTriggerSource("#", async (query, from) => {
    const url = getMentionUrl();
    if (!url) {
      return null;
    }
    const items = await fetchIssueMentions(url, query, opts);
    return { from, options: items.map((item) => issueToCompletion(item, query)), filter: false };
  });
}

export interface MentionExtensionOptions extends MentionFetchOptions {
  /** markdownEditor 프래그먼트의 data-mention-url(프로젝트 스코프가 없는 화면은 null - "@"/"#"는
   * 조용히 비활성화되고 ":"(이모지)만 동작한다는 뜻이 아니라, 이 확장 자체를 아예 등록하지 않는
   * 것으로 처리한다 - YonaMarkdownEditor.ts가 mentionUrl이 없으면 이 확장을 extensions 배열에
   * 넣지 않는다. 옛 yobi.Mention()이 페이지당 한 번만 호출되어 "@"/":"/"#" 3개를 한꺼번에 켜거나
   * 아예 안 켜던 것과 동일한 all-or-nothing 단위를 유지하기 위함). */
  getMentionUrl: () => string | null;
}

/** yona-markdown-editor의 멘션 자동완성 확장 - @/:/# 3트리거를 override로 등록한다. */
export function createMentionExtension(options: MentionExtensionOptions): Extension {
  const opts = resolveFetchOptions(options);
  return autocompletion({
    override: [
      createUserMentionSource(options.getMentionUrl, opts),
      createEmojiSource(),
      createIssueMentionSource(options.getMentionUrl, opts),
    ],
    // CM6 자체의 "타이핑 후 대기" 지연을 0으로 둔다 - "@"의 300ms 지연은 createUserMentionSource가
    // 이미 책임지고, "#"/":"쪽은 원본처럼 지연이 아예 없어야 하므로 이 레이어에서 추가 지연을
    // 얹지 않는다(둘 다 필요하면 4~500ms처럼 이중 지연이 되어 원본 타이밍과 어긋난다).
    activateOnTypingDelay: 0,
    // 기본 타입 아이콘(class/function/... 용)은 쓰지 않는다 - 아래 addToOptions가 완전한 커스텀
    // 마크업(아바타/이모지/이슈배지)을 직접 그린다.
    icons: false,
    addToOptions: [
      {
        render: (completion) => {
          if (!isYonaMentionCompletion(completion)) {
            return null;
          }
          const span = document.createElement("span");
          span.className = "yona-mention-option";
          span.innerHTML = completion.yonaHtml;
          return span;
        },
        position: 30,
      },
    ],
  });
}

/** 컴포넌트 shadow <style>에 얹을 멘션 드롭다운 최소 스타일. 옛 tribute.min.css/atwho 쪽
 * 사이트별 오버라이드가 yobi.css에 전혀 없었으므로(직접 grep으로 확인 - 서드파티 기본 CSS를
 * 그대로 썼음) 3~4단계(툴바/미리보기)처럼 픽셀 단위로 재현할 대상 자체가 없다. CM6 기본
 * 드롭다운 테마(위 baseTheme, Shadow DOM 안에 자동 mount됨) 위에 이 컴포넌트의 --yona-md-*
 * 색상 토큰과 어울리도록 최소한의 손질만 더한다. */
export const MENTION_STYLES = `
.cm-completionLabel {
  display: none;
}
.yona-mention-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.yona-mention-option img {
  border-radius: 3px;
  vertical-align: middle;
}
.yona-mention-option small {
  opacity: 0.65;
  margin-left: 4px;
}
.yona-mention-option strong {
  color: var(--yona-md-accent-color, #51AACC);
  font-weight: 700;
}
`;
