import { generateLocaleMetadata } from "@/app/[locale]/layout-metadata";
import "@/app/globals.css";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { locale as getRootLocale } from "next/root-params";
import {
  createTranslator,
  NextIntlClientProvider,
  type Messages,
} from "next-intl";
import { getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { AttributionBootstrap } from "@/components/attribution-bootstrap";
import { CookieConsentIsland } from "@/components/cookie/cookie-consent-island";
import { Footer } from "@/components/footer/footer";
import { Header } from "@/components/layout/header";
import {
  LanguageSuggestion,
  type LanguageSuggestionCopy,
} from "@/components/layout/language-suggestion";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { coerceLocale, isLocale } from "@/i18n/locale-utils";
import { loadClientMessages } from "@/lib/i18n/client-messages";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import type {
  NavigationLabelKey,
  SiteNavigationGroup,
} from "@/config/site-types";
import { LOCALES_CONFIG, type ConfiguredLocale } from "@/config/paths";

// Client analytics are rendered as an island to avoid impacting LCP

// 重新导出元数据生成函数
export const generateMetadata = generateLocaleMetadata;

function toHeaderNavGroup(
  group: SiteNavigationGroup,
  t: (key: NavigationLabelKey) => string,
) {
  return {
    key: group.key,
    label: t(group.messageKey),
    links: group.links.map((link) => ({
      key: link.key,
      href: link.href,
      label: t(link.messageKey),
      external: link.external,
    })),
  };
}

// 语言建议条用建议的语言显示，所以每种已配置语言的文案都要预先给到客户端。
// getTranslations 的消息固定来自当前请求的语言，这里直接用各语言自己的消息文件。
function loadLanguageSuggestionCopy(): Record<
  ConfiguredLocale,
  LanguageSuggestionCopy
> {
  const entries = LOCALES_CONFIG.locales.map((locale) => {
    const t = createTranslator({
      locale,
      messages: loadCompleteMessages(locale) as Messages,
      namespace: "languageSuggestion",
    });
    const copy: LanguageSuggestionCopy = {
      label: t("label"),
      message: t("message"),
      switchAction: t("switchAction"),
      dismiss: t("dismiss"),
    };
    return [locale, copy] as const;
  });
  return Object.fromEntries(entries) as Record<
    ConfiguredLocale,
    LanguageSuggestionCopy
  >;
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}
interface AsyncLocaleLayoutContentProps {
  children: ReactNode;
}

async function AsyncLocaleLayoutContent({
  children,
}: AsyncLocaleLayoutContentProps) {
  const locale = coerceLocale(await getRootLocale());
  // Do not read runtime headers here; keep the layout prerenderable. Static CSP
  // is emitted from next.config.ts.

  const [tNavigation, tAccessibility, clientMessages] = await Promise.all([
    getTranslations({
      locale,
      namespace: "navigation",
    }),
    getTranslations({
      locale,
      namespace: "accessibility",
    }),
    loadClientMessages(locale),
  ]);
  const languageSuggestionCopy = loadLanguageSuggestionCopy();

  const contactSalesLabel = tNavigation("contactSales");
  const openMenuLabel = tAccessibility("openMenu");
  const closeMenuLabel = tAccessibility("closeMenu");
  const skipToContentLabel = tAccessibility("skipToContent");
  const mainNavigationLabel = tAccessibility("mainNavigation");
  const languageAriaLabel = tAccessibility("language", {
    language: LOCALES_CONFIG.displayNames[locale],
  });
  const mainNavItems = SINGLE_SITE_NAVIGATION.map((item) =>
    item.groups
      ? {
          key: item.key,
          label: tNavigation(item.messageKey),
          groups: item.groups.map((group) =>
            toHeaderNavGroup(group, tNavigation),
          ),
        }
      : { key: item.key, href: item.href, label: tNavigation(item.messageKey) },
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        {skipToContentLabel}
      </a>
      <NextIntlClientProvider locale={locale} messages={clientMessages}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* P1-1 Fix: Single attribution initialization for UTM tracking */}
          <AttributionBootstrap />

          {/* 导航栏 */}
          <Header
            locale={locale}
            contactSalesLabel={contactSalesLabel}
            openMenuLabel={openMenuLabel}
            closeMenuLabel={closeMenuLabel}
            languageAriaLabel={languageAriaLabel}
            mainNavigationLabel={mainNavigationLabel}
            mainNavItems={mainNavItems}
          />

          <main id="main-content" className="flex-1">
            {children}
          </main>

          {/* 页脚：核心导航与主题选择 */}
          <Footer
            themeToggleSlot={
              <ThemeSwitcher data-testid="footer-theme-toggle" />
            }
          />

          <CookieConsentIsland />
          {LOCALES_CONFIG.locales.length > 1 ? (
            <LanguageSuggestion locale={locale} copy={languageSuggestionCopy} />
          ) : null}
        </ThemeProvider>
      </NextIntlClientProvider>
    </>
  );
}

export default async function LocaleLayout({ children }: LocaleLayoutProps) {
  const locale = await getRootLocale();

  // Ensure that the incoming `locale` is valid
  if (!isLocale(locale)) {
    notFound();
  }

  const typedLocale = coerceLocale(locale);

  return (
    <html lang={typedLocale} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased">
        <AsyncLocaleLayoutContent>{children}</AsyncLocaleLayoutContent>
      </body>
    </html>
  );
}
