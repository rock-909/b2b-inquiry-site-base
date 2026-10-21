import { NavigationPending } from "@/components/navigation/navigation-pending";
/**
 * Header Component (Server)
 *
 * 服务端渲染的头部，交互部件以客户端小岛方式注入，减少首屏 JS 体积。
 */
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing-config";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  LanguageToggleIsland,
  MobileNavigationIsland,
} from "@/components/layout/header-client";
import {
  HeaderNavMenuBar,
  type HeaderNavItem,
} from "@/components/layout/header-nav-menu";
import { Logo } from "@/components/layout/logo";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";

const HEADER_CTA_CLASS = buttonVariants({ size: "sm" });

/**
 * Header Component
 *
 * Main navigation header with responsive design, logo, navigation menus,
 * and utility controls.
 */

interface HeaderProps {
  locale: Locale;
  contactSalesLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  languageAriaLabel: string;
  mainNavigationLabel: string;
  mainNavItems?: HeaderNavItem[];
}

const EMPTY_MAIN_NAV_ITEMS: HeaderNavItem[] = [];

export function Header({
  locale,
  contactSalesLabel,
  openMenuLabel,
  closeMenuLabel,
  languageAriaLabel,
  mainNavigationLabel,
  mainNavItems = EMPTY_MAIN_NAV_ITEMS,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md transition-[background-color,border-color] duration-200 has-[[data-nav-panel]:not([hidden])]:bg-background">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="header-nav-layout">
          {/* Left section: Logo */}
          <div className="header-nav-left">
            <Logo />
          </div>

          {/* Center section: Main Navigation (Desktop) */}
          <CenterNav
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
  mainNavItems,
  mainNavigationLabel,
}: {
  mainNavItems: HeaderNavItem[];
  mainNavigationLabel: string;
}) {
  if (mainNavItems.length === 0) return null;

  return (
    <nav
      className="header-nav-center"
      aria-label={mainNavigationLabel}
      data-testid="header-desktop-nav"
    >
      <HeaderNavMenuBar items={mainNavItems} />
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
  locale: Locale;
  languageAriaLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
}) {
  const contactHref = PATHS_CONFIG.contact;
  // 单语言配置没有可切换目标；多语言时由配置长度自动恢复。
  const hasLanguageSwitch = LOCALES_CONFIG.locales.length > 1;
  const mobileLanguageSwitcher = hasLanguageSwitch ? (
    <MobileLanguageSwitcher locale={locale} />
  ) : undefined;

  return (
    <div className="header-nav-right" data-testid="header-utility-controls">
      <Link
        href={contactHref}
        prefetch={false}
        data-testid="header-cta"
        className={cn(HEADER_CTA_CLASS, "header-cta-desktop-only")}
      >
        <span data-testid="header-contact-sales-label" translate="no">
          {contactSalesLabel}
        </span>
        <NavigationPending />
      </Link>
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
          <NavigationPending />
        </Link>
      </div>
      {hasLanguageSwitch ? (
        <div className="header-full-desktop-only h-10 items-center">
          <LanguageToggleIsland ariaLabel={languageAriaLabel} locale={locale} />
        </div>
      ) : null}
      <div className="header-mobile-only h-10 w-10">
        <MobileNavigationIsland
          languageSwitcher={mobileLanguageSwitcher}
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
          siteName={SINGLE_SITE_CONFIG.name}
        >
          <MobileNavigationLinks
            contactSalesLabel={contactSalesLabel}
            languageSwitcher={mobileLanguageSwitcher}
            data-testid="header-mobile-navigation-fallback-links"
          />
        </MobileNavigationIsland>
      </div>
    </div>
  );
}
