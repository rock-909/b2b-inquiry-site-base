"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export function LocalizedNotFoundView() {
  const t = useTranslations("errors.notFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <div className="text-6xl font-bold text-muted-foreground">404</div>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/">{t("goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
