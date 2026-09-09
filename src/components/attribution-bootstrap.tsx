"use client";

import { useEffect } from "react";
import {
  loadAttributionModule,
  shouldLoadAttribution,
} from "@/components/attribution-bootstrap-utils";

export function AttributionBootstrap() {
  useEffect(() => {
    if (!shouldLoadAttribution(window.location.search)) {
      return undefined;
    }

    let cancelled = false;
    loadAttributionModule()
      .then(({ storeAttributionData }) => {
        if (!cancelled) {
          storeAttributionData();
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
