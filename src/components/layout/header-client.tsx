"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";
import { ChevronDown, Globe } from "lucide-react";
import { usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { LazyIslandBoundary } from "@/components/errors/lazy-island-boundary";
import { useLocaleSwitchHref } from "@/components/layout/use-locale-switch-href";
import { cn } from "@/lib/utils";
import { MobileNavigationFallback } from "@/components/layout/header-mobile-navigation-fallback";

const loadMobileNavigationInteractive = () =>
  import("@/components/layout/mobile-navigation-interactive").then(
    (mod) => mod.MobileNavigationInteractive,
  );

const loadHeaderLanguageMenu = () =>
  import("@/components/layout/header-language-menu").then(
    (mod) => mod.HeaderLanguageMenu,
  );

type IslandState<P> = { Component: ComponentType<P> } | { error: unknown };

// 激活时才 import()，加载完成后用 state 渲染。不使用 React.lazy/Suspense：
// 提交 Suspense fallback 会触发约 300 ms 的重试节流，让首次打开固定变慢。
// 加载失败在渲染期重新抛出，由外层 LazyIslandBoundary 退回静态兜底。
function ActivatedIsland<P extends object>({
  load,
  pending,
  props,
}: {
  load: () => Promise<ComponentType<P>>;
  pending: ReactNode;
  props: P;
}) {
  // 在首次渲染时就发起 import()，不等 effect 提交后再开始。
  const [pendingIsland] = useState(() =>
    load().then(
      (Component): IslandState<P> => ({ Component }),
      (error: unknown): IslandState<P> => ({ error }),
    ),
  );
  const [island, setIsland] = useState<IslandState<P> | null>(null);

  useEffect(() => {
    pendingIsland.then(setIsland);
  }, [pendingIsland]);

  if (!island) return pending;
  if ("error" in island) throw island.error;
  return <island.Component {...props} />;
}

interface MobileNavigationIslandProps {
  children?: ReactNode;
  languageSwitcher?: ReactNode;
  openMenuLabel: string;
  closeMenuLabel: string;
  siteName: string;
}

interface LanguageToggleIslandProps {
  ariaLabel: string;
  locale: ConfiguredLocale;
}

interface LanguageToggleTriggerProps {
  ariaLabel: string;
  isLoading?: boolean;
  locale: ConfiguredLocale;
  onClick?: () => void;
}

function LanguageToggleTrigger({
  ariaLabel,
  isLoading = false,
  locale,
  onClick,
}: LanguageToggleTriggerProps) {
  return (
    <button
      type="button"
      data-testid="language-toggle-button"
      aria-label={ariaLabel}
      aria-busy={isLoading}
      aria-expanded="false"
      aria-haspopup="menu"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground",
        "transition-colors duration-100 ease-out hover:bg-accent hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none",
      )}
      onClick={onClick}
    >
      <Globe aria-hidden="true" className="size-3.5" />
      <span data-testid="language-current-label" translate="no">
        {LOCALES_CONFIG.triggerLabels[locale]}
      </span>
      <ChevronDown aria-hidden="true" className="size-3.5" />
    </button>
  );
}

// 语言菜单分块加载失败时的静态兜底：普通 <a> 触发整页导航，同时让买家拿到新部署。
function LanguageToggleStaticFallback({
  ariaLabel,
  locale,
  detailsRef,
}: Pick<LanguageToggleIslandProps, "ariaLabel" | "locale"> & {
  detailsRef?: Ref<HTMLDetailsElement>;
}) {
  const localeSwitchHref = useLocaleSwitchHref(usePathname());

  return (
    <details ref={detailsRef} className="relative" translate="no">
      <summary
        data-testid="language-toggle-button"
        aria-label={ariaLabel}
        className="inline-flex h-9 cursor-pointer list-none items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <Globe aria-hidden="true" className="size-3.5" />
        <span>{LOCALES_CONFIG.triggerLabels[locale]}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div className="absolute top-full right-0 z-50 mt-2 min-w-40 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
        {LOCALES_CONFIG.locales.map((targetLocale) => (
          <a
            key={targetLocale}
            href={localeSwitchHref(targetLocale)}
            hrefLang={targetLocale}
            lang={targetLocale}
            aria-current={targetLocale === locale ? "true" : undefined}
            className="flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {LOCALES_CONFIG.displayNames[targetLocale]}
          </a>
        ))}
      </div>
    </details>
  );
}

export function MobileNavigationIsland({
  children,
  languageSwitcher,
  openMenuLabel,
  closeMenuLabel,
  siteName,
}: MobileNavigationIslandProps) {
  const pathname = usePathname();
  const [activationPathname, setActivationPathname] = useState<string | null>(
    null,
  );
  const fallback = (
    <MobileNavigationFallback
      openMenuLabel={openMenuLabel}
      onActivate={() => setActivationPathname(pathname)}
    >
      {children}
    </MobileNavigationFallback>
  );

  if (activationPathname !== null) {
    return (
      <LazyIslandBoundary fallback={fallback}>
        <ActivatedIsland
          load={loadMobileNavigationInteractive}
          pending={fallback}
          props={{
            initialOpen: activationPathname === pathname,
            languageSwitcher,
            openMenuLabel,
            closeMenuLabel,
            siteName,
          }}
        />
      </LazyIslandBoundary>
    );
  }

  return fallback;
}

export function LanguageToggleIsland({
  ariaLabel,
  locale,
}: LanguageToggleIslandProps) {
  const pathname = usePathname();
  const [activationPathname, setActivationPathname] = useState<string | null>(
    null,
  );
  const nativeDetails = useRef<HTMLDetailsElement>(null);
  const subscribeToNativeMenu = useCallback((onChange: () => void) => {
    const details = nativeDetails.current;
    if (!details) return () => undefined;
    // focusout 时 activeElement 尚未更新；下一微任务再读取真实焦点。
    const handleFocusOut = () => queueMicrotask(onChange);
    details.addEventListener("toggle", onChange);
    details.addEventListener("focusout", handleFocusOut);
    return () => {
      details.removeEventListener("toggle", onChange);
      details.removeEventListener("focusout", handleFocusOut);
    };
  }, []);
  const isEnhanced = useSyncExternalStore(
    subscribeToNativeMenu,
    () => {
      const details = nativeDetails.current;
      // 水合前的展开和焦点属于用户；空闲后才替换，替换后 ref 为 null。
      return (
        !details || (!details.open && !details.contains(document.activeElement))
      );
    },
    () => false,
  );

  if (!isEnhanced) {
    return (
      <LanguageToggleStaticFallback
        ariaLabel={ariaLabel}
        locale={locale}
        detailsRef={nativeDetails}
      />
    );
  }

  const isActivated = activationPathname !== null;
  const isActivationCurrent = activationPathname === pathname;
  const fallback = (
    <LanguageToggleTrigger
      ariaLabel={ariaLabel}
      isLoading={isActivated && isActivationCurrent}
      locale={locale}
      onClick={() => setActivationPathname(pathname)}
    />
  );

  return (
    <div
      className="inline-flex min-w-[6.25rem] shrink-0 justify-end"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          setActivationPathname(pathname);
        }
      }}
    >
      {isActivated ? (
        <LazyIslandBoundary
          fallback={
            <LanguageToggleStaticFallback
              ariaLabel={ariaLabel}
              locale={locale}
            />
          }
        >
          <ActivatedIsland
            load={loadHeaderLanguageMenu}
            pending={fallback}
            props={{ initialOpen: isActivationCurrent, locale }}
          />
        </LazyIslandBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
