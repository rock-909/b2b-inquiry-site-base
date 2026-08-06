import { generateLocaleMetadata } from "@/app/[locale]/layout-metadata";
import "@/app/globals.css";
import { type ReactNode, Suspense } from "react";
import { notFound } from "next/navigation";
import { locale as getRootLocale } from "next/root-params";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFontClassNames } from "@/app/[locale]/layout-fonts";
import { AttributionBootstrap } from "@/components/attribution-bootstrap";
import { LazyCookieConsentIsland } from "@/components/cookie/lazy-cookie-consent-island";
import { Footer } from "@/components/footer/footer";
import { Header } from "@/components/layout/header";
import { NavigationProgressBar } from "@/components/navigation/navigation-progress-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { coerceLocale, isLocale } from "@/i18n/locale-utils";
import { loadClientMessages } from "@/lib/i18n/client-messages";
import { mainNavigation } from "@/lib/navigation";

// Client analytics are rendered as an island to avoid impacting LCP

// 重新导出元数据生成函数
export const generateMetadata = generateLocaleMetadata;

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

  const contactSalesLabel = tNavigation("contactSales");
  const openMenuLabel = tAccessibility("openMenu");
  const closeMenuLabel = tAccessibility("closeMenu");
  const skipToContentLabel = tAccessibility("skipToContent");
  const mainNavigationLabel = tAccessibility("mainNavigation");
  const mainNavItems = mainNavigation.map((item) => ({
    key: item.key,
    href: item.href,
    label: tNavigation(item.messageKey),
  }));

  return (
    <>
      <a href="#main-content" className="skip-link">
        {skipToContentLabel}
      </a>
      <NextIntlClientProvider locale={locale} messages={clientMessages}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          {/* P1-1 Fix: Single attribution initialization for UTM tracking */}
          <AttributionBootstrap />

          {/* 导航栏 */}
          <Header
            locale={locale}
            contactSalesLabel={contactSalesLabel}
            openMenuLabel={openMenuLabel}
            closeMenuLabel={closeMenuLabel}
            mainNavigationLabel={mainNavigationLabel}
            mainNavItems={mainNavItems}
          />

          <main id="main-content" className="flex-1">
            {children}
          </main>

          {/* 页脚：发丝线三列 + 法务条，法务信息在 Footer 内部取自 single-site 配置 */}
          <Footer
            themeToggleSlot={
              <ThemeSwitcher data-testid="footer-theme-toggle" />
            }
          />

          {/* Consent UI and analytics are deferred until the main thread is idle. */}
          <LazyCookieConsentIsland />
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
  setRequestLocale(typedLocale);

  return (
    <html
      lang={typedLocale}
      className={getFontClassNames()}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <AsyncLocaleLayoutContent>{children}</AsyncLocaleLayoutContent>
      </body>
    </html>
  );
}
