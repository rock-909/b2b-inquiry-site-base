"use client";

import { useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { FinalUrlLink, usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { cn } from "@/lib/utils";
import { useLocaleSwitchHref } from "@/components/layout/use-locale-switch-href";

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
  const localeSwitchHref = useLocaleSwitchHref(pathname);
  const tAccessibility = useTranslations("accessibility");
  const tNavigation = useTranslations("navigation");
  const currentLocale = locale;
  const currentLanguageLabel = LOCALES_CONFIG.displayNames[currentLocale];
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group"
      data-testid="mobile-language-switcher"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      translate="no"
    >
      <summary
        className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-100 ease-out outline-none hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden"
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
            className={cn(
              "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </span>
      </summary>

      <div className="mt-1 space-y-0.5">
        {LANGUAGE_OPTIONS.map((option) =>
          option.locale === currentLocale ? null : (
            <FinalUrlLink
              key={option.locale}
              href={localeSwitchHref(option.locale)}
              hrefLang={option.locale}
              className={cn(
                "flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground",
                "transition-colors duration-100 ease-out hover:bg-accent/50 hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none",
              )}
              data-locale={option.locale}
              data-testid={`mobile-language-option-${option.locale}`}
              lang={option.locale}
              {...(onNavigate ? { onNavigate } : {})}
            >
              {option.label}
            </FinalUrlLink>
          ),
        )}
      </div>
    </details>
  );
}
