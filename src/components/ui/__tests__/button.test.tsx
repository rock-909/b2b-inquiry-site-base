import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * 原来 27 条里有 19 条在逐个断言 Tailwind class 字符串：每个 variant 一条、每个
 * size 一条、focus/disabled/svg 的 class 各一条。改一个 token 名就要同步改测试，
 * 而按钮长什么样它一条都证明不了。
 *
 * 保留的是一张语义映射表，直接断言 `buttonVariants()`：每个 variant 引用属于它
 * 那一档的 token。它守的是「default 和 outline 被对调」这种会翻转全站 CTA 视觉
 * 层级的故障，而不是复述每条 class 串。
 *
 * 另外原来 mock 掉了 `@radix-ui/react-slot`，所以 asChild 那条测的是 mock 自己的
 * cloneElement。现在用真 Slot：产品页 CTA 就是靠这条路径把按钮样式套到链接上的。
 */

describe("Button", () => {
  it("renders a button carrying its label", () => {
    render(<Button>Request a Quote</Button>);

    const button = screen.getByRole("button", { name: "Request a Quote" });
    expect(button).toHaveAttribute("data-slot", "button");
  });

  it("calls its handler when clicked", () => {
    const submitInquiry = vi.fn();
    render(<Button onClick={submitInquiry}>Send</Button>);

    fireEvent.click(screen.getByRole("button"));

    expect(submitInquiry).toHaveBeenCalledTimes(1);
  });

  it("swallows clicks while disabled", () => {
    const submitInquiry = vi.fn();
    render(
      <Button onClick={submitInquiry} disabled>
        Send
      </Button>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  // 产品页 CTA 走的就是这条：Slot 把按钮的 class 和 data-slot 合并到子链接上，
  // 渲染出来的必须还是一个 link，不能变成嵌在按钮里的链接。
  it("hands its styling to the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/request-quote">Request a Quote</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Request a Quote" });
    expect(link).toHaveAttribute("href", "/request-quote");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // 只断言「不同 variant 产出不同 class」抓不到最要命的那种故障：把 default 和
  // outline 的样式对调，产出仍然各不相同，但全站主 CTA 的视觉层级已经反了。
  // 所以这里钉的是语义映射本身——每个 variant 必须引用属于它那一档的 token。
  // 这是一张有意为之的映射表，不是逐个 variant 复述它的完整 class 串。
  it.each([
    ["default", "var(--button-primary-bg)"],
    ["destructive", "bg-destructive"],
    ["outline", "var(--button-outline-border)"],
    ["secondary", "bg-secondary"],
    ["ghost", "hover:bg-accent"],
    ["link", "underline-offset-4"],
    ["accent", "bg-accent"],
    ["on-dark", "var(--neutral-1)"],
    ["ghost-dark", "var(--neutral-1)"],
  ] as const)("maps the %s variant to its own token", (variant, token) => {
    expect(buttonVariants({ variant })).toContain(token);
  });

  it.each([
    ["default", "var(--button-height-default)"],
    ["sm", "var(--button-height-sm)"],
    ["lg", "var(--button-height-lg)"],
    ["icon", "size-9"],
  ] as const)("maps the %s size to its own height token", (size, token) => {
    expect(buttonVariants({ size })).toContain(token);
  });

  it("keeps a caller's className alongside its own", () => {
    render(<Button className="mt-6">Spaced</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("mt-6");
    expect(button.className.split(" ").length).toBeGreaterThan(1);
  });

  it("keeps the shared keyboard, disabled, and nested-icon affordances", () => {
    const classes = buttonVariants();

    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("disabled:pointer-events-none");
    expect(classes).toContain("disabled:opacity-50");
    expect(classes).toContain("[&_svg]:pointer-events-none");
  });
});
