import type { BrandAssets } from "@/config/site-types";
import { SINGLE_SITE_FACTS } from "@/config/single-site";

const PLACEHOLDER_EMAIL_VALUES = new Set([
  "sales@example.com",
  "starter-contact@example.com",
]);
const PLACEHOLDER_PHONE_VALUES = new Set(["+86-518-0000-0000", "TODO-OWNER"]);
const PHONE_ZERO_BLOCK_PATTERN = /(?:^|[-\s])0{3,}(?:[-\s]|$)/;
const EXAMPLE_EMAIL_DOMAIN_PATTERN =
  /@(?:example\.com|example\.org|example\.net|[\w.-]+\.example)$/iu;
const US_COUNTRY_CODE_WITH_NATIONAL_LENGTH = 11;
const US_NATIONAL_PHONE_LENGTH = 10;
const US_AREA_CODE_END = 3;
const US_EXCHANGE_CODE_END = 6;

function isFakePublicPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/gu, "");
  const nationalDigits =
    digits.length === US_COUNTRY_CODE_WITH_NATIONAL_LENGTH &&
    digits.startsWith("1")
      ? digits.slice(1)
      : digits;

  if (nationalDigits === "1234567890") return true;
  if (nationalDigits.length !== US_NATIONAL_PHONE_LENGTH) return false;

  return (
    nationalDigits.slice(0, US_AREA_CODE_END) === "555" ||
    nationalDigits.slice(US_AREA_CODE_END, US_EXCHANGE_CODE_END) === "555"
  );
}

export function isPublicEmailConfigured(
  email: string | null | undefined,
): email is string {
  if (typeof email !== "string") return false;

  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  if (PLACEHOLDER_EMAIL_VALUES.has(trimmed.toLowerCase())) return false;
  if (EXAMPLE_EMAIL_DOMAIN_PATTERN.test(trimmed)) return false;

  return true;
}

export function getPublicContactEmail(
  email: string | null | undefined = SINGLE_SITE_FACTS.contact.email,
): string | undefined {
  return isPublicEmailConfigured(email) ? email.trim() : undefined;
}

export function isPublicPhoneConfigured(
  phone: string | null | undefined,
): phone is string {
  if (typeof phone !== "string") return false;

  const trimmed = phone.trim();
  if (trimmed.length === 0) return false;
  if (PLACEHOLDER_PHONE_VALUES.has(trimmed)) return false;
  if (PHONE_ZERO_BLOCK_PATTERN.test(trimmed)) return false;
  if (isFakePublicPhoneNumber(trimmed)) return false;

  return true;
}

export function getPublicContactPhone(
  phone: string | null | undefined = SINGLE_SITE_FACTS.contact.phone,
): string | undefined {
  return isPublicPhoneConfigured(phone) ? phone.trim() : undefined;
}

export function getPublicLogoPath(
  logo: BrandAssets["logo"] = SINGLE_SITE_FACTS.brandAssets.logo,
): string | undefined {
  return logo.status === "ready" ? logo.horizontal : undefined;
}
