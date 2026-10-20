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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover text-popover-foreground shadow-lg duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[24rem] sm:rounded-xl sm:border"
    >
      <div className="flex flex-col gap-3 px-6 py-4 sm:p-5">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("description")}{" "}
          <Link
            href="/privacy"
            prefetch={false}
            className="rounded-sm font-medium text-[var(--primary-text)] underline underline-offset-4 transition-colors duration-150 ease-out hover:text-foreground"
          >
            {t("learnMore")}
          </Link>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onReject}>
            {t("rejectAll")}
          </Button>
          <Button variant="outline" onClick={onAccept}>
            {t("acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
