"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { FinalUrlLink, usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { cn } from "@/lib/utils";
import { useLocaleSwitchHref } from "@/components/layout/use-locale-switch-href";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderLanguageMenuProps {
  initialOpen?: boolean;
  locale: ConfiguredLocale;
}

const LANGUAGE_OPTIONS = LOCALES_CONFIG.locales.map((locale) => ({
  locale,
  label: LOCALES_CONFIG.displayNames[locale],
}));

export function HeaderLanguageMenu({
  initialOpen = false,
  locale,
}: HeaderLanguageMenuProps) {
  const pathname = usePathname();
  const tAccessibility = useTranslations("accessibility");
  const tNavigation = useTranslations("navigation");
  const currentLocale = locale;
  const currentLanguageLabel = LOCALES_CONFIG.displayNames[currentLocale];
  const localeSwitchHref = useLocaleSwitchHref(pathname);
  const [open, setOpen] = useState(initialOpen);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state -- 持久 Header 切路由时必须关闭已打开菜单，避免返回旧路径重开；这不是展示派生状态。
    setOpen(() => false);
  }, [pathname]);

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        openOnHover
        delay={100}
        closeDelay={0}
        data-testid="language-toggle-button"
        aria-label={tAccessibility("language", {
          language: currentLanguageLabel,
        })}
        className={cn(
          "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground",
          "transition-colors duration-100 ease-out hover:bg-accent hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none",
        )}
      >
        <Globe aria-hidden="true" className="size-3.5" />
        <span data-testid="language-current-label" translate="no">
          {LOCALES_CONFIG.triggerLabels[currentLocale]}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuPositioner sideOffset={6} align="end">
          <DropdownMenuContent
            aria-label={tNavigation("language")}
            data-testid="language-dropdown-content"
          >
            <div className="space-y-0.5">
              {LANGUAGE_OPTIONS.map((option) => {
                const isCurrent = option.locale === currentLocale;
                const optionContent = (
                  <>
                    <span lang={option.locale} translate="no">
                      {option.label}
                    </span>
                    {isCurrent ? (
                      <Check
                        aria-hidden="true"
                        className="ml-auto size-4 text-foreground"
                      />
                    ) : null}
                  </>
                );

                if (isCurrent) {
                  return (
                    <DropdownMenuItem
                      key={option.locale}
                      aria-current="true"
                      className="text-foreground data-[disabled]:opacity-100"
                      data-locale={option.locale}
                      data-testid={`language-option-${option.locale}`}
                      disabled
                    >
                      {optionContent}
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuLinkItem
                    key={option.locale}
                    data-locale={option.locale}
                    data-testid={`language-option-${option.locale}`}
                    render={
                      <FinalUrlLink
                        href={localeSwitchHref(option.locale)}
                        hrefLang={option.locale}
                        translate="no"
                      >
                        {optionContent}
                      </FinalUrlLink>
                    }
                  />
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
