"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export interface RouteErrorCopy {
  title: string;
  description: string;
  tryAgain: string;
  goHome: string;
}

export interface RouteErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  logContext: string;
  copy: RouteErrorCopy;
}

export function RouteErrorView({
  error,
  reset,
  logContext,
  copy,
}: RouteErrorViewProps) {
  useEffect(() => {
    logger.error(`${logContext} route error`, error);
  }, [error, logContext]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{copy.description}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>
            {copy.tryAgain}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{copy.goHome}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
