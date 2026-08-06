import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "@/components/ui/separator";

/**
 * 这个组件全部的逻辑就是按 orientation 在两组尺寸 class 之间二选一，再 merge
 * 调用方传进来的 className。生产代码只有一处用它：mobile-navigation-interactive
 * 的 `<Separator className="my-4" />`。
 *
 * 原来 23 条测试里有两条整个函数体没有 expect，其余大半在逐个断言 Tailwind
 * class 字符串、原生 div 的属性透传和 displayName。留下的三条覆盖它的全部分支。
 */

describe("Separator", () => {
  it("lays out horizontally by default", () => {
    render(<Separator data-testid="separator" />);

    expect(screen.getByTestId("separator")).toHaveClass("h-[1px]", "w-full");
  });

  it("flips its axis when asked to run vertically", () => {
    render(<Separator orientation="vertical" data-testid="separator" />);

    const separator = screen.getByTestId("separator");
    expect(separator).toHaveClass("h-full", "w-[1px]");
    expect(separator).not.toHaveClass("h-[1px]", "w-full");
  });

  // 唯一的生产用法是传 className 加外边距，合并不能把尺寸和底色 class 挤掉。
  it("keeps its own classes when the caller adds more", () => {
    render(<Separator className="my-4" data-testid="separator" />);

    expect(screen.getByTestId("separator")).toHaveClass(
      "my-4",
      "bg-border",
      "shrink-0",
      "h-[1px]",
      "w-full",
    );
  });
});
