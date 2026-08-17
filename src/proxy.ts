import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getOfferingById } from "@/config/offerings";
import { routing } from "@/i18n/routing-config";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/u, "") || "/";
  const localePrefix = routing.locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  const publicPath = localePrefix
    ? pathname.slice(localePrefix.length + 1) || "/"
    : pathname;
  const productMatch = publicPath.match(/^\/products\/([^/]+)$/u);
  const productId = productMatch?.[1];
  const isKnownStaticPath = Object.prototype.hasOwnProperty.call(
    routing.pathnames,
    publicPath,
  );

  if (!isKnownStaticPath && (!productId || !getOfferingById(productId))) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = `/${routing.defaultLocale}/__not-found-placeholder`;
    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
