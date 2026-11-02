import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";
import {
  CONSENT_PENDING_DATASET_KEY,
  CONSENT_STORAGE_KEY,
} from "@/lib/cookie-consent/types";

/** 只有构建时配置了 GA 才会出现同意卡片。 */
export function isConsentBannerEnabled(): boolean {
  return Boolean(getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID"));
}

/**
 * 首帧前运行的内联脚本：只看有没有存储记录（不校验内容），没有或读不了存储就标记 <html>，
 * 让服务端输出的同意卡片从首帧起占位显示，页脚不会在卡片出现后再上移。
 * 记录是否有效仍由客户端读取后决定。
 */
export const CONSENT_PENDING_SCRIPT = `(function(){var d=document.documentElement.dataset;try{if(!localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}))d.${CONSENT_PENDING_DATASET_KEY}=""}catch(e){d.${CONSENT_PENDING_DATASET_KEY}=""}})()`;
