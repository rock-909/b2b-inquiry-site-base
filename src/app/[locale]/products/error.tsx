"use client";

import { useTranslations } from "next-intl";
import { RouteErrorView } from "@/components/errors/route-error-view";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductsRouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("errors.products");

  return (
    <RouteErrorView
      error={error}
      reset={reset}
      logContext="Products"
      copy={{
        title: t("title"),
        description: t("description"),
        tryAgain: t("tryAgain"),
        goHome: t("goHome"),
      }}
    />
  );
}
