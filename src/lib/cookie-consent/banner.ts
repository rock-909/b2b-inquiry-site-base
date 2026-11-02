import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";
import {
  CONSENT_PENDING_DATASET_KEY,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "@/lib/cookie-consent/types";

/** 只有构建时配置了 GA 才会出现同意卡片。 */
export function isConsentBannerEnabled(): boolean {
  return Boolean(getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID"));
}

/**
 * 首帧前运行的内联脚本：按 storage.ts 的 loadConsent 同一规则判断有没有有效记录
 * （存储可写、JSON 可解析、当前 CONSENT_VERSION、字段齐全）。没有有效记录就标记 <html>，
 * 让服务端输出的同意卡片从首帧起占位显示，页脚不会在卡片出现后再上移。
 * 两边判断是否一致由 banner.test.ts 用同一组用例同时跑两者来锁定。
 */
export const CONSENT_PENDING_SCRIPT = `(function(){try{var s=localStorage,t="__storage_test__";s.setItem(t,t);s.removeItem(t);var r=JSON.parse(s.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)})),c=r.consent;if(r.version===${CONSENT_VERSION}&&typeof r.updatedAt=="string"&&typeof c=="object"&&c&&c.necessary===true&&typeof c.analytics=="boolean"&&typeof c.advertising=="boolean")return}catch(e){}document.documentElement.dataset.${CONSENT_PENDING_DATASET_KEY}=""})()`;
