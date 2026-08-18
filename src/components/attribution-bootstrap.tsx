"use client";

import { useEffect } from "react";
import {
  loadAttributionModule,
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
    loadModule()
      .then(({ storeAttributionData }) => {
        if (!cancelled) {
          storeAttributionData();
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [loadModule]);

  return null;
}
