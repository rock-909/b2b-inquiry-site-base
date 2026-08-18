import messages from "../../../messages/base/en/messages.json";

export interface CanarySelectors {
  submitLabel: string;
  successPrefix: string;
}

export function buildCanarySelectors(): CanarySelectors {
  const submitLabel = messages.inquiry.form.submit;
  const successText = messages.inquiry.form.success;
  if (!submitLabel || !successText) {
    throw new Error("canary selectors: message truth missing");
  }
  return { submitLabel, successPrefix: successText.slice(0, 40) };
}
