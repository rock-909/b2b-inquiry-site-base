import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { type InquirySubmitState } from "@/components/forms/inquiry-response";
import { FormPrivacyNotice } from "@/components/forms/form-privacy-notice";
import { buttonVariants } from "@/components/ui/button-variants";
import { StatusCallout } from "@/components/ui/status-callout";

function getErrorSummary(
  copy: InquiryFormCopy,
  state: InquirySubmitState,
): string | null {
  if (state.status !== "error" || !state.errorKind) {
    return null;
  }

  switch (state.errorKind) {
    case "field":
      return copy.errors.fieldSummary;
    case "security":
      return copy.errors.securitySummary;
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
}: {
  copy: InquiryFormCopy;
  displayState: InquirySubmitState;
  isSubmitting: boolean;
  turnstileReady: boolean;
}) {
  const errorSummary = getErrorSummary(copy, displayState);

  return (
    <>
      {displayState.status === "success" ? (
        <StatusCallout tone="success">
          <p>
            {copy.success} {copy.referenceLabel}: {displayState.referenceId}
          </p>
        </StatusCallout>
      ) : null}

      {errorSummary ? (
        <StatusCallout tone="error">{errorSummary}</StatusCallout>
      ) : null}

      {displayState.status === "submitting" ? (
        <StatusCallout>{copy.submitting}</StatusCallout>
      ) : null}

      <FormPrivacyNotice text={copy.privacyNotice} />

      <button
        className={buttonVariants({ className: "w-full" })}
        disabled={isSubmitting || !turnstileReady}
        type="submit"
      >
        {isSubmitting ? copy.submitting : copy.submit}
      </button>
    </>
  );
}
