"use client";

import { useTranslations } from "next-intl";
import { RouteErrorView } from "@/components/errors/route-error-view";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ContactRouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("errors.contact");

  return (
    <RouteErrorView
      error={error}
      reset={reset}
      logContext="Contact"
      copy={{
        title: t("title"),
        description: t("description"),
        tryAgain: t("tryAgain"),
        goHome: t("goHome"),
      }}
    />
  );
}
