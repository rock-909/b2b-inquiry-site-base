"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { cn } from "@/lib/utils";

interface MobileLanguageSwitcherProps {
  locale: ConfiguredLocale;
  onNavigate?: () => void;
}

const LANGUAGE_OPTIONS = LOCALES_CONFIG.locales.map((locale) => ({
  locale,
  label: LOCALES_CONFIG.displayNames[locale],
}));

export function MobileLanguageSwitcher({
  locale,
  onNavigate,
}: MobileLanguageSwitcherProps) {
  const pathname = usePathname();
  const tAccessibility = useTranslations("accessibility");
  const tNavigation = useTranslations("navigation");
  const currentLocale = locale;
  const currentLanguageLabel = LOCALES_CONFIG.displayNames[currentLocale];

  return (
    <details
      className="group"
      data-testid="mobile-language-switcher"
      translate="no"
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        aria-label={tAccessibility("language", {
          language: currentLanguageLabel,
        })}
        data-testid="mobile-language-trigger"
      >
        <span className="flex items-center gap-2">
          <Globe aria-hidden="true" className="size-4" />
          <span>{tNavigation("language")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span lang={currentLocale}>{currentLanguageLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>

      <div className="mt-1 space-y-0.5">
        {LANGUAGE_OPTIONS.map((option) => {
          const isCurrent = option.locale === currentLocale;

          if (isCurrent) {
            return (
              <div
                key={option.locale}
                aria-current="true"
                className="flex items-center justify-between rounded-md bg-transparent px-3 py-2 text-sm font-medium text-foreground"
                data-locale={option.locale}
                data-testid={`mobile-language-option-${option.locale}`}
              >
                <span lang={option.locale}>{option.label}</span>
                <Check aria-hidden="true" className="size-4" />
              </div>
            );
          }

          return (
            <Link
              key={option.locale}
              href={pathname as "/"}
              locale={option.locale}
              prefetch={false}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground",
                "transition-colors hover:bg-accent/50 hover:text-foreground",
              )}
              data-locale={option.locale}
              data-testid={`mobile-language-option-${option.locale}`}
              lang={option.locale}
              onClick={onNavigate}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
