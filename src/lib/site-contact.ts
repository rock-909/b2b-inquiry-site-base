import type { CompanyInfo } from "@/config/site-types";

// 与 Organization JSON-LD 的 PostalAddress 同源同序：街道、城市、国家。
export function formatCompanyAddress(location: CompanyInfo["location"]) {
  const { address, city, country } = location ?? {};
  return [address, city, country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

// 号码格式已在 SINGLE_SITE_CONFIG 加载时校验；wa.me 只要数字。
export function whatsappHref(number: string) {
  return `https://wa.me/${number.replace(/\D/gu, "")}`;
}
