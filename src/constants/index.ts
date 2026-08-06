// Aggregated constants entrypoint. Avoid self-imports to prevent circular deps.

/**
 * 常量模块统一导出
 * 提供项目中所有常量的集中访问点
 *
 * 模块结构:
 * - ./validation-limits.ts - 验证限制和约束常量
 * - ./count.ts            - 基础计数和数值常量
 * - ./time.ts             - 时间相关常量
 * - ./core.ts             - HTTP 状态码常量
 * - ./decimal.ts          - 小数常量
 */

// ============================================================================
// 验证限制常量
// ============================================================================
export {
  // Lead pipeline
  MAX_LEAD_PRODUCT_NAME_LENGTH,
} from "./validation-limits";

// ============================================================================
// 时间相关常量
// ============================================================================
export { MINUTE_MS } from "./time";

// ============================================================================
// 计数与数值常量
// ============================================================================
export { HEX_RADIX } from "./count";

// ============================================================================
// HTTP 状态码常量
// ============================================================================
export {
  HTTP_OK,
  HTTP_NO_CONTENT,
  HTTP_BAD_REQUEST,
  HTTP_NOT_FOUND,
  HTTP_PAYLOAD_TOO_LARGE,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_INTERNAL_ERROR,
  HTTP_SERVICE_UNAVAILABLE,
} from "./core";
