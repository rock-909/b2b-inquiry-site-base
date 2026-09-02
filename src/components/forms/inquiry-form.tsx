"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { InquiryFormFields } from "@/components/forms/inquiry-form-fields";
import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { InquiryFormStatus } from "@/components/forms/inquiry-form-status";
import {
  createInquiryPayload,
  getInquiryMessageMaxLength,
} from "@/components/forms/inquiry-payload";
import {
  decodeInquirySubmitState,
  type InquirySubmitState,
} from "@/components/forms/inquiry-response";
import { TurnstileWidget } from "@/components/security/turnstile";
import {
  MAX_LEAD_EMAIL_LENGTH,
  MAX_LEAD_MESSAGE_LENGTH,
  MAX_LEAD_NAME_LENGTH,
} from "@/constants/validation-limits";
import { trackGenerateLead } from "@/lib/marketing/lead-event";
import { appendAttributionToFormData } from "@/lib/marketing/utm";

export type { InquiryFormCopy } from "@/components/forms/inquiry-form-copy";

export interface InquiryFormProps {
  readonly copy: InquiryFormCopy;
  readonly fallback: ReactNode;
  /**
   * 产品语境预填：仅产品详情页传入（来源为编译期 offerings 配置，非用户输入）。
   * 走 textarea defaultValue——React 文本渲染不是 HTML sink；提交仍经
   * canonicalBuyerMessageSchema 校验。传入前截断到 message 上限，
   * 避免超长初始值先过浏览器 maxLength 再被服务端 400。
   */
  readonly initialMessage?: string;
}

const unsubscribeHydration = () => undefined;
const subscribeHydration = () => unsubscribeHydration;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const INQUIRY_ENDPOINT = "/api/inquiry";
const INQUIRY_DRAFT_STORAGE_KEY = "inquiry-draft";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

interface InquiryDraft {
  email: string;
  fullName: string;
  message: string;
}

function getDraftString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function readInquiryDraft(): InquiryDraft | null {
  try {
    const stored = window.sessionStorage.getItem(INQUIRY_DRAFT_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const draftRecord = parsed as Record<string, unknown>;
    const draft = {
      fullName: getDraftString(draftRecord.fullName, MAX_LEAD_NAME_LENGTH),
      email: getDraftString(draftRecord.email, MAX_LEAD_EMAIL_LENGTH),
      message: getDraftString(draftRecord.message, MAX_LEAD_MESSAGE_LENGTH),
    };

    return draft.fullName || draft.email || draft.message ? draft : null;
  } catch {
    return null;
  }
}

function getVisibleFormValue(
  form: HTMLFormElement,
  name: keyof InquiryDraft,
  maxLength: number,
): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement
    ? control.value.slice(0, maxLength)
    : "";
}

function saveInquiryDraft(form: HTMLFormElement) {
  const draft = {
    fullName: getVisibleFormValue(form, "fullName", MAX_LEAD_NAME_LENGTH),
    email: getVisibleFormValue(form, "email", MAX_LEAD_EMAIL_LENGTH),
    message: getVisibleFormValue(form, "message", MAX_LEAD_MESSAGE_LENGTH),
  };

  try {
    if (!draft.fullName && !draft.email && !draft.message) {
      window.sessionStorage.removeItem(INQUIRY_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      INQUIRY_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
  } catch {
    // 存储不可用时静默降级，表单本身仍可使用。
  }
}

function restoreInquiryDraft(form: HTMLFormElement | null) {
  const draft = readInquiryDraft();
  if (!form || !draft) return;

  for (const name of ["fullName", "email", "message"] as const) {
    const control = form.elements.namedItem(name);
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.value = draft[name];
    }
  }
}

function clearInquiryDraft() {
  try {
    window.sessionStorage.removeItem(INQUIRY_DRAFT_STORAGE_KEY);
  } catch {
    // 存储被禁用不能影响已经成功的询盘提交。
  }
}

/** 错误焦点等一帧再执行（布局稳定后 scrollIntoView 才准确）；无 rAF 环境同步执行。 */
function runAfterPaint(callback: () => void): () => void {
  if (typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(callback);

    return () => window.cancelAnimationFrame(frameId);
  }

  callback();

  return () => undefined;
}

/**
 * Turnstile 令牌生命周期：令牌值、过期标记、reset 登记与落定清理。
 * 从 InquiryFormLive 原样搬出以通过函数规模门禁并收拢安全边界状态；
 * 行为不变，不是新的通用抽象。
 */
function useTurnstileTokenLifecycle() {
  const [token, setToken] = useState("");
  const [verificationExpired, setVerificationExpired] = useState(false);
  // reset 回调用 ref 登记：widget remount 后不留下失效引用。
  const resetRef = useRef<(() => void) | null>(null);

  const registerReset = (reset: () => void) => {
    resetRef.current = reset;

    return () => {
      if (resetRef.current === reset) {
        resetRef.current = null;
      }
    };
  };

  // 令牌是一次性的：每次提交落定（成功或失败）都要清掉并让 widget 重新出题。
  // `resetRef.current?.()` 是那条重置链路的起点，断了买家会卡在一个永远禁用
  // 的提交按钮前。
  const clearAfterSettlement = () => {
    setToken("");
    setVerificationExpired(false);
    resetRef.current?.();
  };

  return {
    token,
    verificationExpired,
    registerReset,
    clearAfterSettlement,
    handleSuccess: (newToken: string) => {
      setToken(newToken);
      setVerificationExpired(false);
    },
    handleExpire: () => {
      setToken("");
      setVerificationExpired(true);
    },
    handleError: () => {
      setToken("");
      setVerificationExpired(false);
    },
  };
}

/**
 * 429 冷却：到期自动解除按钮门控；不做逐秒倒计时，避免屏幕阅读器每秒被播报。
 */
function useRateLimitCooldown() {
  const [retryUntil, setRetryUntil] = useState<number | null>(null);

  useEffect(() => {
    if (retryUntil === null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => setRetryUntil(null),
      Math.max(0, retryUntil - Date.now()),
    );

    return () => window.clearTimeout(timeoutId);
  }, [retryUntil]);

  return {
    rateLimitActive: retryUntil !== null,
    /** 非正秒数视为无需冷却。 */
    startFromSeconds(seconds: number) {
      if (seconds > 0) {
        setRetryUntil(Date.now() + seconds * 1000);
      }
    },
    clear() {
      setRetryUntil(null);
    },
  };
}

/**
 * 一次提交的请求预算。
 *
 * 服务端串行执行，已知最坏耗时加总为 20 秒：
 * 限流查询 2 秒（`src/lib/security/stores/rate-limit-store.ts` 的
 * `UPSTASH_OPERATION_TIMEOUT_MS`，串在整条链路最前面）
 * + Turnstile 校验 5 秒（`src/lib/security/turnstile.ts` 的
 * `TURNSTILE_VERIFY_TIMEOUT_MS`）
 * + 业主邮件 5 秒（`src/lib/email/resend-http-client.ts` 的
 * `DEFAULT_RESEND_TIMEOUT_MS`）
 * + Airtable 8 秒（`src/lib/airtable/service.ts` 的
 * `AIRTABLE_REQUEST_TIMEOUT_MS`）。
 *
 * 30 秒把这 20 秒整个包住，另留约 10 秒给 Worker 冷启动和网络往返。不设上限则更糟：
 * 连接被中间盒吞掉时 fetch 既不 resolve 也不 reject，表单会永远停在「提交中」。
 *
 * 超时只意味着「浏览器不再等了」，不意味着服务端停下了。这里不传幂等键，邮件和
 * Airtable 也没有绑定这条 abort 信号（Cloudflare 要靠 request-signal 兼容标志才会
 * 把取消传下去，`wrangler.jsonc` 没开）。所以超时之后结果是未知的：服务端可能仍然
 * 发出了邮件、写下了记录，买家再提交一次就成了重复询盘。低于这条线只会让这个窗口
 * 更常撞上。
 *
 * 重复本身是业主已经接受的（`docs/项目.md`：重复的询盘可以接受，
 * 丢掉的不行）。哪天不再接受了，要做的是稳定的提交 ID 加供应商幂等，而不是继续调秒数。
 *
 * 这四个数散在四个模块里，加错一次没人会红，所以
 * `__tests__/inquiry-form-submission.test.tsx` 直接 import 它们来对账。
 */
const INQUIRY_REQUEST_TIMEOUT_MS = 30_000;

/**
 * 支持范围内的浏览器都有 `AbortSignal.timeout`（Chrome 103 / Safari 16 /
 * Firefox 100 起，都早于 `.browserslistrc` 声明的下限）。但范围外的旧设备上它
 * 会同步抛 TypeError，而调用点在 try 里——异常会被吞成「服务器错误」，请求根本
 * 没发出去，买家每次提交都失败且看不出原因。宁可让老浏览器退回没有预算的老行为，
 * 也不能把它从「能提交」变成「永远失败」。
 */
function createRequestBudgetSignal(): AbortSignal | undefined {
  // 先探 `AbortSignal` 本身。更老的浏览器连这个全局都没有，直接写
  // `typeof AbortSignal.timeout` 会抛 ReferenceError——那条异常逃出去之后
  // 表单会永远停在「提交中」，比没有预算还糟。
  return typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(INQUIRY_REQUEST_TIMEOUT_MS)
    : undefined;
}

/**
 * 发一次询盘并解码结果。请求失败或超出预算时降级成服务器错误，而不是把异常抛给
 * 调用方——买家要看到的是一句话，不是白屏，更不是一个永远转圈的按钮。
 */
async function postInquiry(
  formData: FormData,
  turnstileToken: string,
): Promise<InquirySubmitState> {
  try {
    const signal = createRequestBudgetSignal();
    const response = await fetch(INQUIRY_ENDPOINT, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(createInquiryPayload(formData, turnstileToken)),
      ...(signal ? { signal } : {}),
    });
    return await decodeInquirySubmitState(response);
  } catch {
    return { status: "error", errorKind: "server" };
  }
}

/**
 * 成功后清空三个可见输入。`form.reset()` 只回到 defaultValue，估算器预填的那条
 * message 会原样回来，所以再显式清一遍。
 */
function clearSubmittedFields(form: HTMLFormElement | null) {
  if (!form) {
    return;
  }

  form.reset();
  for (const name of ["fullName", "email", "message"] as const) {
    const control = form.elements.namedItem(name);
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.value = "";
    }
  }
}

/**
 * 服务端错误落定后，把焦点和视口带到第一个可识别的错误字段；无法识别时
 * 聚焦错误摘要。等一帧让浏览器完成布局，scrollIntoView 才拿得到正确几何。
 * 只监听 displayState：cooldown 到期、新 token 到来都不会触发重复抢焦点。
 */
function useSubmitErrorFocus(
  displayState: InquirySubmitState,
  formRef: RefObject<HTMLFormElement | null>,
  errorSummaryRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (displayState.status !== "error") {
      return undefined;
    }

    const focusErrorTarget = () => {
      const target =
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        errorSummaryRef.current;

      if (!target?.isConnected) {
        return;
      }

      target.focus({ preventScroll: true });
      // jsdom 不实现 scrollIntoView；真实浏览器均有，可选调用保持降级安全。
      target.scrollIntoView?.({ block: "center", behavior: "auto" });
    };

    return runAfterPaint(focusErrorTarget);
    // ref 是稳定容器，不构成重跑语义；displayState 是唯一的触发源。
  }, [displayState, formRef, errorSummaryRef]);
}

function InquiryFormLive({
  copy,
  initialMessage,
}: {
  copy: InquiryFormCopy;
  initialMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [displayState, setDisplayState] = useState<InquirySubmitState>({
    status: "idle",
  });
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  // 提交锁用 ref 而不是上面的状态：状态更新是异步的，同一轮里连发两次提交会
  // 都读到 idle。ref 是同步的。
  const isSubmittingRef = useRef(false);

  const turnstile = useTurnstileTokenLifecycle();
  const rateLimit = useRateLimitCooldown();

  useSubmitErrorFocus(displayState, formRef, errorSummaryRef);

  useEffect(() => {
    restoreInquiryDraft(formRef.current);
  }, []);

  const submit = async (formData: FormData) => {
    // 请求进行中忽略重复提交：按钮是禁用的，但回车照样能提交表单。
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setDisplayState({ status: "submitting" });

    try {
      appendAttributionToFormData(formData);
      const decoded = await postInquiry(formData, turnstile.token);
      setDisplayState(decoded);

      if (
        decoded.status === "error" &&
        decoded.errorKind === "rateLimit" &&
        decoded.retryAfterSeconds !== undefined
      ) {
        rateLimit.startFromSeconds(decoded.retryAfterSeconds);
      } else {
        rateLimit.clear();
      }

      if (decoded.status === "success") {
        trackGenerateLead();
        clearSubmittedFields(formRef.current);
        clearInquiryDraft();
      }
    } catch {
      setDisplayState({ status: "error", errorKind: "server" });
      rateLimit.clear();
    }

    isSubmittingRef.current = false;
    turnstile.clearAfterSettlement();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 冷却期内 Enter 或程序化提交不再发请求，也不把限流反馈覆盖成其他错误。
    if (rateLimit.rateLimitActive) {
      return;
    }

    // 没验证过就绝不发请求。按钮此时是禁用的，但回车能绕过按钮。
    if (!turnstile.token) {
      setDisplayState({ status: "error", errorKind: "security" });
      return;
    }

    submit(new FormData(event.currentTarget)).catch(() => undefined);
  };

  const ariaLabel = copy.contactAriaLabel;
  const fieldDetails =
    displayState.status === "error" && displayState.errorKind === "field"
      ? displayState.fieldDetails
      : undefined;

  return (
    <section className="surface-card p-6 md:p-8">
      <form
        ref={formRef}
        aria-label={ariaLabel}
        className="space-y-6"
        data-analytics-event="contact_submit"
        data-lead-path="api-inquiry"
        data-testid="inquiry-form"
        onInput={(event) => saveInquiryDraft(event.currentTarget)}
        onSubmit={handleSubmit}
      >
        <InquiryFormFields
          copy={copy}
          {...(initialMessage ? { initialMessage } : {})}
          messageMaxLength={getInquiryMessageMaxLength()}
          {...(fieldDetails ? { fieldDetails } : {})}
        />

        <TurnstileWidget
          className="w-full"
          labels={copy.turnstile}
          onError={turnstile.handleError}
          onExpire={turnstile.handleExpire}
          onSuccess={turnstile.handleSuccess}
          onReadyRef={turnstile.registerReset}
          size="normal"
          theme="auto"
        />

        <InquiryFormStatus
          copy={copy}
          displayState={displayState}
          isSubmitting={displayState.status === "submitting"}
          turnstileReady={Boolean(turnstile.token)}
          rateLimitActive={rateLimit.rateLimitActive}
          verificationExpired={turnstile.verificationExpired}
          errorSummaryRef={errorSummaryRef}
        />
      </form>
    </section>
  );
}

export function InquiryForm({
  copy,
  fallback,
  initialMessage,
}: InquiryFormProps) {
  // 与 MAX_LEAD_MESSAGE_LENGTH 对齐：超长初始值会先过浏览器再被服务端拒绝。
  const safeInitialMessage =
    initialMessage && initialMessage.length > getInquiryMessageMaxLength()
      ? initialMessage.slice(0, getInquiryMessageMaxLength())
      : initialMessage;

  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  if (!isHydrated) {
    // The static card is ~160px; the live form is ~470-700px depending on
    // width. Without reserved space the swap pushes everything below it down
    // (measured CLS 0.203 on the inquiry form swap). The bands track the live form's
    // measured height per breakpoint; tests/e2e/layout-stability.spec.ts fails
    // if they drift far enough to move the page.
    return (
      <div
        data-inquiry-form-reserve
        className="min-h-[660px] min-[390px]:min-h-[600px] sm:min-h-[560px] md:min-h-[480px]"
      >
        {/* Without JavaScript the swap never happens, so reserving space would
            leave a permanent gap under the card. */}
        <noscript>
          <style>{"[data-inquiry-form-reserve]{min-height:0}"}</style>
        </noscript>
        {fallback}
      </div>
    );
  }

  return (
    <InquiryFormLive
      copy={copy}
      {...(safeInitialMessage ? { initialMessage: safeInitialMessage } : {})}
    />
  );
}
