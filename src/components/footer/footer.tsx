import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  SINGLE_SITE_CONFIG,
  SINGLE_SITE_FOOTER_COLUMNS,
} from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { CookieSettingsButton } from "@/components/cookie/cookie-settings-button";
import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";
import { formatCompanyAddress, whatsappHref } from "@/lib/site-contact";

const FOOTER_TEXT_LINK =
  "inline-block rounded-sm py-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground";

// 只列已填写的字段；顺序即页面顺序。
function getFooterContactLinks() {
  const { contact, social } = SINGLE_SITE_CONFIG;
  return [
    contact.email && { href: `mailto:${contact.email}`, label: contact.email },
    contact.phone && { href: `tel:${contact.phone}`, label: contact.phone },
    contact.whatsapp && {
      href: whatsappHref(contact.whatsapp),
      label: "WhatsApp",
    },
    social.linkedin && { href: social.linkedin, label: "LinkedIn" },
    social.twitter && { href: social.twitter, label: "X" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));
}

export interface FooterProps {
  themeToggleSlot?: ReactNode;
  className?: string;
}

export function Footer({ themeToggleSlot, className }: FooterProps) {
  const t = useTranslations();
  const { company, name } = SINGLE_SITE_CONFIG;
  const contactLinks = getFooterContactLinks();
  const address = formatCompanyAddress(company?.location);
  // shortcut: 年份在静态生成时确定，跨年后需重新部署才会更新。
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-border bg-background", className)}>
      <div className="mx-auto max-w-[1080px] px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <nav aria-label={t("accessibility.footerNavigation")}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {SINGLE_SITE_FOOTER_COLUMNS.flatMap(
                (section) => section.links,
              ).map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className={FOOTER_TEXT_LINK}
                  >
                    {t(link.translationKey)}
                  </Link>
                </li>
              ))}
              {getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID") ? (
                <li>
                  <CookieSettingsButton label={t("cookie.settings")} />
                </li>
              ) : null}
            </ul>
          </nav>
          {themeToggleSlot}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 text-sm text-muted-foreground">
          <p className="py-2">
            © {year} {company?.name?.trim() || name}
          </p>
          {contactLinks.length || address ? (
            <address className="flex flex-wrap items-center gap-x-6 not-italic">
              {contactLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={FOOTER_TEXT_LINK}
                >
                  {link.label}
                </a>
              ))}
              {address ? <span className="py-2">{address}</span> : null}
            </address>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
