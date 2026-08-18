"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const CSS_VAR_BANNER_HEIGHT = "--cookie-banner-height";

export function CookieBanner({
  onAccept,
  onReject,
}: {
  onAccept: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("cookie");
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return undefined;

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        CSS_VAR_BANNER_HEIGHT,
        `${banner.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty(CSS_VAR_BANNER_HEIGHT, "0px");
    };
  }, []);

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-[100] border-t bg-background/95 shadow-lg backdrop-blur-sm supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t("description")}
          </p>
          <Link
            href="/privacy"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-sm py-2 text-xs font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
          >
            {t("learnMore")}
          </Link>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            {t("rejectAll")}
          </Button>
          <Button size="sm" onClick={onAccept}>
            {t("acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
