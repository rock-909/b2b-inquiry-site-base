"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const CSS_VAR_BANNER_HEIGHT = "--cookie-banner-height";

export function CookieBanner({
  onAccept,
  onReject,
  onSave,
}: {
  onAccept: () => void;
  onReject: () => void;
  onSave: (choice: { analytics: boolean; advertising: boolean }) => void;
}) {
  const t = useTranslations("cookie");
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
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
            className="text-link rounded-sm"
          >
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              className="size-4"
            />
            {t("analytics")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={advertising}
              onChange={(event) => setAdvertising(event.target.checked)}
              className="size-4"
            />
            {t("advertising")}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onReject}>
            {t("rejectAll")}
          </Button>
          <Button variant="outline" onClick={onAccept}>
            {t("acceptAll")}
          </Button>
          <Button
            variant="ghost"
            className="col-span-2"
            onClick={() => onSave({ analytics, advertising })}
          >
            {t("saveChoices")}
          </Button>
        </div>
      </div>
    </div>
  );
}
