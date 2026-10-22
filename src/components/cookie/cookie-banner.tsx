"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const CSS_VAR_BANNER_HEIGHT = "--cookie-banner-height";
const CATEGORY_PANEL_ID = "cookie-category-choices";

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
  const [customizing, setCustomizing] = useState(false);
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

  const save = () => onSave({ analytics, advertising });

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover text-popover-foreground shadow-lg duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[30rem] sm:rounded-[var(--card-radius)] sm:border lg:right-auto lg:left-5"
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] leading-5 text-muted-foreground">
          {t("description")}{" "}
          <Link href="/privacy" prefetch={false} className="text-link">
            {t("learnMore")}
          </Link>
        </p>
        {customizing ? (
          <div
            id={CATEGORY_PANEL_ID}
            className="flex flex-wrap items-center justify-between gap-x-2 border-t border-border pt-1"
          >
            <div className="flex flex-wrap gap-x-5">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  className="size-4 accent-[var(--foreground)]"
                />
                {t("analytics")}
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={advertising}
                  onChange={(event) => setAdvertising(event.target.checked)}
                  className="size-4 accent-[var(--foreground)]"
                />
                {t("advertising")}
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={save}>
              {t("saveChoices")}
            </Button>
          </div>
        ) : null}
        {/* 拒绝与允许同级同样式（GDPR 要求拒绝和同意一样容易）；分类选择收进「自定义」。 */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            aria-controls={CATEGORY_PANEL_ID}
            aria-expanded={customizing}
            onClick={() => setCustomizing((open) => !open)}
          >
            {t("customize")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onReject}>
              {t("rejectAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={onAccept}>
              {t("acceptAll")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
