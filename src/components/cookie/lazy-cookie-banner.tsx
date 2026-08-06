"use client";

import { lazy, Suspense } from "react";

interface CookieBannerProps {
  className?: string;
}

const CookieBanner = lazy(() =>
  import("@/components/cookie/cookie-banner").then((mod) => ({
    default: mod.CookieBanner,
  })),
);

export function LazyCookieBanner(props: CookieBannerProps) {
  return (
    <Suspense fallback={null}>
      <CookieBanner {...props} />
    </Suspense>
  );
}
