import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card";

/**
 * 原来分三个文件十条：card.test 用 `it.each` 逐个子组件断言 base class，
 * card-accessibility 两条断的是调用方自己传进去的 role / aria-*（React 原生保证）。
 *
 * 保留两件事：data-slot 契约（CSS 靠它选中各部分），以及 header 的条件布局
 * ——`has-data-[slot=card-action]:` 是「有 action 时换成两列」这条规则的唯一
 * 落点，jsdom 验不了渲染结果，仓库也没有像素基线比较，所以这里钉住它的编码方式。
 *
 * 生产代码目前只用根 `<Card>`（联系页和询盘静态兜底），子组件只服务 Storybook。
 */

describe("Card", () => {
  it("composes its parts, each carrying the data slot CSS selects on", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="card-header">
          <CardTitle data-testid="card-title">Card Title</CardTitle>
          <CardDescription data-testid="card-description">
            Card description text
          </CardDescription>
          <CardAction data-testid="card-action">
            <button type="button">Action</button>
          </CardAction>
        </CardHeader>
        <CardContent data-testid="card-content">Main content</CardContent>
        <CardFooter data-testid="card-footer">
          <button type="button">Footer Button</button>
        </CardFooter>
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-slot", "card");

    for (const slot of [
      "card-header",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      expect(screen.getByTestId(slot)).toHaveAttribute("data-slot", slot);
      expect(card).toContainElement(screen.getByTestId(slot));
    }

    expect(card).toContainElement(
      screen.getByRole("button", { name: "Action" }),
    );
    expect(card).toContainElement(
      screen.getByRole("button", { name: "Footer Button" }),
    );
  });

  // 两端各钉一半：header 声明「出现 action 时改成两列」，action 声明自己占第二列。
  // 只留一半，另一半悄悄没了也不会红。
  it("keeps the two-column switch that an action triggers", () => {
    render(
      <>
        <CardHeader data-testid="card-header" />
        <CardAction data-testid="card-action" />
      </>,
    );

    expect(screen.getByTestId("card-header")).toHaveClass(
      "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    );
    expect(screen.getByTestId("card-action")).toHaveClass(
      "col-start-2",
      "justify-self-end",
    );
  });

  it("keeps a caller's className alongside its own", () => {
    render(
      <Card className="custom-card" data-testid="card">
        Card Content
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("custom-card", "surface-card");
  });
});
