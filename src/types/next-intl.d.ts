/**
 * next-intl Type Augmentation
 *
 * Provides compile-time type safety for translation keys via
 * AppConfig.Messages module augmentation.
 *
 * The single locale file is the source of truth for runtime and type-safe
 * translation keys.
 *
 * @see https://next-intl.dev/docs/workflows/typescript
 */

import type enBaseMessages from "@messages/base/en/messages.json";

type Messages = typeof enBaseMessages;

declare module "next-intl" {
  /**
   * Module augmentation for next-intl's AppConfig interface.
   * This enables strict type checking for all translation function calls.
   */
  interface AppConfig {
    Messages: Messages;
  }
}
