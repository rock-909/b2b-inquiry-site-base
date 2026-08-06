import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { ImpactValue, Result, RunOptions } from "axe-core";

/**
 * 使用 AxeBuilder 封装的可访问性检查工具，替代旧版 checkA11y/injectAxe API。
 * 仅在 Playwright E2E 测试中使用，不影响业务代码。
 */
export async function injectAxe(_page: Page): Promise<void> {
  // 对于当前 @axe-core/playwright 版本，AxeBuilder 会在 analyze() 时自动注入 axe-core，
  // 因此这里保留一个空实现以兼容旧调用签名，方便后续按需扩展。
}

export interface AxeCheckOptions {
  /** 是否生成详细报告（目前主要用于与现有调用签名保持一致） */
  detailedReport?: boolean;
  /** 详细报告配置，例如 { html: true } */
  detailedReportOptions?: {
    html?: boolean;
  };
  /** 透传给 axe-core 的运行选项，便于按调用点关闭已知噪音规则 */
  axeOptions?: RunOptions;
  /** 仅关注的影响级别，例如 ['critical', 'serious'] */
  includedImpacts?: NonNullable<ImpactValue>[];
}

const MAX_CSS_ANIMATION_SETTLE_MS = 1_200;
const MIN_SETTLED_TEXT_OPACITY = 0.99;

function formatViolationNode(node: Result["nodes"][number]): string {
  const target = node.target.join(", ");
  const summary = node.failureSummary ?? node.html;

  return `    - ${target}: ${summary}`;
}

function formatViolation(violation: Result): string {
  const nodes = violation.nodes.slice(0, 3).map(formatViolationNode).join("\n");

  return [
    `  ${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}`,
    `    ${violation.helpUrl}`,
    nodes,
  ]
    .filter(Boolean)
    .join("\n");
}

function getRelevantViolations(
  violations: Result[],
  includedImpacts?: NonNullable<ImpactValue>[],
): Result[] {
  if (!includedImpacts || includedImpacts.length === 0) {
    return violations;
  }

  return violations.filter(
    (violation) =>
      violation.impact !== null &&
      violation.impact !== undefined &&
      includedImpacts.includes(violation.impact),
  );
}

async function waitForFiniteCssAnimations(
  page: Page,
  context?: string,
): Promise<void> {
  await page.evaluate(
    async ({ maxWaitMs, context }) => {
      if (typeof document.getAnimations !== "function") {
        return;
      }

      const animationRoots = context
        ? Array.from(document.querySelectorAll(context))
        : [document];
      if (animationRoots.length === 0) {
        return;
      }

      const animations = new Set<Animation>();
      for (const animationRoot of animationRoots) {
        for (const animation of animationRoot.getAnimations({
          subtree: true,
        })) {
          animations.add(animation);
        }
      }

      const activeAnimations = Array.from(animations).filter((animation) => {
        if (
          animation.playState === "finished" ||
          animation.playState === "idle" ||
          !animation.effect
        ) {
          return false;
        }

        const endTime = animation.effect.getComputedTiming().endTime;
        return (
          typeof endTime === "number" && endTime > 0 && Number.isFinite(endTime)
        );
      });

      if (activeAnimations.length === 0) {
        return;
      }

      await Promise.race([
        Promise.allSettled(
          activeAnimations.map((animation) =>
            animation.finished.catch(() => undefined),
          ),
        ),
        new Promise((resolve) => window.setTimeout(resolve, maxWaitMs)),
      ]);
    },
    { context, maxWaitMs: MAX_CSS_ANIMATION_SETTLE_MS },
  );
}

async function waitForVisibleTextOpacity(
  page: Page,
  context?: string,
): Promise<void> {
  await page
    .waitForFunction(
      ({ context, minOpacity }) => {
        const roots =
          context && context.length > 0
            ? Array.from(document.querySelectorAll(context))
            : [document.body ?? document.documentElement];

        if (roots.length === 0) {
          return true;
        }

        const elements = roots.flatMap((root) => [
          root,
          ...Array.from(root.querySelectorAll("*")),
        ]);

        for (const element of elements) {
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") {
            continue;
          }

          if (!element.textContent?.trim()) {
            continue;
          }

          if (element.getClientRects().length === 0) {
            continue;
          }

          const opacity = Number.parseFloat(style.opacity);
          if (Number.isFinite(opacity) && opacity < minOpacity) {
            return false;
          }
        }

        return true;
      },
      { context, minOpacity: MIN_SETTLED_TEXT_OPACITY },
      { timeout: MAX_CSS_ANIMATION_SETTLE_MS },
    )
    .catch(() => undefined);
}

export async function checkA11y(
  page: Page,
  context?: string,
  options?: AxeCheckOptions,
): Promise<void> {
  await waitForFiniteCssAnimations(page, context);
  await waitForVisibleTextOpacity(page, context);

  const builder = new AxeBuilder({ page });

  if (context) {
    builder.include(context);
  }

  if (options?.axeOptions) {
    builder.options(options.axeOptions);
  }

  const results = await builder.analyze();
  const violations = getRelevantViolations(
    results.violations,
    options?.includedImpacts,
  );

  if (violations.length > 0) {
    throw new Error(
      [
        `Axe accessibility violations found: ${violations.length}`,
        ...violations.map(formatViolation),
      ].join("\n\n"),
    );
  }
}
