"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import {
  getNavigationTargetRouteKey,
  getNavigationRouteKey,
  shouldStartHistoryNavigationProgress,
  shouldStartNavigationProgress,
} from "@/components/navigation/navigation-progress";

const PROGRESS_START = 18;
const PROGRESS_CAP = 92;
const PROGRESS_TRICKLE_MS = 380;
const PROGRESS_COMPLETE_MS = 220;
const PROGRESS_HIDE_MS = 180;
const PROGRESS_MIN_VISIBLE_MS = 280;

function getNextProgressValue(current: number): number {
  if (current >= PROGRESS_CAP) {
    return current;
  }

  // nosemgrep: insecure-random-generation -- 进度条增量抖动是纯视觉动画，不涉及密钥/token/抽样公平性等安全语义
  const increment = 4 + Math.random() * 6;
  return Math.min(current + increment, PROGRESS_CAP);
}

function getCurrentBrowserRouteKey(): string {
  return getNavigationRouteKey(
    window.location.pathname,
    new URLSearchParams(window.location.search),
  );
}

function getClickedNavigationRouteKey(event: MouseEvent): string | null {
  const { target } = event;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (!shouldStartNavigationProgress(event, anchor, window.location.href)) {
    return null;
  }

  return getNavigationTargetRouteKey(anchor, window.location.href);
}

function NavigationProgressIndicator({ progress }: { progress: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden pt-[env(safe-area-inset-top,0px)]"
      data-testid="navigation-progress-bar"
    >
      <div
        className={cn(
          "h-full w-full origin-left bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_35%,transparent)]",
          progress >= 100 ? "transition-none" : "transition-transform ease-out",
        )}
        data-testid="navigation-progress-bar-fill"
        style={{
          transform: `scaleX(${progress / 100})`,
          transitionDuration: `${progress >= 100 ? 0 : PROGRESS_COMPLETE_MS}ms`,
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = getNavigationRouteKey(pathname, searchParams);
  const reducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const renderedRouteKeyRef = useRef(routeKey);
  // Only click/popstate handlers own this ref. Route completion must not update
  // it, because Next may flush route effects before our popstate listener runs.
  const historyRef = useRef({
    hasMounted: false,
    routeKey: null as string | null,
  });

  const clearTimers = useCallback(() => {
    if (trickleTimerRef.current !== undefined) {
      window.clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = undefined;
    }

    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const finish = useEffectEvent(() => {
    if (!isActiveRef.current) {
      return;
    }

    clearTimers();
    isActiveRef.current = false;
    setProgress(100);

    const elapsed =
      startedAtRef.current === null
        ? PROGRESS_MIN_VISIBLE_MS
        : Date.now() - startedAtRef.current;
    const remainingVisible = Math.max(PROGRESS_MIN_VISIBLE_MS - elapsed, 0);

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      startedAtRef.current = null;
    }, remainingVisible + PROGRESS_HIDE_MS);
  });

  const start = useEffectEvent(() => {
    if (reducedMotion) {
      return;
    }

    clearTimers();
    isActiveRef.current = true;
    startedAtRef.current = Date.now();
    setVisible(true);
    setProgress(PROGRESS_START);

    trickleTimerRef.current = window.setInterval(() => {
      setProgress(getNextProgressValue);
    }, PROGRESS_TRICKLE_MS);
  });

  useEffect(() => {
    if (!historyRef.current.hasMounted) {
      historyRef.current = {
        hasMounted: true,
        routeKey: getCurrentBrowserRouteKey(),
      };
      return;
    }

    renderedRouteKeyRef.current = routeKey;
    finish();
  }, [routeKey]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const nextRouteKey = getClickedNavigationRouteKey(event);
      if (nextRouteKey === null) return;

      historyRef.current.routeKey = nextRouteKey;
      start();
    };

    const handlePopState = () => {
      const nextRouteKey = getCurrentBrowserRouteKey();
      if (
        !shouldStartHistoryNavigationProgress(
          historyRef.current.routeKey,
          nextRouteKey,
        )
      ) {
        return;
      }

      historyRef.current.routeKey = nextRouteKey;
      start();
      queueMicrotask(() => {
        if (renderedRouteKeyRef.current === nextRouteKey) finish();
      });
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [clearTimers]);

  if (reducedMotion || !visible) {
    return null;
  }

  return <NavigationProgressIndicator progress={progress} />;
}
