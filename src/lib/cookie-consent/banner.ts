import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";

/** 只有构建时配置了 GA 才会出现同意卡片。 */
export function isConsentBannerEnabled(): boolean {
  return Boolean(getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID"));
}
