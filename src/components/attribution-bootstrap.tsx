"use client";

import { useEffect } from "react";
import {
  loadAttributionModule,
  registerAttributionFlushListeners,
  shouldLoadAttribution,
  type AttributionModuleLoader,
} from "@/components/attribution-bootstrap-utils";

interface AttributionBootstrapProps {
  loadModule?: AttributionModuleLoader;
}

export function AttributionBootstrap({
  loadModule = loadAttributionModule,
}: AttributionBootstrapProps) {
  useEffect(() => {
    if (!shouldLoadAttribution(window.location.search)) {
      return undefined;
    }

    let cancelled = false;
    let removeFlushListeners: (() => void) | undefined;

    loadModule()
      .then(({ flushPendingAttribution, storeAttributionData }) => {
        if (!cancelled) {
          storeAttributionData();
          removeFlushListeners = registerAttributionFlushListeners(
            flushPendingAttribution,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      removeFlushListeners?.();
    };
  }, [loadModule]);

  return null;
}
