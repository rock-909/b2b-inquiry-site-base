import { type Ref } from "react";
import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { type InquirySubmitState } from "@/components/forms/inquiry-response";
import { FormPrivacyNotice } from "@/components/forms/form-privacy-notice";
import { buttonVariants } from "@/components/ui/button-variants";
import { StatusCallout } from "@/components/ui/status-callout";

function getErrorSummary(
  copy: InquiryFormCopy,
  state: InquirySubmitState,
  rateLimitActive: boolean,
): string | null {
  if (state.status !== "error" || !state.errorKind) {
    return null;
  }

  switch (state.errorKind) {
    case "field":
      return copy.errors.fieldSummary;
    case "security":
      return copy.errors.securitySummary;
    // 冷却期内显示限流专用文案；到期后由 ready 提示接管，不再重复摘要。
    case "rateLimit":
      return rateLimitActive ? copy.errors.rateLimitSummary : null;
    case "server":
      return copy.errors.serverSummary;
    default:
      return copy.errors.serverSummary;
  }
}

export function InquiryFormStatus({
  copy,
  displayState,
  isSubmitting,
  turnstileReady,
  rateLimitActive,
  verificationExpired,
  errorSummaryRef,
}: {
  copy: InquiryFormCopy;
  displayState: InquirySubmitState;
  isSubmitting: boolean;
  turnstileReady: boolean;
  rateLimitActive: boolean;
  verificationExpired: boolean;
  errorSummaryRef: Ref<HTMLDivElement>;
}) {
  const errorSummary = getErrorSummary(copy, displayState, rateLimitActive);
  // 冷却结束的提示只属于最后一次 429 状态，其他错误或成功后不出现。
  const cooldownReady =
    displayState.status === "error" &&
    displayState.errorKind === "rateLimit" &&
    !rateLimitActive;

  return (
    <>
      {displayState.status === "success" ? (
        <StatusCallout tone="success">
          <p>
            {copy.success} {copy.referenceLabel}: {displayState.referenceId}
          </p>
        </StatusCallout>
      ) : null}

      {/* 错误反馈走程序化聚焦单通道：live 关掉避免与焦点播报双重朗读。 */}
      {errorSummary ? (
        <StatusCallout
          live={false}
          ref={errorSummaryRef}
          tabIndex={-1}
          tone="error"
        >
          {errorSummary}
        </StatusCallout>
      ) : null}

      {/* 过期不打断买家输入：polite 提示 + 不抢焦点，新 token 到达即消失。 */}
      {verificationExpired && !isSubmitting ? (
        <StatusCallout tone="warning">{copy.turnstile.expired}</StatusCallout>
      ) : null}

      {cooldownReady ? (
        <StatusCallout>{copy.errors.rateLimitReady}</StatusCallout>
      ) : null}

      {displayState.status === "submitting" ? (
        <StatusCallout>{copy.submitting}</StatusCallout>
      ) : null}

      <FormPrivacyNotice text={copy.privacyNotice} />

      <button
        className={buttonVariants({ className: "w-full" })}
        disabled={isSubmitting || !turnstileReady || rateLimitActive}
        type="submit"
      >
        {isSubmitting ? copy.submitting : copy.submit}
      </button>
    </>
  );
}
