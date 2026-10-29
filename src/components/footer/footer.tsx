import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SINGLE_SITE_CONFIG,
  SINGLE_SITE_FOOTER_COLUMNS,
} from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { CookieSettingsButton } from "@/components/cookie/cookie-settings-button";
import { BreakableEmail } from "@/components/content/breakable-email";
import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";
import { formatCompanyAddress, whatsappHref } from "@/lib/site-contact";

const FOOTER_LINK =
  "rounded-sm text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground";
const COLUMN_TITLE = "text-sm font-medium text-foreground";

// lucide 不含品牌图标；路径来自 simple-icons（CC0）。
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// 只列已填写的字段；顺序即页面顺序。
function getContactLinks() {
  const { email, phone, whatsapp } = SINGLE_SITE_CONFIG.contact;
  return [
    email && {
      key: "email",
      href: `mailto:${email}`,
      label: <BreakableEmail email={email} />,
      Icon: Mail,
    },
    phone && { key: "phone", href: `tel:${phone}`, label: phone, Icon: Phone },
    whatsapp && {
      key: "whatsapp",
      href: whatsappHref(whatsapp),
      label: `WhatsApp ${whatsapp}`,
      Icon: WhatsAppIcon,
    },
  ].filter((link) => typeof link === "object");
}

function getSocialLinks() {
  const { linkedin, twitter } = SINGLE_SITE_CONFIG.social;
  return [
    linkedin && { key: "linkedin", href: linkedin, label: "LinkedIn" },
    twitter && { key: "x", href: twitter, label: "X" },
  ].filter((link) => typeof link === "object");
}

export interface FooterProps {
  themeToggleSlot?: ReactNode;
  className?: string;
}

export function Footer({ themeToggleSlot, className }: FooterProps) {
  const t = useTranslations();
  const { company, name } = SINGLE_SITE_CONFIG;
  const brandName = company?.name?.trim() || name;
  const address = formatCompanyAddress(company?.location);
  const contactLinks = getContactLinks();
  const socialLinks = getSocialLinks();
  // shortcut: 年份在静态生成时确定，跨年后需重新部署才会更新。
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-border bg-background", className)}>
      <div className="mx-auto max-w-[1080px] px-6 pt-10 pb-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="min-w-0 space-y-3">
            <p className={COLUMN_TITLE}>{brandName}</p>
            {contactLinks.length || address ? (
              <address className="space-y-1 not-italic">
                {contactLinks.map(({ key, href, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    className={cn(
                      FOOTER_LINK,
                      "flex w-fit items-center gap-2 py-1 [overflow-wrap:anywhere]",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </a>
                ))}
                {address ? (
                  <p className="flex items-start gap-2 py-1 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {address}
                  </p>
                ) : null}
              </address>
            ) : null}
          </div>
          <nav
            aria-label={t("accessibility.footerNavigation")}
            className="grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-3"
          >
            {SINGLE_SITE_FOOTER_COLUMNS.map((column) => (
              <div key={column.key}>
                <h2 className={COLUMN_TITLE}>
                  {t(`footer.columns.${column.key}`)}
                </h2>
                <ul className="mt-3 space-y-1">
                  {column.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        className={cn(FOOTER_LINK, "inline-block py-1")}
                      >
                        {t(link.translationKey)}
                      </Link>
                    </li>
                  ))}
                  {column.key === "support" &&
                  getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID") ? (
                    <li>
                      <CookieSettingsButton label={t("cookie.settings")} />
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
            {socialLinks.length ? (
              <div>
                <h2 className={COLUMN_TITLE}>{t("footer.columns.social")}</h2>
                <ul className="mt-3 space-y-1">
                  {socialLinks.map(({ key, href, label }) => (
                    <li key={key}>
                      <a
                        href={href}
                        className={cn(FOOTER_LINK, "inline-block py-1")}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </nav>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            © {year} {brandName}
          </p>
          {themeToggleSlot}
        </div>
      </div>
    </footer>
  );
}
