<script setup lang="ts">
// 익명 사용자에게만 렌더링되는 site/layout.html의 #loginDialog(네이티브
// <dialog>)다.
//
// 위치를 옮길 필요가 없는데도 <Teleport to="body">를 쓴다 - 목적은 이동이
// 아니라 CSS 포팅 회피다. 원본이 기대는 15개 이상의 전역 클래스(.modal/
// .loginDialog/.frm-wrap/.ybtn 등)를 Shadow DOM에 그대로 두면 전부 이식해야
// 하지만, Teleport로 라이트 DOM에 내보내면 전역 yona.css/bootstrap.css를
// 그대로 상속받는다.
//
// CSRF: 원본은 th:action 폼으로 CSRF 히든 필드를 자동 주입받지만, 실제 제출은
// fetch()로 이뤄진다 - site/layout.html의 전역 fetch 몽키패치가 XSRF-TOKEN
// 쿠키를 X-XSRF-TOKEN 헤더로 자동 첨부해주므로 CSRF 필드 자체가 불필요하다.
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

// 트리거 엘리먼트가 입력창이면 blur()로 포커스를 뺀다(모달 뒤에 포커스 링이
// 남는 것 방지) - 트리거 델리게이트는 페이지(어댑터) 소유라 show()가 트리거를
// 선택적으로 받아 이 정책을 대신 수행한다.
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

  // 클래스를 뗐다 다시 붙이기 전에 강제로 리플로우시켜야 연속 실패 시에도
  // .yona-shake 애니메이션이 다시 재생된다.
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
      // jQuery $.ajax는 X-Requested-With: XMLHttpRequest를 자동으로 붙였지만
      // fetch는 안 붙인다 - 서버(YonaAuthenticationFailureHandler)가 AJAX 요청
      // 판단 근거로 쓰므로 명시적으로 붙여야 한다.
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
      // JSON 파싱 실패 시 상태코드 기반 메시지로 폴백.
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
            <!-- yona.css의 `.loginDialog .error { display: none; }`를 이기려면
                 v-show가 아니라 인라인 style로 명시적으로 display를 강제해야
                 한다. -->
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
                <!-- 정적 src는 Vite가 빌드 시점에 에셋으로 해석하려다 실패한다
                     (<img src>는 SFC 컴파일러가 JS import로 바꾼다) - :src 동적
                     바인딩으로 문자열 그대로 남겨 런타임에 yona 정적 경로로
                     해석되게 한다. -->
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
