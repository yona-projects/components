<script setup lang="ts">
// yona.LoginDialog.js를 Vue 3 SFC로 다시 쓴 버전 - 익명 사용자에게만 렌더링되는
// site/layout.html의 #loginDialog(네이티브 <dialog>)다.
//
// **핵심 설계 결정**: 이 다이얼로그는 review-form과 달리 다른 위치로 옮겨 다닐
// 필요가 없다(항상 화면 중앙에 고정). 그런데도 <Teleport to="body">를 그대로
// 썼다 - review-form에서 발견한 부수 효과(Teleport 목적지는 컴포넌트의 Shadow DOM
// 밖, 진짜 라이트 DOM이 된다)를 이번엔 "동적 위치 이동"이 아니라 "CSS 포팅 회피"
// 목적으로 의도적으로 재사용한 것이다 - 원본은 `.modal`(bootstrap.css)/`.loginDialog`/
// `.login-form-wrap`/`.frm-wrap`/`.ybtn`/`.oauth-login-btn`/`.auth-provider-logo`/
// `.yona-shake` 등 15개 이상의 전역 클래스에 기대는 폼이라, Shadow DOM에 그대로
// 두면(Dialog/Toast/Switch처럼) 전부 이식해야 했다 - Teleport로 옮기면 전역
// yona.css/bootstrap.css를 그대로 상속받아 포팅이 전혀 필요 없다(review-form 이후
// 두 번째로 <style> 블록이 아예 없는 위젯).
//
// **CSRF 재검증(이전 조사에서 review-form과 같은 403 함정을 예상했으나 실제로는
// 아니었다)**: 원본이 th:action 폼(자동 CSRF 히든 필드 주입)을 쓴 이유는 폼
// 자체가 "익명 사용자에게 sitewide로 렌더링되는 유일한 순수 HTML action= 서버
// 렌더링 폼"이었기 때문이라고 원본 주석에 적혀 있지만, 실제 제출 로직
// (`_onSubmitForm`)은 네이티브 폼 제출이 아니라 `preventDefault()` 후 `fetch()`로
// 직접 POST한다 - `site/layout.html`의 전역 `window.fetch` 몽키패치(스크립트
// 로드 순서상 yona.LoginDialog.js보다 먼저 실행됨)가 XSRF-TOKEN 쿠키를
// X-XSRF-TOKEN 헤더로 이미 자동 첨부해주므로 CSRF 히든 필드 자체가 애초에
// 불필요했다 - 이 컴포넌트도 동일하게 fetch()로 제출하면 그만이다.
import { onMounted, ref, useHost, useTemplateRef } from "vue";

declare function Messages(key: string): string;

const host = useHost();

const actionUrl = ref("/users/login");
const useSocialLoginOnly = ref(false);

const loginIdOrEmail = ref("");
const password = ref("");
const rememberMe = ref(true);
const errorVisible = ref(false);
const errorMessage = ref("");

const dialogRef = useTemplateRef<HTMLDialogElement>("dialogRef");
const inputIdRef = useTemplateRef<HTMLInputElement>("inputIdRef");

function msg(key: string, fallback: string): string {
  return (typeof Messages === "function" ? Messages(key) : "") || fallback;
}

function isInputElement(el: EventTarget | null): boolean {
  const tagName = (el as HTMLElement | null)?.tagName?.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA";
}

// 원본 _showDialog: 트리거 엘리먼트가 입력창이면 blur()로 포커스를 뺀다(모달
// 뒤에서 포커스 링이 남는 것 방지) - 원본은 이 판단을 클릭 이벤트 핸들러
// 안에서 했지만, 트리거 델리게이트는 여전히 페이지(어댑터) 소유이므로
// show()가 트리거 엘리먼트를 선택적으로 받아 동일한 정책을 그대로 수행한다.
function show(triggerTarget?: EventTarget | null): void {
  if (isInputElement(triggerTarget ?? null)) {
    (triggerTarget as HTMLElement).blur();
  }

  errorVisible.value = false;
  password.value = "";
  loginIdOrEmail.value = "";

  dialogRef.value?.showModal();
  inputIdRef.value?.focus();
}

function hide(): void {
  dialogRef.value?.close();
}

// 원본 $yona.attachDialogDismiss와 동일한 단일 click 델리게이트(배경 클릭 ->
// data-dismiss 순) - 이미 이식한 YonaDialog.vue의 onDialogClick과 동일 패턴.
function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) {
    hide();
    return;
  }
  const target = event.target as HTMLElement;
  if (target.closest?.('[data-dismiss="modal"]')) {
    hide();
  }
}

function getErrorMessageByStatus(status: number): void {
  if (/^4[0-9][0-9]$/.test(String(status))) {
    showError(msg("user.login.failed.client", "Failed to log in. The request is invalid."));
  } else if (/^5[0-9][0-9]$/.test(String(status))) {
    showError(msg("user.login.failed.server", "Failed to log in because a server error has occurred."));
  } else {
    showError(msg("user.login.failed", "Failed to log in."));
  }
}

function showError(message: string): void {
  errorMessage.value = message;
  errorVisible.value = true;

  // jQuery UI .effect("shake")를 대체하는 CSS 애니메이션(yona.css의 .yona-shake) -
  // 클래스를 뗐다 다시 붙이기 전에 강제로 리플로우시켜야 연속 실패 시에도
  // 애니메이션이 재생된다(원본과 동일한 기법 - Vue 템플릿 ref로도 그대로 동작).
  const dialog = dialogRef.value;
  if (dialog) {
    dialog.classList.remove("yona-shake");
    void dialog.offsetWidth;
    dialog.classList.add("yona-shake");
  }

  inputIdRef.value?.focus();
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault();

  let response: Response;
  try {
    response = await fetch(actionUrl.value, {
      method: "post",
      // jQuery $.ajax/$.post는 동일 출처 요청에 X-Requested-With: XMLHttpRequest를
      // 자동으로 붙였는데 fetch는 그렇지 않다 - 서버(YonaAuthenticationFailureHandler)가
      // AJAX 요청인지 판단하는 근거라 명시적으로 붙인다(원본과 동일).
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams({
        loginIdOrEmail: loginIdOrEmail.value,
        password: password.value,
        rememberMe: String(rememberMe.value),
      }),
    });
  } catch {
    showError(msg("user.login.failed.network", "Failed to log in because of network trouble."));
    return;
  }

  if (response.ok) {
    document.location.reload();
    return;
  }

  const responseText = await response.text();
  if (responseText && responseText.length > 0) {
    try {
      const responseObject = JSON.parse(responseText);
      showError(msg(responseObject.message, responseObject.message));
      return;
    } catch {
      // JSON 파싱 실패 시 상태코드 기반 메시지로 폴백(원본과 동일).
    }
  }
  getErrorMessageByStatus(response.status);
}

onMounted(() => {
  if (!host) return;
  actionUrl.value = host.getAttribute("data-action") ?? actionUrl.value;
  useSocialLoginOnly.value = host.getAttribute("data-use-social-login-only") === "true";
});

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialogRef" class="modal loginDialog" @click="onDialogClick">
      <div class="modal-body">
        <div class="pull-right">
          <button type="button" class="close mr10" data-dismiss="modal" aria-hidden="true">&times;</button>
        </div>
        <form class="frm-wrap login-form-wrap" @submit="onSubmit">
          <div class="btns-row nm" v-if="useSocialLoginOnly">
            {{ msg("app.warn.support.social.login.only", "Only allow sign-in via social login") }}
          </div>
          <template v-if="!useSocialLoginOnly">
            <dl>
              <dd>
                <input
                  ref="inputIdRef"
                  v-model="loginIdOrEmail"
                  name="loginIdOrEmail"
                  type="text"
                  class="text email"
                  autocomplete="off"
                  :placeholder="msg('user.login.key', 'Login ID or E-mail')"
                />
              </dd>
              <dd>
                <input
                  v-model="password"
                  name="password"
                  type="password"
                  class="text password"
                  autocomplete="off"
                  :placeholder="msg('user.password', 'Password')"
                />
              </dd>
            </dl>
            <!-- yona.css의 `.loginDialog .error { display: none; }`는 원본이
                 showError()에서 elLoginError.style.display = "block"으로 덮어쓰던 것 -
                 v-show(빈 값으로 되돌림)만으로는 이 전역 규칙을 이기지 못한다
                 (review-form의 `.review-form { display: none; }`와 동일한 함정,
                 실대치 검증 중 실제로 재현해 발견) - 인라인 스타일로 명시적으로
                 강제해야 한다. -->
            <div class="error" :style="{ display: errorVisible ? 'block' : 'none' }">
              <i class="yobicon-error"></i>
              <span class="error-message">{{ errorMessage }}</span>
            </div>
            <div class="btns-row nm">
              <button type="submit" class="ybtn ybtn-primary fullsize">{{ msg("button.login", "Log in") }}</button>
            </div>
          </template>
          <div class="btns-row nm">
            <div class="social-login-title-line" v-if="!useSocialLoginOnly"> or </div>
            <a href="/authenticate/github" class="ybtn oauth-login-btn">
              <span class="auth-provider-logo">
                <span class="github">
                  <svg aria-hidden="true" height="24" version="1.1" viewBox="0 0 16 16" width="19">
                    <path
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59 0.4 0.07 0.55-0.17 0.55-0.38 0-0.19-0.01-0.82-0.01-1.49-2.01 0.37-2.53-0.49-2.69-0.94-0.09-0.23-0.48-0.94-0.82-1.13-0.28-0.15-0.68-0.52-0.01-0.53 0.63-0.01 1.08 0.58 1.23 0.82 0.72 1.21 1.87 0.87 2.33 0.66 0.07-0.52 0.28-0.87 0.51-1.07-1.78-0.2-3.64-0.89-3.64-3.95 0-0.87 0.31-1.59 0.82-2.15-0.08-0.2-0.36-1.02 0.08-2.12 0 0 0.67-0.21 2.2 0.82 0.64-0.18 1.32-0.27 2-0.27 0.68 0 1.36 0.09 2 0.27 1.53-1.04 2.2-0.82 2.2-0.82 0.44 1.1 0.16 1.92 0.08 2.12 0.51 0.56 0.82 1.27 0.82 2.15 0 3.07-1.87 3.75-3.65 3.95 0.29 0.25 0.54 0.73 0.54 1.48 0 1.07-0.01 1.93-0.01 2.2 0 0.21 0.15 0.46 0.55 0.38C13.71 14.53 16 11.53 16 8 16 3.58 12.42 0 8 0z"
                    ></path>
                  </svg>
                </span>
                <span class="provider-name">Sign in with github</span>
              </span>
            </a>
            <a href="/authenticate/google" class="ybtn oauth-login-btn">
              <span class="auth-provider-logo">
                <!-- 정적 src는 Vite가 빌드 시점에 실제 에셋으로 해석을 시도해 실패한다
                     (다른 위젯의 CSS url()과 달리 <img src>는 SFC 컴파일러가 JS import로
                     바꾼다) - :src 동적 바인딩으로 문자열 그대로 남겨 런타임에 yona
                     정적 경로로 해석되게 한다. -->
                <img :src="'/images/provider-logo/btn_google_light_normal_ios.svg'" alt="login with Google" /> Sign in with Google
              </span>
            </a>
          </div>
          <div class="act-row right-txt mt20" v-if="!useSocialLoginOnly">
            <div class="pull-left">
              <input id="remember-meD" v-model="rememberMe" type="checkbox" name="rememberMe" class="checkbox" />
              <label for="remember-meD" class="bg-checkbox">{{ msg("title.rememberMe", "Stay logged in") }}</label>
            </div>
            <a href="/lostPassword">{{ msg("title.resetPassword", "Reset password") }}</a>
            <span class="gray-txt ml10 mr10">|</span>
            <a href="/signup">{{ msg("title.signup", "Sign up") }}</a>
          </div>
        </form>
      </div>
    </dialog>
  </Teleport>
</template>
