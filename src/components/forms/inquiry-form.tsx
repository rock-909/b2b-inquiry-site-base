"use client";

import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  InquiryBuyerInterestContext,
  InquiryFormFields,
} from "@/components/forms/inquiry-form-fields";
import {
  type InquiryFormCopy,
  type InquiryFormSource,
} from "@/components/forms/inquiry-form-copy";
import { InquiryFormStatus } from "@/components/forms/inquiry-form-status";
import {
  createInquiryPayload,
  getInquiryMessageMaxLength,
} from "@/components/forms/inquiry-payload";
import {
  decodeInquirySubmitState,
  type InquirySubmitState,
} from "@/components/forms/inquiry-response";
import { LazyTurnstile } from "@/components/forms/lazy-turnstile";
import { trackGenerateLead } from "@/lib/marketing/lead-event";
import { appendAttributionToFormData } from "@/lib/marketing/utm";
import type { ValidatedInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";

export type { InquiryFormSource } from "@/components/forms/inquiry-form-copy";
export type { InquiryFormCopy } from "@/components/forms/inquiry-form-copy";

export interface InquiryFormProps {
  readonly source: InquiryFormSource;
  readonly copy: InquiryFormCopy;
  readonly fallback: ReactNode;
  readonly context: ValidatedInquiryContext;
}

const unsubscribeHydration = () => undefined;
const subscribeHydration = () => unsubscribeHydration;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const INQUIRY_ENDPOINT = "/api/inquiry";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * 一次提交的请求预算。
 *
 * 服务端串行执行，已知最坏耗时加总为 23 秒：
 * 限流查询 5 秒（`src/lib/security/stores/rate-limit-store.ts` 的
 * `UPSTASH_OPERATION_TIMEOUT_MS`，串在整条链路最前面）
 * + Turnstile 校验 5 秒（`src/lib/security/turnstile.ts` 的
 * `TURNSTILE_VERIFY_TIMEOUT_MS`）
 * + 业主邮件 5 秒（`src/lib/email/resend-http-client.ts` 的
 * `DEFAULT_RESEND_TIMEOUT_MS`）
 * + Airtable 8 秒（`src/lib/airtable/service.ts` 的
 * `AIRTABLE_REQUEST_TIMEOUT_MS`）。
 *
 * 30 秒把这 23 秒整个包住，另留 7 秒给 Worker 冷启动和网络往返。不设上限则更糟：
 * 连接被中间盒吞掉时 fetch 既不 resolve 也不 reject，表单会永远停在「提交中」。
 *
 * 超时只意味着「浏览器不再等了」，不意味着服务端停下了。这里不传幂等键，邮件和
 * Airtable 也没有绑定这条 abort 信号（Cloudflare 要靠 request-signal 兼容标志才会
 * 把取消传下去，`wrangler.jsonc` 没开）。所以超时之后结果是未知的：服务端可能仍然
 * 发出了邮件、写下了记录，买家再提交一次就成了重复询盘。低于这条线只会让这个窗口
 * 更常撞上。
 *
 * 重复本身是业主已经接受的（`docs/架构与行为.md`：重复的询盘可以接受，
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
  context: ValidatedInquiryContext,
): Promise<InquirySubmitState> {
  try {
    const signal = createRequestBudgetSignal();
    const response = await fetch(INQUIRY_ENDPOINT, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(
        createInquiryPayload(formData, turnstileToken, context),
      ),
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

function InquiryFormLive({
  source,
  copy,
  context,
}: {
  source: InquiryFormSource;
  copy: InquiryFormCopy;
  context: ValidatedInquiryContext;
}) {
  const visibleContext =
    context.kind === "catalog-context"
      ? context.displayLabel
      : context.buyerInterest;
  const { initialMessage } = context;
  const formRef = useRef<HTMLFormElement>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [displayState, setDisplayState] = useState<InquirySubmitState>({
    status: "idle",
  });
  // 提交锁用 ref 而不是上面的状态：状态更新是异步的，同一轮里连发两次提交会
  // 都读到 idle。ref 是同步的。
  const isSubmittingRef = useRef(false);
  const turnstileResetRef = useRef<(() => void) | null>(null);

  // 登记 widget 的 reset 回调，返回注销函数，remount 后不留下失效的引用。
  const registerTurnstileReset = (reset: () => void) => {
    turnstileResetRef.current = reset;
    return () => {
      if (turnstileResetRef.current === reset) {
        turnstileResetRef.current = null;
      }
    };
  };

  const clearTurnstileToken = () => setTurnstileToken("");

  // 令牌是一次性的：每次提交落定（成功或失败）都要清掉并让 widget 重新出题。
  // `turnstileResetRef.current?.()` 是那条重置链路的起点，断了买家会卡在一个
  // 永远禁用的提交按钮前。
  const clearTurnstileAfterSettlement = () => {
    setTurnstileToken("");
    turnstileResetRef.current?.();
  };

  const submit = async (formData: FormData) => {
    // 请求进行中忽略重复提交：按钮是禁用的，但回车照样能提交表单。
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setDisplayState({ status: "submitting" });
    appendAttributionToFormData(formData);

    try {
      const decoded = await postInquiry(formData, turnstileToken, context);
      setDisplayState(decoded);
      if (decoded.status === "success") {
        trackGenerateLead(source === "contact" ? "contact" : "rfq");
        clearSubmittedFields(formRef.current);
      }
    } finally {
      isSubmittingRef.current = false;
      clearTurnstileAfterSettlement();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 没验证过就绝不发请求。按钮此时是禁用的，但回车能绕过按钮。
    if (!turnstileToken) {
      setDisplayState({ status: "error", errorKind: "security" });
      return;
    }

    submit(new FormData(event.currentTarget)).catch(() => undefined);
  };

  const ariaLabel =
    source === "contact" ? copy.contactAriaLabel : copy.requestQuoteAriaLabel;
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
        data-analytics-event={
          source === "contact" ? "contact_submit" : "rfq_submit"
        }
        data-lead-path="api-inquiry"
        data-testid="inquiry-form"
        onSubmit={handleSubmit}
      >
        {visibleContext ? (
          <InquiryBuyerInterestContext
            buyerInterest={visibleContext}
            copy={copy}
          />
        ) : null}

        <InquiryFormFields
          copy={copy}
          messageMaxLength={getInquiryMessageMaxLength()}
          {...(fieldDetails ? { fieldDetails } : {})}
          {...(initialMessage ? { initialMessage } : {})}
        />

        <LazyTurnstile
          labels={copy.turnstile}
          onError={clearTurnstileToken}
          onExpire={clearTurnstileToken}
          onSuccess={setTurnstileToken}
          onReadyRef={registerTurnstileReset}
        />

        <InquiryFormStatus
          copy={copy}
          displayState={displayState}
          isSubmitting={displayState.status === "submitting"}
          turnstileReady={Boolean(turnstileToken)}
        />
      </form>
    </section>
  );
}

export function InquiryForm({
  source,
  copy,
  fallback,
  context,
}: InquiryFormProps) {
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  if (!isHydrated) {
    // The static card is ~160px; the live form is ~470-700px depending on
    // width. Without reserved space the swap pushes everything below it down
    // (measured CLS 0.203 on /request-quote). The bands track the live form's
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

  return <InquiryFormLive copy={copy} context={context} source={source} />;
}
