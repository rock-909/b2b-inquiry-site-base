import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SINGLE_SITE_FOOTER_COLUMNS } from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { CookieSettingsButton } from "@/components/cookie/cookie-settings-button";
import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";

export interface FooterProps {
  themeToggleSlot?: ReactNode;
  className?: string;
}

export function Footer({ themeToggleSlot, className }: FooterProps) {
  const t = useTranslations();
  return (
    <footer className={cn("border-t border-border bg-background", className)}>
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-6 px-6 py-6">
        <nav aria-label={t("accessibility.footerNavigation")}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {SINGLE_SITE_FOOTER_COLUMNS.flatMap((section) => section.links).map(
              (link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="inline-block rounded-sm py-2 text-sm text-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover:text-foreground hover:underline"
                  >
                    {t(link.translationKey)}
                  </Link>
                </li>
              ),
            )}
            {getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID") ? (
              <li>
                <CookieSettingsButton label={t("cookie.settings")} />
              </li>
            ) : null}
          </ul>
        </nav>
        {themeToggleSlot}
      </div>
    </footer>
  );
}
