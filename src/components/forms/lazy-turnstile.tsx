"use client";

import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IDLE_CALLBACK_TIMEOUT_LONG } from "@/constants/time";
import { TURNSTILE_WIDGET_HEIGHT_PX } from "@/constants/turnstile-constants";
import { requestIdleCallback } from "@/lib/idle-callback";
import { LazyIslandErrorBoundary } from "@/components/ui/lazy-island-error-boundary";
import { TurnstileRescueLine } from "@/components/security/turnstile-rescue-line";
import type { TurnstileDegradedKind } from "@/components/security/turnstile";

const TURNSTILE_PLACEHOLDER_CLASS_NAME =
  "h-[var(--turnstile-placeholder-height)] w-full animate-pulse rounded-md bg-muted";

// Turnstile 正常挑战通常 1-3 秒；15 秒足以排除慢网络的误触发。
const TURNSTILE_RESCUE_TIMEOUT_MS = 15_000;

type TurnstilePlaceholderStyle = CSSProperties & {
  "--turnstile-placeholder-height": string;
};

interface LazyTurnstileLabels {
  unavailable: string;
  loadFailed: string;
  slowToLoad: string;
  devBypass: string;
  testMode: string;
  rescueBeforeEmail: string;
  rescueAfterEmail: string;
  rescueSubject: string;
}

interface LazyTurnstileProps {
  onSuccess?: (token: string) => void;
  onError?: (reason?: string) => void;
  onExpire?: () => void;
  onReadyRef?: (reset: () => void) => (() => void) | void;
  labels: LazyTurnstileLabels;
}

const TurnstileWidget = lazy(() =>
  import("@/components/security/turnstile").then((mod) => ({
    default: mod.TurnstileWidget,
  })),
);

const TURNSTILE_PLACEHOLDER_STYLE: TurnstilePlaceholderStyle = {
  "--turnstile-placeholder-height": `${TURNSTILE_WIDGET_HEIGHT_PX.normal}px`,
};

/**
 * 延迟渲染逻辑
 * - 优先：进入视口（IntersectionObserver）
 * - 退化：空闲时加载（requestIdleCallback timeout）
 */
function useLazyRender(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let cancelled = false;
    let cleanupIdle: () => void = () => undefined;

    const enableRender = () => {
      if (cancelled) return;
      setShouldRender(true);
      io?.disconnect();
      io = null;
    };

    if (!shouldRender) {
      const el = containerRef.current;

      if (typeof IntersectionObserver !== "undefined" && el) {
        io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                enableRender();
                break;
              }
            }
          },
          { rootMargin: "200px" },
        );

        io.observe(el);
      }

      cleanupIdle = requestIdleCallback(enableRender, {
        fallbackDelay: IDLE_CALLBACK_TIMEOUT_LONG,
        timeout: IDLE_CALLBACK_TIMEOUT_LONG,
      });
    }

    return () => {
      cancelled = true;
      cleanupIdle();
      io?.disconnect();
    };
  }, [containerRef, shouldRender]);

  return shouldRender;
}

/**
 * 不变量：手上没有有效令牌时，救援计时器必须在跑。
 *
 * 计时器住在这一层而不是 `TurnstileWidget` 里：懒加载 chunk 一直 pending 时
 * （慢网、中间盒吞包、CDN 半死）widget 根本不会挂载，错误边界也不触发——它只
 * 管 reject——住在 widget 内部的计时器于是永远不起跑，而这正是救援提示要救的
 * 那类失败。所以从「开始加载」（`isLoading` 变 true）那一刻起表。
 *
 * 拿到令牌就停表；提交落定后表单会 reset widget，那一刻令牌又没了，必须重新
 * 起表，否则「提交失败 + 此时 Turnstile 挂掉」会让买家卡在一个永远 disabled
 * 的按钮前。
 *
 * 令牌过期（onExpire）同样要重新起表。这一步容易被跳过，理由听起来也对：widget
 * 会自己续新挑战，不该为一次正常过期吓买家。但「起表」不等于「显示」——续期在
 * 15 秒内成功就什么都看不到。真正要防的是续期本身悄悄失败（iframe 被企业代理
 * 拦掉、脚本被中间盒换掉、那一秒断网），这些都不触发 onError。B2B 买家在询盘页
 * 停留超过令牌寿命是常态（要去翻规格、算数量），不起表就是又一个永远禁用的按钮。
 *
 * `waitCycle` 为 null 表示握有令牌（不计时），数字表示第几轮等待；换一个数字就
 * 让下面的 effect 重新起表。
 */
function useTurnstileRescueState(isLoading: boolean) {
  const [degradedKind, setDegradedKind] =
    useState<TurnstileDegradedKind | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [waitCycle, setWaitCycle] = useState<number | null>(0);

  useEffect(() => {
    if (!isLoading || waitCycle === null) {
      return undefined;
    }
    const timer = setTimeout(
      () => setHasTimedOut(true),
      TURNSTILE_RESCUE_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [isLoading, waitCycle]);

  // 拿到令牌就收回救援行。managed 挑战常要买家手动点一次，先填字段再去点验证码
  // 超过 15 秒是常态；那时救援行已经出现，但控件完全健康，买家也已经能提交了。
  const markSuccess = useCallback(() => {
    setWaitCycle(null);
    setHasTimedOut(false);
    setDegradedKind(null);
  }, []);

  const markWaiting = useCallback(
    () => setWaitCycle((cycle) => (cycle ?? 0) + 1),
    [],
  );

  return {
    showRescue: degradedKind !== null || hasTimedOut,
    degradedKind,
    markSuccess,
    markDegraded: setDegradedKind,
    markWaiting,
  };
}

/**
 * 全站唯一的救援提示渲染点。
 *
 * 救援行不能光秃秃一句「改发邮件」——买家不知道为什么，所以配一句状态标签。
 * 超时不等于失败：managed 挑战常要买家手动点一次，先填三个字段再去点验证码
 * 超过 15 秒是常态，那时控件完全健康。所以超时用较轻的措辞，别把人吓退。
 */
function TurnstileRescueStatus({
  degradedKind,
  labels,
}: {
  degradedKind: TurnstileDegradedKind | null;
  labels: LazyTurnstileLabels;
}) {
  const label =
    degradedKind === "unavailable" ? labels.unavailable : labels.loadFailed;

  return (
    // 页面静止十几秒后凭空出现，不播报等于对屏幕阅读器用户不存在。
    <output className="turnstile-rescue" aria-live="polite">
      <div
        className={
          degradedKind === null
            ? "text-sm text-muted-foreground"
            : "text-sm text-[var(--error-foreground)]"
        }
      >
        {degradedKind === null ? labels.slowToLoad : label}
      </div>
      <TurnstileRescueLine
        beforeEmail={labels.rescueBeforeEmail}
        afterEmail={labels.rescueAfterEmail}
        subject={labels.rescueSubject}
      />
    </output>
  );
}

/**
 * 延迟加载 Turnstile CAPTCHA 组件
 * 优先在进入视口时加载，退化为空闲时加载
 */
export function LazyTurnstile(props: LazyTurnstileProps) {
  const { onError, onSuccess, onReadyRef, labels } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldRender = useLazyRender(containerRef);
  const { showRescue, degradedKind, markSuccess, markDegraded, markWaiting } =
    useTurnstileRescueState(shouldRender);
  const placeholder = (
    <div className={TURNSTILE_PLACEHOLDER_CLASS_NAME} aria-hidden="true" />
  );

  const handleSuccess = (token: string) => {
    markSuccess();
    onSuccess?.(token);
  };

  // chunk 加载失败与控件渲染时抛错走同一条报告路径。
  const handleLazyError = () => {
    markDegraded("failed");
    onError?.(labels.loadFailed);
  };

  // 过期同样意味着手上没令牌了。透传给表单之外还要起表：续期若悄悄失败，
  // 买家会对着一个永远禁用的按钮，而 onError 一声不吭。
  const handleExpire = () => {
    markWaiting();
    props.onExpire?.();
  };

  // reset 意味着令牌已作废，重新进入等待期——计时器住在这一层，所以在这里起表。
  const handleReadyRef = (reset: () => void) =>
    onReadyRef?.(() => {
      markWaiting();
      reset();
    });

  return (
    <div
      className="space-y-2"
      ref={containerRef}
      style={TURNSTILE_PLACEHOLDER_STYLE}
    >
      {shouldRender ? (
        <LazyIslandErrorBoundary onError={handleLazyError}>
          <Suspense fallback={placeholder}>
            <TurnstileWidget
              className="w-full"
              theme="auto"
              size="normal"
              labels={{
                devBypass: labels.devBypass,
                testMode: labels.testMode,
              }}
              {...(onError ? { onError } : {})}
              onSuccess={handleSuccess}
              onDegraded={markDegraded}
              onExpire={handleExpire}
              onReadyRef={handleReadyRef}
            />
          </Suspense>
        </LazyIslandErrorBoundary>
      ) : (
        placeholder
      )}
      {showRescue ? (
        <TurnstileRescueStatus degradedKind={degradedKind} labels={labels} />
      ) : null}
    </div>
  );
}
