import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFormControls,
  renderInquiryForm,
} from "@/test/inquiry-form-harness";
import { turnstileWidgetResetSpy } from "@/test/inquiry-turnstile-mock";
import { AIRTABLE_REQUEST_TIMEOUT_MS } from "@/lib/airtable/service";
import { DEFAULT_RESEND_TIMEOUT_MS } from "@/lib/email/resend-http-client";
import { TURNSTILE_VERIFY_TIMEOUT_MS } from "@/lib/security/turnstile";
import { UPSTASH_OPERATION_TIMEOUT_MS } from "@/lib/security/stores/rate-limit-store";

vi.mock(
  "@/components/forms/lazy-turnstile",
  async () => await import("@/test/inquiry-turnstile-mock"),
);

/**
 * 提交生命周期的行为证明：提交锁、令牌一次性、widget 重置、网络异常降级。
 *
 * 这些以前由一个共用提交 hook 的测试守着，测的是那个 hook 的内部状态机；逻辑
 * 内联回表单后，守的是买家真正看得见的东西。
 * 字段契约与错误文案在 `inquiry-form.test.tsx`，装备两边共用。
 */

function successResponse() {
  return Response.json({ success: true, data: { referenceId: "inq-ref-1" } });
}

function fillRequiredFields(container: HTMLElement) {
  const controls = getFormControls(container);
  fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
  fireEvent.change(controls.fullName, { target: { value: "Ada Buyer" } });
  fireEvent.change(controls.email, { target: { value: "ada@example.com" } });
  return controls;
}

describe("InquiryForm submission lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    global.fetch = vi.fn(async () => successResponse());
  });

  it("locks the submit button while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { container, copy } = renderInquiryForm("contact");
    const { form } = fillRequiredFields(container);
    const submit = within(form).getByRole("button", { name: copy.submit });

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(submit).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);

    // 按钮禁用不等于关门：回车仍然能提交。不锁住的话买家连点两下，
    // 业主收到两条一模一样的询盘。
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(successResponse());
    });
    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );
  });

  it("requires a fresh Turnstile token for the next submit", async () => {
    const { container, copy } = renderInquiryForm("contact");
    const { form } = fillRequiredFields(container);

    await act(async () => {
      fireEvent.submit(form);
    });
    await screen.findByText(
      `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
    );

    // 令牌是一次性的。提交落定后不清掉，第二次提交会带着废令牌被服务端拒，
    // 买家看到的是一条无从下手的安全错误。
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.errors.securitySummary)).toBeInTheDocument();
  });

  it("resets the Turnstile widget after a failed submit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, errorCode: "RATE_LIMIT_EXCEEDED" }),
        { status: 429 },
      ),
    );

    const { container, copy } = renderInquiryForm("contact");
    const { form } = fillRequiredFields(container);

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(await screen.findByText(copy.errors.serverSummary)).toBeVisible();
    // 不让 widget 重新出题，买家就再也拿不到令牌，提交按钮永远禁用。
    expect(turnstileWidgetResetSpy).toHaveBeenCalledTimes(1);
  });

  it("recovers when the inquiry request never settles", async () => {
    vi.useFakeTimers();
    // jsdom 的 `AbortSignal.timeout` 走真实计时器，假时钟推不动它。换一个语义
    // 相同、但用可控计时器的实现，才能在测试里把整个请求预算跑完。
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(
          () =>
            controller.abort(
              new DOMException("The operation timed out.", "TimeoutError"),
            ),
          ms,
        );
        return controller.signal;
      });

    // 永不 settle 的请求。连接或 Worker 被中间盒吞掉时就是这个形状：fetch 既不
    // resolve 也不 reject，`mockRejectedValueOnce` 那条测试证明不了这一种。
    vi.mocked(fetch).mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const { container, copy } = renderInquiryForm("contact");
    const { form } = fillRequiredFields(container);

    await act(async () => {
      fireEvent.submit(form);
    });

    const budgetMs = timeoutSpy.mock.calls[0]?.[0];
    // 没有预算就没有出路：这一行在加超时之前就会红。
    expect(budgetMs).toBeTypeOf("number");
    // 服务端串行最坏耗时由这四个常量相加得出，不能手抄一个总和：任何一段调大，
    // 手抄的数不会红，客户端预算会悄悄变得不够，买家看到假的「服务器错误」而请求
    // 其实还在正常处理。
    const serverWorstCaseMs =
      UPSTASH_OPERATION_TIMEOUT_MS +
      TURNSTILE_VERIFY_TIMEOUT_MS +
      DEFAULT_RESEND_TIMEOUT_MS +
      AIRTABLE_REQUEST_TIMEOUT_MS;
    expect(Number(budgetMs)).toBeGreaterThan(serverWorstCaseMs);
    // 也要有上界：预算调到五分钟同样是死路，买家只会看着按钮一直转。
    expect(Number(budgetMs)).toBeLessThan(serverWorstCaseMs * 2);

    await act(async () => {
      vi.advanceTimersByTime(Number(budgetMs));
    });

    expect(screen.getByText(copy.errors.serverSummary)).toBeVisible();
    // 令牌一次性，落定后必须让 widget 重新出题，否则按钮永远禁用。
    expect(turnstileWidgetResetSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("inquiry-turnstile-success"));
    expect(
      within(form).getByRole("button", { name: copy.submit }),
    ).toBeEnabled();

    timeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it("still submits on browsers without AbortSignal", async () => {
    // 支持范围外的老浏览器连 `AbortSignal` 全局都没有。探测写成
    // `typeof AbortSignal.timeout` 会抛 ReferenceError，异常逃出去之后表单永远
    // 停在「提交中」——为了加预算反而造出一条更死的路。宁可退回没有预算的老行为。
    const original = globalThis.AbortSignal;
    Reflect.deleteProperty(globalThis, "AbortSignal");

    try {
      const { container, copy } = renderInquiryForm("contact");
      const { form } = fillRequiredFields(container);

      await act(async () => {
        fireEvent.submit(form);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      await screen.findByText(
        `${copy.success} ${copy.referenceLabel}: inq-ref-1`,
      );
    } finally {
      globalThis.AbortSignal = original;
    }
  });

  it("shows a server error when the network request throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { container, copy } = renderInquiryForm("contact");
    const { form, fullName, email } = fillRequiredFields(container);

    await act(async () => {
      fireEvent.submit(form);
    });

    expect(await screen.findByText(copy.errors.serverSummary)).toBeVisible();
    // 断网不该顺手清空表单：买家重试时不用把字重打一遍。
    expect(fullName).toHaveValue("Ada Buyer");
    expect(email).toHaveValue("ada@example.com");
  });
});
