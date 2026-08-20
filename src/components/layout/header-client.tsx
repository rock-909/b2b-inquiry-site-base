"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { cn } from "@/lib/utils";
import { MobileNavigationFallback } from "@/components/layout/header-mobile-navigation-fallback";

const MobileNavigationInteractive = lazy(() =>
  import("@/components/layout/mobile-navigation-interactive").then((mod) => ({
    default: mod.MobileNavigationInteractive,
  })),
);

const HeaderLanguageMenu = lazy(() =>
  import("@/components/layout/header-language-menu").then((mod) => ({
    default: mod.HeaderLanguageMenu,
  })),
);

interface MobileNavigationIslandProps {
  children?: ReactNode;
  languageSwitcher?: ReactNode;
  openMenuLabel: string;
  closeMenuLabel: string;
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
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground",
        "transition-colors hover:bg-accent hover:text-foreground",
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

export function MobileNavigationIsland({
  children,
  languageSwitcher,
  openMenuLabel,
  closeMenuLabel,
}: MobileNavigationIslandProps) {
  const [isActivated, setIsActivated] = useState(false);
  const fallback = (
    <MobileNavigationFallback
      openMenuLabel={openMenuLabel}
      onActivate={() => setIsActivated(true)}
    >
      {children}
    </MobileNavigationFallback>
  );

  if (isActivated) {
    return (
      <Suspense fallback={fallback}>
        <MobileNavigationInteractive
          initialOpen
          languageSwitcher={languageSwitcher}
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
        />
      </Suspense>
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
        <Suspense fallback={fallback}>
          <HeaderLanguageMenu
            initialOpen={isActivationCurrent}
            locale={locale}
          />
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}
