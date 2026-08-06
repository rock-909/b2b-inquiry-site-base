import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FOOTER_COLUMNS } from "@/config/footer-links";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import { Link } from "@/i18n/routing";

/**
 * Hairline B2B footer: wide brand column + two link columns over a legal
 * identity bar. Flat surface, no colour blocks — the only accent is the
 * wordmark's "=" mark. Design rule: docs/design/设计真相.md.
 */

type FooterColumnConfig = (typeof FOOTER_COLUMNS)[number];
type FooterConfigMessageKey =
  | FooterColumnConfig["translationKey"]
  | FooterColumnConfig["links"][number]["translationKey"];
type FooterSectionTranslator = {
  has: (key: FooterConfigMessageKey) => boolean;
  (key: FooterConfigMessageKey): string;
};

export interface FooterProps {
  /** 主题切换插槽（如 ThemeSwitcher），渲染在法务条右侧 */
  themeToggleSlot?: ReactNode;
  /** 额外类名 */
  className?: string;
  /** 可选 data-theme 透传，方便在独立渲染时指定主题 */
  dataTheme?: string;
}

const MICRO_LABEL_CLASS =
  "font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--footer-heading)]";
const LEGAL_TEXT_CLASS =
  "font-mono text-[11.5px] leading-5 text-[var(--footer-text)]";
const LINK_CLASS =
  "block py-1.5 text-sm leading-6 text-[var(--footer-text)] transition-colors hover:text-[var(--primary-text)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function FooterSection({
  section,
  t,
}: {
  section: FooterColumnConfig;
  t: FooterSectionTranslator;
}) {
  const translateConfigKey = (key: FooterConfigMessageKey) => {
    if (!t.has(key)) {
      throw new Error(`Missing required message: ${key}`);
    }
    return t(key);
  };

  return (
    <section aria-labelledby={`${section.key}-heading`}>
      <h2 id={`${section.key}-heading`} className={MICRO_LABEL_CLASS}>
        {translateConfigKey(section.translationKey)}
      </h2>
      <ul className="mt-3">
        {section.links.map((link) => (
          <li key={link.key}>
            {link.external ? (
              <a
                className={LINK_CLASS}
                href={link.href}
                rel="noreferrer noopener"
                target="_blank"
              >
                {translateConfigKey(link.translationKey)}
              </a>
            ) : (
              <Link
                className={LINK_CLASS}
                href={link.href as "/privacy" | "/terms"}
                prefetch={false}
              >
                {translateConfigKey(link.translationKey)}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer({ themeToggleSlot, className, dataTheme }: FooterProps) {
  const t = useTranslations();

  if (!t.has("footer.copyright")) {
    throw new Error("Missing required message: footer.copyright");
  }
  const copyright = t("footer.copyright");

  if (!t.has("footer.description")) {
    throw new Error("Missing required message: footer.description");
  }
  const footerDescription = t("footer.description");

  if (!t.has("accessibility.footerNavigation")) {
    throw new Error("Missing required message: accessibility.footerNavigation");
  }
  const footerNavigationLabel = t("accessibility.footerNavigation");

  const { name: siteName } = SINGLE_SITE_CONFIG;
  const { name: companyName } = SINGLE_SITE_FACTS.company;
  const { email } = SINGLE_SITE_CONFIG.contact;
  // Pure facts, no translatable words — composed from config, not messages.
  const legalLine = `${companyName} · ${email}`;

  return (
    <footer
      className={cn(
        "border-t border-[var(--footer-divider)] bg-[var(--footer-bg)]",
        className,
      )}
      data-theme={dataTheme}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-12 md:py-14">
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-[1.4fr_2fr]">
          <div>
            <p className="text-lg font-semibold tracking-tight text-[var(--footer-heading)]">
              <span className="sr-only">{siteName}</span>
              <span aria-hidden="true">
                TUCS
                <span className="text-primary">=</span>
                NBERG
              </span>
            </p>
            <p className="mt-3 max-w-[34ch] text-[13px] leading-6 text-[var(--footer-text)]">
              {footerDescription}
            </p>
          </div>

          <nav
            aria-label={footerNavigationLabel}
            className="grid grid-cols-2 gap-x-8 gap-y-10"
          >
            {FOOTER_COLUMNS.map((section) => (
              <FooterSection key={section.key} section={section} t={t} />
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-[var(--footer-divider)] pt-6">
          <p className={LEGAL_TEXT_CLASS}>{legalLine}</p>
          <div className="flex items-center gap-4">
            <p className={LEGAL_TEXT_CLASS}>{copyright}</p>
            {themeToggleSlot}
          </div>
        </div>
      </div>
    </footer>
  );
}
