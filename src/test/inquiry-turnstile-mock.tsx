import { useEffect } from "react";
import { vi } from "vitest";
import { INQUIRY_TURNSTILE_ACTION } from "@/constants/turnstile-constants";

/**
 * `LazyTurnstile` 的测试替身。
 *
 * 单独放在这个文件里，是为了让 `vi.mock` 的工厂只 import 它——工厂如果去
 * import 那个会 import `InquiryForm` 的 harness，就会在模块初始化中途绕回
 * 自己，拿到半个模块。
 */

interface InquiryTurnstileLabels {
  unavailable: string;
  loadFailed: string;
  slowToLoad: string;
  devBypass: string;
  testMode: string;
  rescueBeforeEmail: string;
  rescueAfterEmail: string;
  rescueSubject: string;
}

/** 记录传给 widget 的文案，用来断言 i18n 键没走丢。 */
export const lazyTurnstileLabelsSpy = vi.fn();

/**
 * widget 的 reset 回调。表单每次提交落定都必须调它：令牌是一次性的，不重新
 * 出题的话买家会卡在一个永远禁用的提交按钮前。
 */
export const turnstileWidgetResetSpy = vi.fn();

export function LazyTurnstile({
  labels,
  onError,
  onExpire,
  onSuccess,
  onReadyRef,
}: {
  labels: InquiryTurnstileLabels;
  onError?: () => void;
  onExpire?: () => void;
  onSuccess?: (token: string) => void;
  onReadyRef?: (reset: () => void) => (() => void) | void;
}) {
  lazyTurnstileLabelsSpy(labels);

  // 真实 widget 挂载后把自己的 reset 交给表单，替身照做，重置链路才能被断言。
  useEffect(() => {
    if (!onReadyRef) {
      return undefined;
    }
    return onReadyRef(turnstileWidgetResetSpy);
  }, [onReadyRef]);

  return (
    <div data-action={INQUIRY_TURNSTILE_ACTION} data-testid="inquiry-turnstile">
      <button
        data-testid="inquiry-turnstile-success"
        onClick={() => onSuccess?.("mock-inquiry-turnstile-token")}
        type="button"
      >
        Complete verification
      </button>
      <button
        data-testid="inquiry-turnstile-expire"
        onClick={() => onExpire?.()}
        type="button"
      >
        Expire verification
      </button>
      <button
        data-testid="inquiry-turnstile-error"
        onClick={() => onError?.()}
        type="button"
      >
        Fail verification
      </button>
    </div>
  );
}
