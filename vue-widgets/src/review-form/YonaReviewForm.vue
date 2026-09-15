<script setup lang="ts">
// yona.CodeCommentBox.js(+common/reviewForm.html)를 Vue 3 SFC로 다시 쓴 버전 - 페이지당
// 단 하나 존재하는 플로팅 코드리뷰 댓글 상자다. 처음엔 "위젯 경계가 아예 없다"고
// 판단했었다(diff 뷰 전체에 결합된 DOM 재배치 오케스트레이션 + 벤더 에디터 재마운트
// 트릭) - 다시 쪼개보니 둘 다 실제로는 풀리는 문제였다:
//
// 1. **DOM 재배치**(원본은 appendChild로 폼을 diff 테이블의 여러 위치로 옮김) -> Vue의
//    `<Teleport :to="...">`가 정확히 이 문제(상태에 따라 다른 위치에 렌더링)를 위한
//    선언적 기능이다. **핵심 발견**: Teleport로 이동한 콘텐츠는 이 컴포넌트의 Shadow
//    DOM 밖, 목적지의 진짜 라이트 DOM이 된다 - 그래서 다른 위젯들과 달리 review-form/
//    write-comment-box 등의 CSS를 이 컴포넌트 안에 이식할 필요가 전혀 없다(전역
//    yona.css를 그대로 상속받는다). 같은 이유로 `yona.code.Diff.js`의 전역 클릭
//    델리게이트(`weEvt.target.closest(".review-form")`)도 shadow 경계 문제 없이
//    그대로 작동한다.
// 2. **벤더 에디터 강제 재마운트**(`_remountEditor`가 매번 cloneNode로 새 인스턴스를
//    만듦 - 벤더 에디터가 disconnected/reconnected를 재초기화하지 않는 버그를 우회하기
//    위한 것)는 위젯 자체의 한계가 아니라 원본 vanilla 에디터의 버그를 우회하려던
//    것이었다 - 이미 만든 `<yona-markdown-editor-vue>`로 바꾸고 `:key`를 매 show()마다
//    바꿔주면(Vue가 알아서 완전히 새 인스턴스로 교체) 이 트릭 자체가 필요 없어진다
//    (GitHub 등처럼 "닫으면 초안을 버리고 다음엔 깨끗하게 시작"하는 원본의 의도된
//    동작과도 정확히 일치한다).
//
// 트리거 로직(언제/어디에 뜰지 결정, 드래그 선택으로 blockInfo 계산)은 `yona.code.Diff.js`
// (861줄, diff 렌더링) 소유라 건드리지 않는다 - toast/dialog와 동일한 패턴으로
// show(target, options)/hide()/toggle()/isVisible()/height()/offset() 공개 계약만
// 그대로 유지한다. 첨부파일 업로드 폼은 이미 만든 `<yona-attachments>`를 자식으로
// 그대로 재사용한다(사용자 승인 - 여러 컴포넌트가 서로 통신/조합해도 된다).
import { nextTick, onMounted, reactive, ref, useHost, useTemplateRef } from "vue";

interface ShowOptions {
  sPlacement?: string;
  htBlockInfo?: Record<string, unknown>;
}

interface ConfigureOptions {
  actionUrl?: string;
  avatarUrl?: string;
  profileUrl?: string;
  resourceType?: string;
  csrfParam?: string;
  csrfToken?: string;
}

const host = useHost();

type EditorHost = HTMLElement & { value: string };

const visible = ref(false);
const arrowClass = ref("arrow-top");
const teleportTarget = ref<HTMLElement | null>(null);
const hiddenFields = reactive<Record<string, string>>({});
const instanceKey = ref(0);
const actionUrl = ref("");
const avatarUrl = ref<string | undefined>(undefined);
const profileUrl = ref<string | undefined>(undefined);
const resourceType = ref<string | undefined>(undefined);
// 원본 th:action 폼은 Spring의 RequestDataValueProcessor + thymeleaf-spring6
// SpringActionTagProcessor가 _csrf 히든 필드를 자동으로 주입해줬다(layout.html의
// loginDialog 폼 주석 참고) - 순수 :action 바인딩인 이 폼은 그 자동 주입을 받지 못하므로
// 서버가 렌더링 시점에 이미 알고 있는 실제 토큰(${_csrf.parameterName}/${_csrf.token})을
// data-*로 그대로 넘겨받아 직접 히든 필드로 재현한다. 실대치 검증 중 실제 403으로 발견.
const csrfParam = ref<string | undefined>(undefined);
const csrfToken = ref<string | undefined>(undefined);

const wrapRef = useTemplateRef<HTMLDivElement>("wrapRef");
const editorRef = useTemplateRef<EditorHost>("editorRef");

// 이 show() 호출에서 새로 만든 임시 <tr class="comment-form">인지 추적한다(원본의
// `htElement.welCommentWrap.closest("tr.comment-form")` 탐색과 동일 목적 - 답글인
// 경우엔 기존 .comment-thread-wrap을 재사용하므로 지워서는 안 된다).
let createdTempRow: HTMLElement | null = null;

// 원본 _getReviewFormTarget/_prevUntilDataLine: welTarget에 thread-id도 data-line도
// 없으면(드래그 다중행 범위선택으로 만들어진 컨텍스트 없는 임시 대상) data-line을 가진
// 실제 diff 행을 거슬러 올라가 찾는다.
function getReviewFormTarget(target: HTMLElement): HTMLElement {
  if (!target.dataset.threadId && !target.dataset.line) {
    return prevUntilDataLine(target);
  }
  return target;
}

function prevUntilDataLine(target: HTMLElement): HTMLElement {
  let el = target.previousElementSibling as HTMLElement | null;
  while (el && !el.matches("tr[data-line]")) {
    el = el.previousElementSibling as HTMLElement | null;
  }
  return el || target;
}

// 원본 _getReviewFormPlace
function getReviewFormPlace(target: HTMLElement, placement: string): HTMLElement | null {
  if (target.dataset.threadId) {
    return target.closest(".comment-thread-wrap");
  }

  const tr = document.createElement("tr");
  tr.className = "comment-form";
  tr.innerHTML = '<td colspan="3" class="write-comment-form"></td>';

  if (placement === "top") {
    target.before(tr);
  } else {
    target.after(tr);
  }

  return tr;
}

// 원본 _getFormFieldsFromBlockInfo: CodeCommentBlock의 htBlockInfo(nStartLine/sStartSide/...)
// 필드명을 CodeRangeRequest가 기대하는 폼 필드명(startLine/startSide/...)으로 변환한다 -
// 헝가리안 접두문자(n/s/b) 한 글자를 떼고 그다음 글자를 소문자로 바꾼다.
function getFormFieldsFromBlockInfo(blockInfo: Record<string, unknown> | undefined): Record<string, string> {
  const data: Record<string, string> = {};
  if (!blockInfo) {
    return data;
  }
  const blockWords = ["bIsReversed", "sStartType", "sEndType", "sPathA", "sPathB", "sPrevCommitId", "sCommitId", "sFilePath"];

  Object.keys(blockInfo).forEach((key) => {
    if (blockWords.indexOf(key) > -1) {
      return;
    }
    const newKey = key.substring(1, 2).toLowerCase() + key.substring(2);
    data[newKey] = String(blockInfo[key]);
  });

  return data;
}

// 원본 _getReviewFormFieldData
function getReviewFormFieldData(target: HTMLElement, blockInfo?: Record<string, unknown>): Record<string, string> {
  return !target.dataset.threadId ? getFormFieldsFromBlockInfo(blockInfo) : { "thread.id": target.dataset.threadId ?? "" };
}

function getEditorTextarea(): HTMLTextAreaElement | null {
  return editorRef.value?.querySelector("textarea") ?? null;
}

// 원본 _show
function show(target: HTMLElement, options: ShowOptions = {}): void {
  const placement = (options.sPlacement || "bottom").toLowerCase();
  // 원본 _setArrowPlacement: 화살표는 welTarget과 반대쪽에 놓인다(bottom 배치면 위쪽에 화살표).
  arrowClass.value = placement === "top" ? "arrow-bottom" : "arrow-top";

  const formTarget = getReviewFormTarget(target);
  const formPlace = getReviewFormPlace(formTarget, placement);
  if (!formPlace) {
    return;
  }
  const writeCommentForm = formPlace.matches(".write-comment-form")
    ? formPlace
    : (formPlace.querySelector(".write-comment-form") as HTMLElement | null);
  if (!writeCommentForm) {
    return;
  }

  createdTempRow = formPlace.matches("tr.comment-form") ? formPlace : null;

  Object.keys(hiddenFields).forEach((key) => delete hiddenFields[key]);
  Object.assign(hiddenFields, getReviewFormFieldData(formTarget, options.htBlockInfo));

  teleportTarget.value = writeCommentForm;
  instanceKey.value++; // 매 show()마다 에디터/첨부파일을 완전히 새 인스턴스로 교체(원본의 cloneNode 재마운트 대응)
  visible.value = true;

  nextTick(() => {
    getEditorTextarea()?.focus();
  });

  window.dispatchEvent(new CustomEvent("CodeCommentBox:aftershow"));
}

// 원본 _hide
function hide(): void {
  visible.value = false;
  if (createdTempRow) {
    createdTempRow.remove();
    createdTempRow = null;
  }
  window.dispatchEvent(new CustomEvent("CodeCommentBox:afterhide"));
}

function toggle(target: HTMLElement, options?: ShowOptions): void {
  if (visible.value) {
    hide();
  } else {
    show(target, options);
  }
}

function isVisible(): boolean {
  return visible.value;
}

function height(): number {
  return wrapRef.value?.offsetHeight ?? 0;
}

function offset(): { top: number; left: number } {
  const rect = wrapRef.value?.getBoundingClientRect();
  if (!rect) {
    return { top: 0, left: 0 };
  }
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX };
}

function configure(options: ConfigureOptions): void {
  actionUrl.value = options.actionUrl ?? actionUrl.value;
  avatarUrl.value = options.avatarUrl ?? avatarUrl.value;
  profileUrl.value = options.profileUrl ?? profileUrl.value;
  resourceType.value = options.resourceType ?? resourceType.value;
  csrfParam.value = options.csrfParam ?? csrfParam.value;
  csrfToken.value = options.csrfToken ?? csrfToken.value;
}

// common/reviewForm.html이 이미 실제 currentUser/action/resourceType 데이터를 갖고
// 있으므로(서버 렌더링 시점) 어댑터가 별도로 넘겨줄 필요 없이 host 자신의 data-* 속성
// (스위치/드롭다운과 동일한 관례)에서 직접 읽는다 - configure()는 트리거 쪽(코드
// diff 화면)이 나중에 값을 갱신해야 하는 경우를 위해 그대로 열어둔다.
onMounted(() => {
  if (!host) return;
  configure({
    actionUrl: host.getAttribute("data-action") ?? undefined,
    avatarUrl: host.getAttribute("data-avatar-url") ?? undefined,
    profileUrl: host.getAttribute("data-profile-url") ?? undefined,
    resourceType: host.getAttribute("data-resource-type") ?? undefined,
    csrfParam: host.getAttribute("data-csrf-param") ?? undefined,
    csrfToken: host.getAttribute("data-csrf-token") ?? undefined,
  });
});

defineExpose({ show, hide, toggle, isVisible, height, offset, configure });
</script>

<template>
  <Teleport :to="teleportTarget" :disabled="!teleportTarget" v-if="visible && teleportTarget">
    <!-- yona.css의 `.review-form { display: none; }`는 원본이 show()에서
         welCommentWrap.style.display = "block"으로 덮어쓰던 것 - v-if만으로는 이
         전역 규칙을 이기지 못해 인라인 style로 그대로 재현한다. -->
    <div id="review-form" ref="wrapRef" class="review-form" :class="arrowClass" style="display: block">
      <form :action="actionUrl" method="post" enctype="multipart/form-data">
        <input v-if="csrfParam" type="hidden" :name="csrfParam" :value="csrfToken" />
        <input v-for="(value, name) in hiddenFields" :key="name" type="hidden" :name="name" :value="value" />
        <div v-if="avatarUrl" class="author-info-wrap pull-left hide-in-mobile">
          <div class="author-info">
            <a :href="profileUrl || '#'" target="_blank"><img :src="avatarUrl" width="32" height="32" /></a>
          </div>
        </div>
        <div class="write-comment-box">
          <div class="write-comment-wrap">
            <div class="pull-right">
              <button type="button" class="ybtn ybtn-default ybtn-small" data-toggle="close" @click="hide">&times;</button>
            </div>
            <yona-markdown-editor-vue
              :key="`editor-${instanceKey}`"
              ref="editorRef"
              name="contents"
              editor-mode="code-review-body"
              style="--yona-md-min-height: 100px"
            ></yona-markdown-editor-vue>
            <yona-attachments :key="`attachments-${instanceKey}`" :data-resource-type="resourceType"></yona-attachments>
            <div class="right-txt">
              <button type="button" class="ybtn ybtn-small" data-toggle="close" @click="hide">취소</button>
              <button type="submit" class="ybtn ybtn-success ybtn-small">댓글 등록</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  </Teleport>
</template>
