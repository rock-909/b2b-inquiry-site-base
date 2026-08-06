import { render, within } from "@testing-library/react";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { type ValidatedInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";

/**
 * 询盘表单的共用渲染装备。两个测试文件（表单契约、提交生命周期）共用同一套，
 * 别再复制一份取控件的正则——宽松的正则会同时命中多个控件。
 */

export const GENERAL_CONTEXT: ValidatedInquiryContext = {
  kind: "general-context",
};

export function renderInquiryForm(
  source: "contact" | "request-quote" = "contact",
  context: ValidatedInquiryContext = GENERAL_CONTEXT,
) {
  const copy = createTestInquiryFormCopy();
  const fallback = <InquiryFormStaticFallback copy={copy} />;
  const utils = render(
    <InquiryForm
      context={context}
      copy={copy}
      fallback={fallback}
      source={source}
    />,
  );
  return { copy, ...utils };
}

export function getFormControls(container: HTMLElement) {
  const form = within(container).getByTestId("inquiry-form");
  return {
    form,
    fullName: within(form).getByLabelText(/^Full name/i),
    email: within(form).getByLabelText(/^Email address/i),
    message: within(form).getByLabelText(/^Message/i),
  };
}
