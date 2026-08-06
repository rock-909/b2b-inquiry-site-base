import { getTranslations } from "next-intl/server";
import {
  generateOrganizationData,
  generateWebSiteData,
} from "@/lib/structured-data-generators";
import type { Locale } from "@/i18n/routing";

export interface PageStructuredData {
  organizationData: Record<string, unknown>;
  websiteData: Record<string, unknown>;
}

export async function generatePageStructuredData(
  locale: Locale,
): Promise<PageStructuredData> {
  const t = await getTranslations({
    locale,
    namespace: "structured-data",
  });

  const organizationData = generateOrganizationData(t, {});
  const websiteData = generateWebSiteData(t, {});

  return { organizationData, websiteData };
}
