import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_INQUIRY_CONFIG_PREFILL_LENGTH,
  MAX_LEAD_PRODUCT_NAME_LENGTH,
} from "@/constants/validation-limits";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { resolveInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";
import { lazyTurnstileLabelsSpy } from "@/test/inquiry-turnstile-mock";
import {
  GENERAL_CONTEXT,
  getFormControls,
  renderInquiryForm,
} from "@/test/inquiry-form-harness";

vi.mock(
  "@/components/forms/lazy-turnstile",
  async () => await import("@/test/inquiry-turnstile-mock"),
);

const FORBIDDEN_CONTROL_NAMES = [
  "phone",
  "company",
  "subject",
  "catalogProductId",
  "quantity",
  "country",
  "port",
  "budget",
] as const;

function assertThreeFieldContract(
  container: HTMLElement,
  copy: ReturnType<typeof createTestInquiryFormCopy>,
) {
  const { fullName, email, message, form } = getFormControls(container);

  expect(fullName).toHaveAttribute("name", "fullName");
  expect(fullName).toHaveAttribute("required");
  expect(fullName).toHaveAttribute("autocomplete", "name");
  expect(fullName).toHaveAttribute("type", "text");

  expect(email).toHaveAttribute("name", "email");
  expect(email).toHaveAttribute("required");
  expect(email).toHaveAttribute("autocomplete", "email");
  expect(email).toHaveAttribute("type", "email");

  expect(message).toHaveAttribute("name", "message");
  expect(message).not.toHaveAttribute("required");
  expect(within(form).getByText(`(${copy.optional})`)).toBeInTheDocument();

  expect(form.querySelector('input[type="tel"]')).toBeNull();
  for (const name of FORBIDDEN_CONTROL_NAMES) {
    expect(form.querySelector(`[name="${name}"]`)).toBeNull();
  }

  const honeypot = form.querySelector<HTMLInputElement>(
    'input[name="website"]',
  );
  expect(honeypot).not.toBeNull();
  expect(honeypot).toHaveAttribute("type", "text");
  expect(honeypot).not.toHaveAttribute("hidden");
  expect(honeypot).toHaveAttribute("aria-hidden", "true");
  expect(honeypot).toHaveAttribute("autocomplete", "off");
  expect(honeypot).toHaveAttribute("tabIndex", "-1");
  expect(honeypot).toHaveClass("sr-only");
  expect(
    within(form).queryByRole("textbox", { name: /website/i }),
  ).not.toBeInTheDocument();
  expect(within(form).queryAllByRole("textbox")).not.toContain(honeypot);
}

function getFetchBody(): Record<string, unknown> {
  const requestInit = vi.mocked(fetch).mock.calls.at(-1)?.[1];
  expect(requestInit).toBeDefined();
  return JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
}

describe("InquiryForm contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lazyTurnstileLabelsSpy.mockClear();
    window.sessionStorage.clear();
    delete (window as unknown as Record<string, unknown>).gtag;
    global.fetch = vi.fn(async () =>
      Response.json({
        success: true,
        data: { referenceId: "inq-ref-1" },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["contact", "request-quote"] as const)(
    "renders the same three-field contract in %s mode",
    (source) => {
      const { container, copy } = renderInquiryForm(source);
      assertThreeFieldContract(container, copy);
    },
  );

  it("passes inquiry turnstile copy to LazyTurnstile", () => {
    const { copy } = renderInquiryForm("contact");

    expect(lazyTurnstileLabelsSpy).toHaveBeenCalledWith(copy.turnstile);
  });

  it("serializes a filled website honeypot into the inquiry payload", async () => {
    const { container } = renderInquiryForm("contact");
    const { fullName, email, form } = getFormControls(container);
    const honeypot = form.querySelector<HTMLInputElement>(
      'input[name="website"]',
    );

    expect(honeypot).not.toBeNull();
    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.change(honeypot!, {
      target: { value: "https://spam.example" },
    });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/inquiry",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(getFetchBody()).toMatchObject({
      fullName: "Ada Buyer",
      email: "ada@example.com",
      productInquiryKind: "general-rfq",
      website: "https://spam.example",
      turnstileToken: "mock-inquiry-turnstile-token",
    });
  });

  it("posts to /api/inquiry with optional blank message", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { fullName, email, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/inquiry",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(getFetchBody()).toMatchObject({
      fullName: "Ada Buyer",
      email: "ada@example.com",
      productInquiryKind: "general-rfq",
      website: "",
      turnstileToken: "mock-inquiry-turnstile-token",
    });
    expect(getFetchBody()).not.toHaveProperty("message");
    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
  });

  it("submits on Enter from a text control once Turnstile is ready", async () => {
    const { container } = renderInquiryForm("contact");
    const { fullName, email, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Enter Buyer" } });
    fireEvent.change(email, { target: { value: "enter@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("does not post without a Turnstile token", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { fullName, email, form } = getFormControls(container);

    fireEvent.change(fullName, { target: { value: "No Token" } });
    fireEvent.change(email, { target: { value: "token@example.com" } });

    // 按钮在拿到令牌前必须是禁用的。把 `disabled={isSubmitting || !turnstileReady}`
    // 里的 `!turnstileReady` 去掉，下面两条依然全绿——买家点得动，然后收到一次
    // 假的「安全校验失败」。禁用是第一道，不发请求是第二道，两道都要守。
    expect(screen.getByRole("button", { name: copy.submit })).toBeDisabled();

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(copy.errors.securitySummary)).toBeInTheDocument();
  });

  it("shows field, security, and server summaries from the decoder", async () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const { container } = render(
      <InquiryForm
        context={GENERAL_CONTEXT}
        copy={copy}
        fallback={fallback}
        source="contact"
      />,
    );
    const { fullName, email, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Error Buyer" } });
    fireEvent.change(email, { target: { value: "error@example.com" } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: "INQUIRY_VALIDATION_FAILED",
          details: ["errors.fullName.required"],
        }),
        { status: 400 },
      ),
    );

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(
      await screen.findByText(copy.errors.fieldSummary),
    ).toBeInTheDocument();
  });

  it("renders recognized field errors with aria relationships", async () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const { container } = render(
      <InquiryForm
        context={GENERAL_CONTEXT}
        copy={copy}
        fallback={fallback}
        source="contact"
      />,
    );
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.change(message, { target: { value: "x".repeat(2001) } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: "INQUIRY_VALIDATION_FAILED",
          details: [
            "errors.fullName.invalid",
            "errors.email.invalid",
            "errors.message.tooLong",
            "errors.phone.invalid",
          ],
        }),
        { status: 400 },
      ),
    );

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(
      await screen.findByText(copy.errors.fieldSummary),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.errors.fullName.invalid)).toHaveClass(
      "text-[var(--error-foreground)]",
    );
    expect(screen.getByText(copy.errors.email.invalid)).toHaveClass(
      "text-[var(--error-foreground)]",
    );
    expect(screen.getByText(copy.errors.message.tooLong)).toHaveClass(
      "text-[var(--error-foreground)]",
    );
    expect(screen.queryByText("errors.phone.invalid")).not.toBeInTheDocument();

    expect(fullName).toHaveAttribute("aria-invalid", "true");
    expect(fullName).toHaveAttribute(
      "aria-describedby",
      "inquiry-full-name-error",
    );
    expect(document.getElementById("inquiry-full-name-error")).toBeTruthy();

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "inquiry-email-error");
    expect(document.getElementById("inquiry-email-error")).toBeTruthy();

    expect(message).toHaveAttribute("aria-invalid", "true");
    expect(message).toHaveAttribute(
      "aria-describedby",
      "inquiry-message-hint inquiry-message-error",
    );
    expect(document.getElementById("inquiry-message-error")).toBeTruthy();
    expect(document.getElementById("inquiry-message-hint")).toBeTruthy();
  });

  it("clears fullName, email, and message after contact success while keeping the reference ID", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.change(message, {
      target: { value: "Need flood barrier specs" },
    });

    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
    expect(fullName).toHaveValue("");
    expect(email).toHaveValue("");
    expect(message).toHaveValue("");
  });

  it("clears estimator-prefilled message after catalog RFQ success", async () => {
    const estimatorMessage = "Need span data for 40m opening";
    const { container, copy } = renderInquiryForm("request-quote", {
      kind: "catalog-context",
      catalogProductId: "frp-flood-barriers",
      displayLabel: "FRP Composite Planks",
      initialMessage: estimatorMessage,
    });
    const { fullName, email, message, form } = getFormControls(container);

    expect(message).toHaveValue(estimatorMessage);
    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "RFQ Buyer" } });
    fireEvent.change(email, { target: { value: "rfq@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
    expect(fullName).toHaveValue("");
    expect(email).toHaveValue("");
    expect(message).toHaveValue("");
  });

  it("preserves filled fields after validation failure", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Error Buyer" } });
    fireEvent.change(email, { target: { value: "error@example.com" } });
    fireEvent.change(message, { target: { value: "Keep this text" } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: "INQUIRY_VALIDATION_FAILED",
          details: ["errors.email.invalid"],
        }),
        { status: 400 },
      ),
    );

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(
      await screen.findByText(copy.errors.fieldSummary),
    ).toBeInTheDocument();
    expect(fullName).toHaveValue("Error Buyer");
    expect(email).toHaveValue("error@example.com");
    expect(message).toHaveValue("Keep this text");
  });

  it("preserves filled fields after HTTP 429 and accepts retry after fresh Turnstile", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Retry Buyer" } });
    fireEvent.change(email, { target: { value: "retry@example.com" } });
    fireEvent.change(message, { target: { value: "Retry message" } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: "RATE_LIMIT_EXCEEDED",
        }),
        { status: 429 },
      ),
    );

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(
      await screen.findByText(copy.errors.serverSummary),
    ).toBeInTheDocument();
    expect(fullName).toHaveValue("Retry Buyer");
    expect(email).toHaveValue("retry@example.com");
    expect(message).toHaveValue("Retry message");

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(getFetchBody()).toMatchObject({
      fullName: "Retry Buyer",
      email: "retry@example.com",
      message: "Retry message",
      turnstileToken: "mock-inquiry-turnstile-token",
    });
  });

  it("keeps summary-only behavior for unknown field details", async () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const { container } = render(
      <InquiryForm
        context={GENERAL_CONTEXT}
        copy={copy}
        fallback={fallback}
        source="contact"
      />,
    );
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: "INQUIRY_VALIDATION_FAILED",
          details: ["errors.phone.invalid", "errors.company.tooLong"],
        }),
        { status: 400 },
      ),
    );

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(
      await screen.findByText(copy.errors.fieldSummary),
    ).toBeInTheDocument();
    expect(screen.queryByText("errors.phone.invalid")).not.toBeInTheDocument();
    expect(fullName).not.toHaveAttribute("aria-invalid");
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(message).not.toHaveAttribute("aria-invalid");
    expect(message).toHaveAttribute("aria-describedby", "inquiry-message-hint");
  });
});

function setRequestQuoteSearch(search: string) {
  vi.stubGlobal("location", {
    ...window.location,
    href: `http://localhost/request-quote${search}`,
    pathname: "/request-quote",
    search,
  });
}

describe("InquiryForm hydration", () => {
  it("SSR renders the static fallback without a live form or validated context", () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const html = renderToString(
      <InquiryForm
        context={{
          kind: "catalog-context",
          catalogProductId: "frp-flood-barriers",
          displayLabel: "FRP Composite Planks",
          initialMessage: "estimator-summary",
        }}
        copy={copy}
        fallback={fallback}
        source="request-quote"
      />,
    );

    expect(html).toContain('data-testid="inquiry-form-static-fallback"');
    expect(html).toContain(copy.noJsExplanation);
    expect(html).not.toMatch(/<form[\s>]/);
    expect(html).not.toContain("inquiry-buyer-interest-context");
    expect(html).not.toContain('data-testid="inquiry-form"');
  });

  it("hydrates validated context only after the live form mounts", async () => {
    const { container, copy } = renderInquiryForm("request-quote", {
      kind: "general-context",
      buyerInterest: "reseller project",
      initialMessage: "Visible prefill",
    });

    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).toHaveTextContent("reseller project");
    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).toHaveTextContent(copy.contextLabel);
    expect(getFormControls(container).message).toHaveValue("Visible prefill");
  });
});

describe("InquiryForm validated context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    global.fetch = vi.fn(async () =>
      Response.json({
        success: true,
        data: { referenceId: "inq-ref-rfq" },
      }),
    );
  });

  it("does not submit buyerInterest when catalog handoff includes interest query param", async () => {
    const context = resolveInquiryContext({
      catalogProductId: "frp-flood-barriers",
      interest: "hidden coastal project",
      config: "Need span data",
    });
    const { container } = renderInquiryForm("request-quote", context);
    const { fullName, email, form, message } = getFormControls(container);

    expect(message).toHaveValue("Need span data");
    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).toHaveTextContent("FRP Composite Planks");
    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).not.toHaveTextContent("hidden coastal project");

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "RFQ Buyer" } });
    fireEvent.change(email, { target: { value: "rfq@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(getFetchBody()).toMatchObject({
      productInquiryKind: "catalog-product",
      catalogProductId: "frp-flood-barriers",
    });
    expect(getFetchBody()).not.toHaveProperty("buyerInterest");
  });

  it("renders the server-resolved catalog label and submits catalog identity", async () => {
    const { container, copy } = renderInquiryForm("request-quote", {
      kind: "catalog-context",
      catalogProductId: "frp-flood-barriers",
      displayLabel: "FRP Composite Planks",
    });

    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).toHaveTextContent("FRP Composite Planks");
    expect(
      screen.getByTestId("inquiry-buyer-interest-context"),
    ).toHaveTextContent(copy.contextLabel);

    const { fullName, email, form } = getFormControls(container);
    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "RFQ Buyer" } });
    fireEvent.change(email, { target: { value: "rfq@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(getFetchBody()).toMatchObject({
      productInquiryKind: "catalog-product",
      catalogProductId: "frp-flood-barriers",
    });
    expect(getFetchBody()).not.toHaveProperty("buyerInterest");
  });

  it("submits general RFQ with buyerInterest and no catalog ID", async () => {
    const interest = "x".repeat(MAX_LEAD_PRODUCT_NAME_LENGTH);
    const { container } = renderInquiryForm("request-quote", {
      kind: "general-context",
      buyerInterest: interest,
    });

    const { fullName, email, form } = getFormControls(container);
    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "RFQ Buyer" } });
    fireEvent.change(email, { target: { value: "rfq@example.com" } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(getFetchBody()).toMatchObject({
      buyerInterest: interest,
      productInquiryKind: "general-rfq",
    });
    expect(getFetchBody()).not.toHaveProperty("catalogProductId");
  });

  it("pre-fills, edits, and clears the initial message", async () => {
    const { container } = renderInquiryForm("request-quote", {
      kind: "general-context",
      initialMessage: "c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH),
    });
    const { message } = getFormControls(container);

    expect(message).toHaveValue("c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH));
    fireEvent.change(message, {
      target: { value: "Edited estimator summary" },
    });
    expect(message).toHaveValue("Edited estimator summary");
    fireEvent.change(message, { target: { value: "" } });
    expect(message).toHaveValue("");
  });

  it("keeps attribution, honeypot, and Turnstile fields in catalog submissions", async () => {
    window.sessionStorage.setItem(
      "marketing_attribution",
      JSON.stringify({
        utmSource: "google",
        gclid: "gclid-rfq-123",
        landingPage: "/en/request-quote",
      }),
    );
    const { container } = renderInquiryForm("request-quote", {
      kind: "catalog-context",
      catalogProductId: "abs-flood-barriers",
      displayLabel: "ABS Interlocking Boxwall",
    });
    const { fullName, email, form } = getFormControls(container);
    const honeypot = form.querySelector<HTMLInputElement>(
      'input[name="website"]',
    );

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.change(honeypot!, {
      target: { value: "https://spam.example" },
    });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(getFetchBody()).toMatchObject({
      productInquiryKind: "catalog-product",
      catalogProductId: "abs-flood-barriers",
      website: "https://spam.example",
      turnstileToken: "mock-inquiry-turnstile-token",
      utmSource: "google",
      gclid: "gclid-rfq-123",
      landingPage: "/en/request-quote",
    });
  });

  it("ignores request-quote context when contact uses general-context", () => {
    setRequestQuoteSearch("?catalogProductId=frp-flood-barriers&config=hidden");
    const { container } = renderInquiryForm("contact", GENERAL_CONTEXT);

    expect(screen.queryByTestId("inquiry-buyer-interest-context")).toBeNull();
    expect(getFormControls(container).message).toHaveValue("");
  });
});

describe("InquiryFormStaticFallback", () => {
  it("shows the no-JS explanation and public email without a form or submit control", () => {
    const copy = createTestInquiryFormCopy();
    const { container } = render(<InquiryFormStaticFallback copy={copy} />);

    expect(screen.getByText(copy.noJsExplanation)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
