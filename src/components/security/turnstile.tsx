"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  INQUIRY_TURNSTILE_ACTION,
  TURNSTILE_DUMMY_TEST_TOKEN,
} from "@/constants/turnstile-constants";
import { logger } from "@/lib/logger";
import {
  getPublicRuntimeEnvBoolean,
  getPublicRuntimeEnvString,
  isPublicRuntimeDevelopment,
  isPublicRuntimeProduction,
} from "@/lib/public-runtime-env";

/**
 * 使用全局 logger（开发环境输出，生产环境静默）
 */

type TurnstileDegradedKind = "unavailable" | "failed";

/**
 * 开发环境 bypass 模式的占位令牌：只为让提交按钮解锁，服务端不认这个值。
 *
 * 客户端看 `NEXT_PUBLIC_TURNSTILE_BYPASS`，服务端看 `TURNSTILE_BYPASS`，是两个
 * 独立开关，必须一起开。只开客户端那个，按钮会解锁但每次提交都被判
 * `TURNSTILE_REJECTED`——换了个死法而已。想让整条链路走通要用 test 模式的
 * dummy 令牌。
 */
const TURNSTILE_BYPASS_TOKEN = "TURNSTILE_BYPASS_TOKEN";

interface TurnstileLabels {
  unavailable: string;
  loadFailed: string;
  devBypass: string;
  testMode: string;
  rescueBeforeEmail: string;
  rescueAfterEmail: string;
  rescueEmail: string;
  rescueSubject: string;
}

interface TurnstileProps {
  onSuccess?: (_token: string) => void;
  onError?: (_error: string) => void;
  onExpire?: () => void;
  /**
   * Receives a widget `reset()` binder. May return an unregister/cleanup
   * function invoked when the widget unmounts or the binder changes.
   */
  onReadyRef?: (reset: () => void) => (() => void) | void;
  className?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  tabIndex?: number;
  id?: string;
  cData?: string;
  labels: TurnstileLabels;
}

interface TurnstileStatusProps {
  className: string | undefined;
  label: string;
}

function TurnstileBypassStatus({ className, label }: TurnstileStatusProps) {
  return (
    <output
      className={`turnstile-bypass ${className ?? ""}`}
      data-testid="turnstile-bypass"
      aria-live="polite"
    >
      <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-muted)] p-3 text-sm text-[var(--warning-foreground)]">
        {label}
      </div>
    </output>
  );
}

function TurnstileMockStatus({ className, label }: TurnstileStatusProps) {
  return (
    <div
      className={`turnstile-mock ${className ?? ""}`}
      data-testid="turnstile-mock"
    >
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function TurnstileRescueStatus({
  kind,
  labels,
}: {
  kind: TurnstileDegradedKind;
  labels: TurnstileLabels;
}) {
  return (
    <output className="turnstile-rescue" aria-live="polite">
      <div className="text-sm text-[var(--error-foreground)]">
        {kind === "unavailable" ? labels.unavailable : labels.loadFailed}
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {labels.rescueBeforeEmail}{" "}
        <a
          className="font-medium text-[var(--primary-text)] underline underline-offset-4 hover:no-underline"
          href={`mailto:${labels.rescueEmail}?subject=${encodeURIComponent(labels.rescueSubject)}`}
        >
          {labels.rescueEmail}
        </a>
        . {labels.rescueAfterEmail}
      </p>
    </output>
  );
}

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

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  onReadyRef,
  className,
  theme = "auto",
  size = "normal",
  tabIndex,
  id,
  cData,
  labels,
}: TurnstileProps) {
  const siteKey = getPublicRuntimeEnvString("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const mode = resolveTurnstileWidgetMode({
    siteKey,
    isDevelopment: isPublicRuntimeDevelopment(),
    devBypassEnabled:
      getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TURNSTILE_BYPASS") === true,
    testModeEnabled:
      getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TEST_MODE") === true,
    appEnv: getPublicRuntimeEnvString("NEXT_PUBLIC_APP_ENV"),
    isProductionBuild: isPublicRuntimeProduction(),
  });
  const isBypassMode = mode === "bypass";
  const isTestMode = mode === "test";
  const isUnavailable = mode === "unavailable";
  const autoResolveTriggeredRef = useRef(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [degradedKind, setDegradedKind] =
    useState<TurnstileDegradedKind | null>(null);

  /**
   * reset 意味着上一个令牌已作废，控件要重新出题。
   *
   * 测试/预览模式下压根没渲染 `<Turnstile>`，`turnstileRef` 永远是 null，只调
   * 它等于什么也没做；自动发令牌的 effect 又已经发过一次不会再发。结果是第一次
   * 提交之后再也拿不到令牌，按钮永久禁用。所以这里补发一次替身令牌，跟真实控件
   * reset 后会出新挑战对齐。本地 E2E 与预览部署都跑在这个模式下。
   */
  useEffect(() => {
    if (!onReadyRef) {
      return undefined;
    }

    const handleReset = () => {
      if (isBypassMode) {
        onSuccess?.(TURNSTILE_BYPASS_TOKEN);
        return;
      }
      if (isTestMode) {
        onSuccess?.(TURNSTILE_DUMMY_TEST_TOKEN);
        return;
      }
      turnstileRef.current?.reset();
    };

    return onReadyRef(handleReset);
  }, [isBypassMode, isTestMode, onReadyRef, onSuccess]);

  // All hooks must be called before any conditional returns. Dev bypass and
  // test mode both replace the real widget, so they share one settle-once
  // effect instead of two near-identical ones. Bypass wins if both are on.
  useEffect(() => {
    if (autoResolveTriggeredRef.current) return;
    if (isBypassMode) {
      autoResolveTriggeredRef.current = true;
      logger.warn("[DEV] Turnstile bypass mode enabled");
      onSuccess?.(TURNSTILE_BYPASS_TOKEN);
    } else if (isTestMode) {
      autoResolveTriggeredRef.current = true;
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- Preview test mode must settle the same parent token contract as the external widget callback.
      onSuccess?.(TURNSTILE_DUMMY_TEST_TOKEN);
    }
  }, [isBypassMode, isTestMode, onSuccess]);

  useEffect(() => {
    if (isUnavailable) {
      logger.warn(
        "Turnstile site key not configured. Bot protection is disabled.",
      );
      onError?.("Turnstile site key not configured");
    }
  }, [isUnavailable, onError]);

  if (isBypassMode) {
    return (
      <TurnstileBypassStatus className={className} label={labels.devBypass} />
    );
  }

  if (isTestMode) {
    return (
      <TurnstileMockStatus className={className} label={labels.testMode} />
    );
  }

  if (!siteKey) {
    return isUnavailable ? (
      <TurnstileRescueStatus kind="unavailable" labels={labels} />
    ) : null;
  }

  const widgetHandlers = {
    onSuccess: (token: string) => {
      setDegradedKind(null);
      onSuccess?.(token);
    },
    onError: (error: string) => {
      logger.error("Turnstile error:", error);
      setDegradedKind("failed");
      onError?.(error);
    },
    onExpire: () => {
      logger.warn("Turnstile token expired");
      onExpire?.();
    },
  };

  return (
    <>
      <div className={`turnstile-container ${className || ""}`}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          {...widgetHandlers}
          options={{
            theme,
            size,
            tabIndex,
            action: INQUIRY_TURNSTILE_ACTION,
            cData,
          }}
          id={id}
        />
      </div>
      {degradedKind ? (
        <TurnstileRescueStatus kind={degradedKind} labels={labels} />
      ) : null}
    </>
  );
}
