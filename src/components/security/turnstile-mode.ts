/**
 * Turnstile 部署模式裁决：环境读取与模式判定分离的纯函数。
 * 独立成无 JSX 的叶子模块，避免在组件文件中混入非组件导出；
 * 新增部署模式只改 resolveTurnstileWidgetMode，React 组件只消费结果。
 */

export type TurnstileWidgetMode = "bypass" | "test" | "live" | "unavailable";

interface TurnstileModeInput {
  siteKey: string | undefined;
  isDevelopment: boolean;
  devBypassEnabled: boolean;
  testModeEnabled: boolean;
  appEnv: string | undefined;
  isProductionBuild: boolean;
}

/**
 * 部署模式裁决的纯函数：环境读取与模式判定分离后，新增部署模式只改这里，
 * React 组件只消费结果。优先级：dev bypass > test/preview > live > unavailable。
 */
export function resolveTurnstileWidgetMode(
  input: TurnstileModeInput,
): TurnstileWidgetMode {
  if (input.isDevelopment && input.devBypassEnabled) {
    return "bypass";
  }

  // NODE_ENV=production 只说明这是 production build，不代表实际生产部署：
  // preview lane 同样是 production build。所以 build 非 production 时放行，
  // build 是 production 时只认部署标签明确为 preview 的那一条缝。
  const testEligible =
    input.appEnv !== "production" &&
    (!input.isProductionBuild || input.appEnv === "preview");

  if (input.testModeEnabled && testEligible) {
    return "test";
  }

  return input.siteKey ? "live" : "unavailable";
}
