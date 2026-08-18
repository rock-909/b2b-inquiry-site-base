/**
 * 时间相关常量
 *
 * 🎯 用途：时间单位、时间间隔等时间相关的常量定义
 */

// ============================================================================
// 基础时间单位
// ============================================================================

const SIX_HUNDRED_MS = 600;
const TWELVE_HUNDRED_MS = 1200;
export const FIVE_SECONDS_MS = 5000;
export const MINUTE_MS = 60000;

// ============================================================================
// 性能优化相关时间常量
// ============================================================================

/** requestIdleCallback fallback延迟（当浏览器不支持时使用setTimeout） */
export const IDLE_CALLBACK_FALLBACK_DELAY = SIX_HUNDRED_MS;
/** requestIdleCallback超时时间（用于确保回调最终执行） */
export const IDLE_CALLBACK_TIMEOUT = TWELVE_HUNDRED_MS;
