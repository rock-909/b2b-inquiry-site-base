import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

describe("Button", () => {
  // 只断言「不同 variant 产出不同 class」抓不到最要命的那种故障：把 default 和
  // outline 的样式对调，产出仍然各不相同，但全站主 CTA 的视觉层级已经反了。
  // 所以这里钉的是语义映射本身——每个 variant 必须引用属于它那一档的 token。
  // 这是一张有意为之的映射表，不是逐个 variant 复述它的完整 class 串。
  it.each([
    ["default", "var(--button-primary-bg)"],
    ["outline", "var(--button-outline-border)"],
  ] as const)("maps the %s variant to its own token", (variant, token) => {
    expect(buttonVariants({ variant })).toContain(token);
  });

  it.each([
    ["default", "var(--button-height-default)"],
    ["sm", "var(--button-height-sm)"],
  ] as const)("maps the %s size to its own height token", (size, token) => {
    expect(buttonVariants({ size })).toContain(token);
  });

  it("keeps a caller's className alongside its own", () => {
    render(<Button className="mt-6">Spaced</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("mt-6");
    expect(button.className.split(" ").length).toBeGreaterThan(1);
  });
});
