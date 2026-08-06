/**
 * i18n Locales Configuration
 * 统一配置翻译工具的语言列表
 *
 * 用于以下脚本：
 * - scripts/starter-checks.js translations  (验证翻译文件一致性)
 *
 * Runtime locale truth lives in LOCALES_CONFIG
 * (src/config/paths/locales-config.ts). This file is a CommonJS mirror for
 * Node-only tooling and must stay in parity with the runtime config.
 */

module.exports = {
  locales: ["en"],
  defaultLocale: "en",
};
