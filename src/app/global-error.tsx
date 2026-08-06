"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isPublicRuntimeDevelopment } from "@/lib/public-runtime-env";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const GLOBAL_ERROR_LOCALE = "en" as const;
const HOME_HREF = "/";

const translations = {
  title: "Something went wrong!",
  description:
    "We apologize for the inconvenience. An unexpected error has occurred.",
  tryAgain: "Try again",
  goHome: "Go to homepage",
  devDetails: "Error Details (Development Only)",
} as const;

function isDevelopmentRuntime(): boolean {
  return isPublicRuntimeDevelopment();
}

async function reportGlobalError(error: Error): Promise<void> {
  const { logger } = await import("@/lib/logger");
  logger.error("Global error caught", error);
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const router = useRouter();

  useEffect(() => {
    reportGlobalError(error).catch(() => undefined);
  }, [error]);

  return (
    <html lang={GLOBAL_ERROR_LOCALE}>
      <body>
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
          <div className="mx-auto max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-foreground">
              {translations.title}
            </h1>
            <p className="mb-6 text-muted-foreground">
              {translations.description}
            </p>
            {isDevelopmentRuntime() && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm font-medium">
                  {translations.devDetails}
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {error.message}
                  {error.stack && (
                    <>
                      {"\n\n"}
                      {error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <div className="space-y-4">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-[38px] w-full shrink-0 items-center justify-center rounded-[6px] bg-[var(--button-primary-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--button-primary-fg)] transition-colors duration-150 hover:bg-[var(--button-primary-hover-bg)]"
                data-testid="try-again-button"
              >
                {translations.tryAgain}
              </button>
              <button
                type="button"
                // nosemgrep: nextjs-unsafe-redirect -- HOME_HREF is the fixed internal root path, never request or user input
                onClick={() => router.push(HOME_HREF)}
                className="inline-flex h-[38px] w-full shrink-0 items-center justify-center rounded-[6px] border-2 border-[var(--button-primary-bg)] bg-transparent px-5 py-2.5 text-sm font-semibold text-[var(--primary-text)] transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--button-primary-bg)_10%,transparent)]"
                data-testid="go-home-button"
              >
                {translations.goHome}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
