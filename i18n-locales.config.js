/**
 * i18n Locales Configuration
 * 统一配置翻译工具的语言列表
 *
 * 用于以下脚本：
 * - scripts/quality/checks/translations.js  (验证翻译文件一致性)
 *
 * 工具直接读取运行配置，不独立维护语言列表。
 */

module.exports = require("./src/config/paths/locales-config.ts").LOCALES_CONFIG;
