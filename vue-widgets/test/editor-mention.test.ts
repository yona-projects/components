// yona-markdown-editor 5단계(멘션) src/mention.ts 단위 테스트.
//
// commands.test.ts/preview.test.ts와 동일한 분리 원칙 - 순수 로직(트리거 감지/정렬/하이라이트/
// 이모지 필터)만 Node 환경에서 직접 검증한다. Shadow DOM 안에서 실제로 드롭다운이 뜨고 후보를
// 선택하는 동작 자체는 Playwright가 1차 검증 수단(계획서 5단계 절 참고).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMOJIS,
  MAX_QUERY_LEN,
  highlightMatch,
  sortUsersBySearchText,
  sortIssues,
  filterEmojis,
  matchMentionTrigger,
  userToCompletion,
  emojiToCompletion,
  issueToCompletion,
} from "../src/mention.js";

// ---------------------------------------------------------------------------
// matchMentionTrigger - 트리거 감지(requireLeadingSpace/allowSpaces:false/menuShowMinLength:0)
// ---------------------------------------------------------------------------

test("matchMentionTrigger: 줄 시작에서 트리거만 입력하면 빈 쿼리로 매칭된다(menuShowMinLength:0)", () => {
  assert.deepEqual(matchMentionTrigger("@", "@"), { from: 0, query: "" });
});

test("matchMentionTrigger: 공백 뒤 트리거는 매칭된다(requireLeadingSpace 충족)", () => {
  assert.deepEqual(matchMentionTrigger("hello @al", "@"), { from: 6, query: "al" });
});

test("matchMentionTrigger: 공백 없이 문자 바로 뒤에 오는 트리거는 매칭되지 않는다(이메일 주소 등 오인 방지)", () => {
  assert.equal(matchMentionTrigger("foo@bar", "@"), null);
});

test("matchMentionTrigger: 쿼리 중간에 공백이 있으면 마지막(공백 없는) 구간만 매칭된다(allowSpaces:false)", () => {
  // 첫 "@foo"는 뒤에 공백이 있어 커서(문자열 끝)까지 이어지지 않으므로 후보에서 제외되고,
  // 커서 바로 앞의 마지막 트리거(둘 다 requireLeadingSpace를 만족)만 매칭된다.
  assert.deepEqual(matchMentionTrigger("hi @foo bar @baz", "@"), { from: 12, query: "baz" });
});

test("matchMentionTrigger: 쿼리가 MAX_QUERY_LEN을 넘으면 null(atjs maxLen 이식)", () => {
  const longQuery = "a".repeat(MAX_QUERY_LEN + 1);
  assert.equal(matchMentionTrigger("@" + longQuery, "@"), null);
  const exactQuery = "a".repeat(MAX_QUERY_LEN);
  assert.notEqual(matchMentionTrigger("@" + exactQuery, "@"), null);
});

test("matchMentionTrigger: 트리거가 없으면 null", () => {
  assert.equal(matchMentionTrigger("hello world", "@"), null);
});

test("matchMentionTrigger: ':'/'#' 트리거도 동일 규칙으로 동작한다", () => {
  assert.deepEqual(matchMentionTrigger("good :sm", ":"), { from: 5, query: "sm" });
  assert.deepEqual(matchMentionTrigger("see #12", "#"), { from: 4, query: "12" });
  assert.equal(matchMentionTrigger("a#12", "#"), null);
});

// ---------------------------------------------------------------------------
// highlightMatch - atjs highlighter 이식
// ---------------------------------------------------------------------------

test("highlightMatch: 쿼리가 없으면 원본 그대로 반환한다", () => {
  assert.equal(highlightMatch("<b>abc</b>", ""), "<b>abc</b>");
});

test("highlightMatch: 마지막 필드를 포함해 일치 구간을 <strong>으로 감싼다(경계 조건)", () => {
  const result = highlightMatch("abc <small>xyz</small>", "xyz");
  assert.match(result, /<strong>xyz<\/strong>/);
});

test("highlightMatch: 대소문자 구분 없이 매칭된다", () => {
  const result = highlightMatch("Alice <small>alice</small>", "ALICE");
  assert.match(result, /<strong>Alice<\/strong>/);
});

// ---------------------------------------------------------------------------
// sortUsersBySearchText - "@" 트리거 커스텀 sorter
// ---------------------------------------------------------------------------

test("sortUsersBySearchText: 쿼리가 없으면 서버가 준 순서를 최대 10개까지 그대로 유지한다", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ searchText: `user${i}` }));
  const result = sortUsersBySearchText("", items);
  assert.equal(result.length, 10);
  assert.deepEqual(result, items.slice(0, 10));
});

test("sortUsersBySearchText: searchText 안에서 쿼리가 더 앞에 나오는 항목이 먼저 온다", () => {
  const items = [{ searchText: "zzzalice" }, { searchText: "alicezzz" }];
  const result = sortUsersBySearchText("alice", items);
  assert.deepEqual(result, [{ searchText: "alicezzz" }, { searchText: "zzzalice" }]);
});

test("sortUsersBySearchText: 매칭되지 않는 항목은 제외된다", () => {
  const items = [{ searchText: "alice" }, { searchText: "bob" }];
  assert.deepEqual(sortUsersBySearchText("alice", items), [{ searchText: "alice" }]);
});

// ---------------------------------------------------------------------------
// filterEmojis - ":" 트리거
// ---------------------------------------------------------------------------

test("filterEmojis: 쿼리가 없으면 배열 앞에서부터 10개를 반환한다", () => {
  const result = filterEmojis("");
  assert.equal(result.length, 10);
  assert.deepEqual(result, EMOJIS.slice(0, 10));
});

test("filterEmojis: 이름에 쿼리가 포함된 이모지만, 더 앞에서 매칭되는 순으로 반환한다", () => {
  const result = filterEmojis("face");
  assert.ok(result.length > 0);
  assert.ok(result.every((e) => e.name.toLowerCase().includes("face")));
  // "face smile"은 인덱스 0에서, 존재한다면 "some face"류는 더 뒤에서 매칭되므로 앞에 온다.
  assert.equal(result[0]?.name, "face smile");
});

test("filterEmojis: 내용(content)이 같아도 이름이 다른 항목은 서로 다른 독립 항목으로 유지된다(hooray/tada 중복 content)", () => {
  // EMOJIS 배열 자체에 content가 "🎉"로 동일하면서 name만 다른 두 항목(hooray/tada)이 있다 -
  // 이런 항목을 CM6 Completion으로 변환할 때 label을 비워두면 내부 dedup 로직에 걸려 하나가
  // 사라질 수 있다(mention.ts 상단 주석 참고) - emojiToCompletion이 label을 emoji name으로
  // 채워 이를 피한다. 여기서는 그 전제(두 항목이 배열 수준에서 실제로 별개임)를 확인한다.
  const hooray = EMOJIS.find((e) => e.name === "hooray");
  const tada = EMOJIS.find((e) => e.name === "tada");
  assert.ok(hooray && tada, "hooray/tada 항목이 존재해야 한다");
  assert.equal(hooray?.content, tada?.content);
  assert.notEqual(hooray, tada);

  assert.deepEqual(filterEmojis("hoo"), [hooray]);
  assert.deepEqual(filterEmojis("tada"), [tada]);
});

// ---------------------------------------------------------------------------
// sortIssues - "#" 트리거 커스텀 sorter
// ---------------------------------------------------------------------------

test("sortIssues: 쿼리가 없으면 원본 순서를 그대로 유지한다", () => {
  const items = [
    { issueNo: "3", title: "third" },
    { issueNo: "1", title: "first" },
  ];
  assert.deepEqual(sortIssues("", items), items);
});

test("sortIssues: issueNo가 정확히 일치하는 항목이 최우선으로 온다", () => {
  const items = [
    { issueNo: "123", title: "unrelated but has 12 in title" },
    { issueNo: "12", title: "exact" },
  ];
  const result = sortIssues("12", items);
  assert.equal(result[0]?.issueNo, "12");
});

test("sortIssues: 정확히 일치하지 않으면 issueNo/title 안에서 더 앞쪽에 나오는 항목이 우선한다", () => {
  const items = [
    { issueNo: "99", title: "abc 12 def" },
    { issueNo: "912", title: "zzz" },
  ];
  const result = sortIssues("12", items);
  // "912"는 issueNo 안에 "12"가 인덱스 1에서 발견되어(10^1=10) title 매칭(99)보다 우선한다.
  assert.equal(result[0]?.issueNo, "912");
});

// ---------------------------------------------------------------------------
// userToCompletion/emojiToCompletion/issueToCompletion - 저장형 XSS 방지(서버 응답값 이스케이프)
//
// 서버(MentionController.toMentionMaps/buildIssueMentionList)는 표시 이름/아바타 URL/이슈 제목을
// 이스케이프 없이 그대로 JSON으로 돌려준다(이 REST 엔드포인트는 HTML 렌더링 경로의 OWASP
// sanitizer를 거치지 않음). addToOptions 렌더러가 완성된 yonaHtml을 span.innerHTML에 그대로
// 꽂으므로(mention.ts), 이 함수들이 보간 시점에 각 필드를 이스케이프하지 않으면 표시 이름/이슈
// 제목에 담긴 태그가 멘션 후보를 띄우는 모든 사용자의 브라우저에서 그대로 실행된다.
// ---------------------------------------------------------------------------

test("userToCompletion: name/loginid에 담긴 HTML 태그가 이스케이프되어 실행 불가능한 텍스트로만 남는다", () => {
  const malicious = {
    loginid: "attacker",
    name: "<img src=x onerror=alert(1)>",
    image: "/avatar.png",
    searchText: "attacker",
  };
  const completion = userToCompletion(malicious, "");
  assert.ok(
    !completion.yonaHtml.includes("<img src=x onerror=alert(1)>"),
    `payload가 이스케이프 없이 그대로 남아있음: ${completion.yonaHtml}`,
  );
  assert.match(completion.yonaHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("userToCompletion: image(아바타 URL)의 홑따옴표를 이스케이프해 속성 탈출을 막는다", () => {
  const malicious = {
    loginid: "attacker",
    name: "Attacker",
    image: "x' onerror='alert(1)",
    searchText: "attacker",
  };
  const completion = userToCompletion(malicious, "");
  // 이스케이프 없이 원본 그대로 꽂히면 src='x' onerror='alert(1)' 형태로 속성이 깨져 나온다.
  assert.ok(
    !completion.yonaHtml.includes("src='x' onerror='alert(1)'"),
    `홑따옴표가 이스케이프되지 않아 속성이 깨짐: ${completion.yonaHtml}`,
  );
  assert.match(completion.yonaHtml, /src='x&#39; onerror=&#39;alert\(1\)'/);
});

test("userToCompletion: 이스케이프 대상 문자가 없는 정상 값은 기존과 동일하게 렌더링된다(회귀 방지)", () => {
  const normal = {
    loginid: "alice",
    name: "Alice Kim",
    image: "https://example.com/avatar.png",
    searchText: "alice",
  };
  const completion = userToCompletion(normal, "");
  assert.equal(
    completion.yonaHtml,
    "<img style='width:20px;height:20px;' src='https://example.com/avatar.png'> Alice Kim <small>alice</small>",
  );
});

test("issueToCompletion: title에 담긴 HTML 태그가 이스케이프된다", () => {
  const malicious = { issueNo: "42", title: "<img src=x onerror=alert(1)>" };
  const completion = issueToCompletion(malicious, "");
  assert.ok(
    !completion.yonaHtml.includes("<img src=x onerror=alert(1)>"),
    `payload가 이스케이프 없이 그대로 남아있음: ${completion.yonaHtml}`,
  );
  assert.match(completion.yonaHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("issueToCompletion: 정상 값은 기존과 동일하게 렌더링된다(회귀 방지)", () => {
  const normal = { issueNo: "42", title: "Fix login bug" };
  const completion = issueToCompletion(normal, "");
  assert.equal(completion.yonaHtml, "<small>#42</small> Fix login bug");
});

test("emojiToCompletion: EMOJIS 고정 배열은 실제로 안전하지만 방어적으로 동일한 이스케이프가 적용돼도 정상 값 렌더링은 그대로다(회귀 방지)", () => {
  const item = { name: "smile", content: "🙂" };
  const completion = emojiToCompletion(item, "");
  assert.equal(completion.yonaHtml, "🙂 <small>smile</small>");
});
