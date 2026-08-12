import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getOfferingById } from "@/config/offerings";
import { routing } from "@/i18n/routing-config";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const productMatch = request.nextUrl.pathname.match(
    /^\/products\/([^/]+)\/?$/u,
  );
  const productId = productMatch?.[1];

  if (productId && !getOfferingById(productId)) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = `/${routing.defaultLocale}/__not-found-placeholder`;
    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
