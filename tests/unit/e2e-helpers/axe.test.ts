import type { Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkA11y } from "../../e2e/helpers/axe";

const axeMocks = vi.hoisted(() => {
  const builder = {
    analyze: vi.fn(async () => ({ violations: [] })),
    include: vi.fn(),
    options: vi.fn(),
  };
  builder.include.mockReturnValue(builder);
  builder.options.mockReturnValue(builder);

  return {
    AxeBuilder: vi.fn(function AxeBuilder() {
      return builder;
    }),
    analyze: builder.analyze,
    include: builder.include,
    options: builder.options,
  };
});

vi.mock("@axe-core/playwright", () => ({
  default: axeMocks.AxeBuilder,
}));

function createPage() {
  return {
    evaluate: vi.fn(async () => undefined),
    waitForFunction: vi.fn(async () => undefined),
  } as unknown as Page;
}

describe("checkA11y", () => {
  beforeEach(() => {
    axeMocks.AxeBuilder.mockClear();
    axeMocks.analyze.mockClear();
    axeMocks.include.mockClear();
    axeMocks.options.mockClear();
  });

  it("passes a selector context through to AxeBuilder.include", async () => {
    const page = createPage();
    const context = 'main, nav[aria-label="Main navigation"]';

    await checkA11y(page, context);

    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), {
      context,
      maxWaitMs: 1_200,
    });
    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        context,
        minOpacity: 0.99,
      },
      { timeout: 1_200 },
    );
    expect(axeMocks.include).toHaveBeenCalledWith(context);
    expect(axeMocks.analyze).toHaveBeenCalledTimes(1);
  });
});
