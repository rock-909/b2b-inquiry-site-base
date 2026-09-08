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
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";
import { turnstileLabelsSpy } from "@/test/inquiry-turnstile-mock";
import {
  getFormControls,
  renderInquiryForm,
} from "@/test/inquiry-form-harness";

vi.mock(
  "@/components/security/turnstile",
  async () => await import("@/test/inquiry-turnstile-mock"),
);

const FORBIDDEN_CONTROL_NAMES = [
  "phone",
  "company",
  "subject",
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
    turnstileLabelsSpy.mockClear();
    window.localStorage.clear();
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

  it("renders the three-field contract", () => {
    const { container, copy } = renderInquiryForm();
    assertThreeFieldContract(container, copy);
  });

  it("passes inquiry copy to TurnstileWidget", () => {
    const { copy } = renderInquiryForm();

    expect(turnstileLabelsSpy).toHaveBeenCalledWith(copy.turnstile);
  });

  it("truncates oversized initialMessage to the message limit", async () => {
    // 设计条件 E-1：initialMessage 在组件入口截断到 MAX_LEAD_MESSAGE_LENGTH，
    // 避免超长初始值先过浏览器 maxLength 再被服务端 400。
    const longMessage = "A".repeat(2001);
    const { container } = renderInquiryForm({ initialMessage: longMessage });
    const message = getFormControls(container).message;

    expect(message).toHaveValue("A".repeat(2000));
  });

  it("restores the current-tab inquiry draft after the form remounts", () => {
    const firstRender = renderInquiryForm();
    const firstControls = getFormControls(firstRender.container);

    fireEvent.input(firstControls.fullName, {
      target: { value: "Ada Buyer" },
    });
    fireEvent.input(firstControls.email, {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(firstControls.message, {
      target: { value: "Keep this inquiry while switching languages" },
    });

    firstRender.unmount();
    const secondRender = renderInquiryForm();
    const restored = getFormControls(secondRender.container);

    expect(restored.fullName).toHaveValue("Ada Buyer");
    expect(restored.email).toHaveValue("ada@example.com");
    expect(restored.message).toHaveValue(
      "Keep this inquiry while switching languages",
    );
  });

  it("ignores invalid inquiry draft data", () => {
    window.sessionStorage.setItem("inquiry-draft", "not-json");

    const { container } = renderInquiryForm({
      initialMessage: "Initial product inquiry",
    });
    const controls = getFormControls(container);

    expect(controls.fullName).toHaveValue("");
    expect(controls.email).toHaveValue("");
    expect(controls.message).toHaveValue("Initial product inquiry");
  });

  it("serializes a filled website honeypot into the inquiry payload", async () => {
    const { container } = renderInquiryForm();
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
      website: "https://spam.example",
      turnstileToken: "mock-inquiry-turnstile-token",
    });
  });

  it("posts to /api/inquiry with optional blank message", async () => {
    const { container, copy } = renderInquiryForm();
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
      website: "",
      turnstileToken: "mock-inquiry-turnstile-token",
    });
    expect(getFetchBody()).not.toHaveProperty("message");
    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
  });

  it("submits on Enter from a text control once Turnstile is ready", async () => {
    const { container } = renderInquiryForm();
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
    const { container, copy } = renderInquiryForm();
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
      <InquiryForm copy={copy} fallback={fallback} />,
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
      <InquiryForm copy={copy} fallback={fallback} />,
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

    // 焦点管理合同（组件层证明接线；真实视口滚动由 E2E 证明）：
    // 第一个无效字段获得焦点。
    await waitFor(() => expect(document.activeElement).toBe(fullName));

    // 错误摘要走程序化聚焦单通道：不得保留 role="alert"/aria-live，
    // 否则与焦点播报形成双重朗读。role/aria-live 挂在 callout 根元素，
    // 必须定位根元素断言——查内层文本 div 会造成假绿灯。
    const summaryCallout = screen
      .getByText(copy.errors.fieldSummary)
      .closest('[data-slot="status-callout"]');
    expect(summaryCallout).not.toBeNull();
    expect(summaryCallout).not.toHaveAttribute("role", "alert");
    expect(summaryCallout).not.toHaveAttribute("aria-live");
  });

  it("clears fullName, email, and message after contact success while keeping the reference ID", async () => {
    const { container, copy } = renderInquiryForm();
    const { fullName, email, message, form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    fireEvent.change(fullName, { target: { value: "Ada Buyer" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.change(message, {
      target: { value: "Need sample offering specs" },
    });
    fireEvent.input(form);

    expect(window.sessionStorage.getItem("inquiry-draft")).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
    expect(fullName).toHaveValue("");
    expect(email).toHaveValue("");
    expect(message).toHaveValue("");
    expect(window.sessionStorage.getItem("inquiry-draft")).toBeNull();
  });

  it("preserves filled fields after validation failure", async () => {
    const { container, copy } = renderInquiryForm();
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

  it("shows a rate-limit state with cooldown and gates resubmission after HTTP 429", async () => {
    vi.useFakeTimers();
    // 断言失败也不能把假时钟泄漏给后续测试。
    try {
      const { container, copy } = renderInquiryForm();
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
          { status: 429, headers: { "Retry-After": "60" } },
        ),
      );

      await act(async () => {
        fireEvent.submit(form);
      });

      // 限流有专属文案，不再伪装成服务器故障；已填内容保留。
      expect(
        screen.getByText(copy.errors.rateLimitSummary),
      ).toBeInTheDocument();
      expect(fullName).toHaveValue("Retry Buyer");
      expect(email).toHaveValue("retry@example.com");
      expect(message).toHaveValue("Retry message");

      // 冷却期内按钮门控，Enter 提交不发第二次请求，也不覆盖限流反馈。
      const submitButton = within(form).getByRole("button", {
        name: copy.submit,
      });
      expect(submitButton).toBeDisabled();

      await act(async () => {
        fireEvent.submit(form);
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(copy.errors.rateLimitSummary),
      ).toBeInTheDocument();

      // 冷却期内即使取得新 token，限流门控仍然优先：按钮不允许提前解锁。
      fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
      expect(submitButton).toBeDisabled();

      await act(async () => {
        fireEvent.submit(form);
      });
      expect(fetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      // 冷却结束有 ready 提示；冷却期内已取得的新令牌此刻生效，按钮解锁。
      expect(screen.getByText(copy.errors.rateLimitReady)).toBeInTheDocument();
      expect(submitButton).toBeEnabled();

      await act(async () => {
        fireEvent.submit(form);
      });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(getFetchBody()).toMatchObject({
        fullName: "Retry Buyer",
        email: "retry@example.com",
        message: "Retry message",
        turnstileToken: "mock-inquiry-turnstile-token",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains Turnstile expiry without stealing focus and recovers on a fresh token", async () => {
    const { container, copy } = renderInquiryForm();
    const { form } = getFormControls(container);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    const submitButton = within(form).getByRole("button", {
      name: copy.submit,
    });
    expect(submitButton).toBeEnabled();
    expect(screen.queryByText(copy.turnstile.expired)).not.toBeInTheDocument();

    // 买家填了几分钟长文后令牌过期：按钮禁用，但出现解释性提示。
    // 过期提示不得抢走当前输入焦点（polite 提示 + 不移动焦点）。
    const messageBox = container.querySelector(
      'textarea[name="message"]',
    ) as HTMLTextAreaElement;
    messageBox.focus();
    fireEvent.click(screen.getByTestId("inquiry-turnstile-expire"));

    expect(await screen.findByText(copy.turnstile.expired)).toBeVisible();
    expect(document.activeElement).toBe(messageBox);

    // 新令牌到达后提示消失、按钮恢复，不需要任何手动刷新。
    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    expect(screen.queryByText(copy.turnstile.expired)).not.toBeInTheDocument();
    expect(submitButton).toBeEnabled();
  });

  it("keeps summary-only behavior for unknown field details", async () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const { container } = render(
      <InquiryForm copy={copy} fallback={fallback} />,
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

    // 无可识别字段错误时，聚焦降级目标：错误摘要（tabIndex=-1，可程序聚焦
    // 但不进入 Tab 序）。
    // ref 挂在 callout 根元素上，文本是其子节点：定位到根再比较。
    const summaryCallout = screen
      .getByText(copy.errors.fieldSummary)
      .closest('[data-slot="status-callout"]');
    await waitFor(() => expect(document.activeElement).toBe(summaryCallout));
  });
});

describe("InquiryForm hydration", () => {
  it("SSR renders the static fallback without a live form", () => {
    const copy = createTestInquiryFormCopy();
    const fallback = <InquiryFormStaticFallback copy={copy} />;
    const html = renderToString(
      <InquiryForm copy={copy} fallback={fallback} />,
    );

    expect(html).toContain('data-testid="inquiry-form-static-fallback"');
    expect(html).toContain(copy.noJsExplanation);
    expect(html).not.toMatch(/<form[\s>]/);
    expect(html).not.toContain('data-testid="inquiry-form"');
  });
});

describe("InquiryFormStaticFallback", () => {
  it("shows the no-JS explanation and public email without a form or submit control", () => {
    const copy = createTestInquiryFormCopy();
    const { container } = render(<InquiryFormStaticFallback copy={copy} />);

    expect(screen.getByText(copy.noJsExplanation)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
