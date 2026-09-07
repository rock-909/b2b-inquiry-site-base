/**
 * Header Component (Server)
 *
 * 服务端渲染的头部，交互部件以客户端小岛方式注入，减少首屏 JS 体积。
 */
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing-config";
import { cn } from "@/lib/utils";
import {
  LanguageToggleIsland,
  MobileNavigationIsland,
} from "@/components/layout/header-client";
import { HEADER_CTA_CLASS } from "@/components/layout/header-utility-control";
import { Logo } from "@/components/layout/logo";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";

/**
 * Header Component
 *
 * Main navigation header with responsive design, logo, navigation menus,
 * and utility controls.
 */

// Simplified header props interface
interface HeaderNavItem {
  key: string;
  href: string;
  label: string;
}

interface HeaderProps {
  className?: string;
  locale?: Locale;
  contactSalesLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  languageAriaLabel: string;
  mainNavigationLabel: string;
  mainNavItems?: HeaderNavItem[];
}

const EMPTY_MAIN_NAV_ITEMS: HeaderNavItem[] = [];

export function Header({
  className,
  locale,
  contactSalesLabel,
  openMenuLabel,
  closeMenuLabel,
  languageAriaLabel,
  mainNavigationLabel,
  mainNavItems = EMPTY_MAIN_NAV_ITEMS,
}: HeaderProps) {
  const showTestIds = !locale;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-background/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md",
        "border-b border-border/10 transition-[background-color,border-color] duration-200",
        className,
      )}
    >
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="header-nav-layout">
          {/* Left section: Logo */}
          <div
            className="header-nav-left"
            {...(showTestIds ? { "data-testid": "mobile-navigation" } : {})}
          >
            <Logo locale={locale} />
          </div>

          {/* Center section: Main Navigation (Desktop) */}
          <CenterNav
            locale={locale}
            mainNavItems={mainNavItems}
            mainNavigationLabel={mainNavigationLabel}
          />

          <HeaderUtilityControls
            contactSalesLabel={contactSalesLabel}
            locale={locale}
            languageAriaLabel={languageAriaLabel}
            openMenuLabel={openMenuLabel}
            closeMenuLabel={closeMenuLabel}
          />
        </div>
      </div>
    </header>
  );
}

function CenterNav({
  locale,
  mainNavItems,
  mainNavigationLabel,
}: {
  locale?: Locale | undefined;
  mainNavItems: Array<{
    key: string;
    href: string;
    label: string;
  }>;
  mainNavigationLabel: string;
}) {
  if (!locale || mainNavItems.length === 0) return null;

  return (
    <nav
      className="header-nav-center"
      aria-label={mainNavigationLabel}
      data-testid="header-desktop-nav"
    >
      <ul className="header-desktop-only header-nav-links-compact items-center">
        {mainNavItems.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href as "/"}
              prefetch={false}
              className={cn(
                "relative inline-flex items-center rounded-full bg-transparent px-2 py-2 text-sm font-medium tracking-[0.01em] xl:px-3",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/40 dark:hover:bg-foreground/10",
                "transition-colors duration-100 ease-out",
              )}
            >
              <span data-testid={`header-nav-label-${item.key}`} translate="no">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HeaderUtilityControls({
  contactSalesLabel,
  locale,
  languageAriaLabel,
  openMenuLabel,
  closeMenuLabel,
}: {
  contactSalesLabel: string;
  locale: Locale | undefined;
  languageAriaLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
}) {
  const contactHref = SINGLE_SITE_HOME_LINK_TARGETS.contact;

  return (
    <div className="header-nav-right" data-testid="header-utility-controls">
      {locale ? (
        <>
          {contactHref ? (
            <Link
              href={contactHref}
              prefetch={false}
              data-testid="header-cta"
              className={cn(HEADER_CTA_CLASS, "header-cta-desktop-only")}
            >
              <span data-testid="header-contact-sales-label" translate="no">
                {contactSalesLabel}
              </span>
            </Link>
          ) : null}
          {contactHref ? (
            <div
              className="header-mobile-only"
              data-testid="header-mobile-cta-wrapper"
            >
              <Link
                href={contactHref}
                prefetch={false}
                data-testid="header-mobile-cta"
                className={HEADER_CTA_CLASS}
              >
                <span data-testid="header-mobile-contact-label" translate="no">
                  {contactSalesLabel}
                </span>
              </Link>
            </div>
          ) : null}
          {/* 单语言配置没有可切换目标；多语言时由配置长度自动恢复。 */}
          {LOCALES_CONFIG.locales.length > 1 ? (
            <div className="header-full-desktop-only h-10 items-center">
              <LanguageToggleIsland
                ariaLabel={languageAriaLabel}
                locale={locale}
              />
            </div>
          ) : null}
          <div className="header-mobile-only h-10 w-10">
            <MobileNavigationIsland
              languageSwitcher={
                LOCALES_CONFIG.locales.length > 1 ? (
                  <MobileLanguageSwitcher locale={locale} />
                ) : undefined
              }
              openMenuLabel={openMenuLabel}
              closeMenuLabel={closeMenuLabel}
            >
              <MobileNavigationLinks
                contactSalesLabel={contactSalesLabel}
                languageSwitcher={
                  LOCALES_CONFIG.locales.length > 1 ? (
                    <MobileLanguageSwitcher locale={locale} />
                  ) : undefined
                }
                data-testid="header-mobile-navigation-fallback-links"
              />
            </MobileNavigationIsland>
          </div>
        </>
      ) : null}
    </div>
  );
}
