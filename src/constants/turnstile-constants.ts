/**
 * Turnstile widget layout constants.
 * Based on Cloudflare's documented widget sizes.
 */
export const TURNSTILE_WIDGET_HEIGHT_PX = {
  normal: 65,
  compact: 140,
} as const;

/** Single runtime action for all inquiry-family Turnstile widgets and verification. */
export const INQUIRY_TURNSTILE_ACTION = "product_inquiry";

/** Cloudflare's public dummy token for an always-pass test widget. */
export const TURNSTILE_DUMMY_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** Cloudflare's public always-pass test secret. */
export const TURNSTILE_ALWAYS_PASS_TEST_SECRET =
  "1x0000000000000000000000000000000AA";
