"use client";

import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
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
}

const LANGUAGE_OPTIONS = LOCALES_CONFIG.locales.map((locale) => ({
  locale,
  label: LOCALES_CONFIG.displayNames[locale],
}));

export function MobileLanguageSwitcher({
  locale,
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
        className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-[var(--control-radius)] px-3 text-base font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground [&::-webkit-details-marker]:hidden"
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
          option.locale === currentLocale ? (
            <span
              key={option.locale}
              aria-current="true"
              lang={option.locale}
              className="flex min-h-11 items-center justify-between rounded-[var(--control-radius)] px-3 pl-9 text-base font-medium text-foreground"
            >
              {option.label}
              <Check aria-hidden="true" className="size-4" />
            </span>
          ) : (
            <FinalUrlLink
              key={option.locale}
              href={localeSwitchHref(option.locale)}
              hrefLang={option.locale}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-[var(--control-radius)] px-3 pl-9 text-base font-medium text-muted-foreground",
                "transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground",
              )}
              data-locale={option.locale}
              data-testid={`mobile-language-option-${option.locale}`}
              lang={option.locale}
            >
              {option.label}
            </FinalUrlLink>
          ),
        )}
      </div>
    </details>
  );
}
