/**
 * 计数与数值常量定义
 *
 * 这个文件包含基础计数和通用数值常量。
 * 领域特定的常量应该放在各自的文件中：
 * - 验证限制 → ./validation-limits.ts
 * - 时间常量 → ./time.ts
 */

// -- 进制和编码相关 --
/** 十六进制基数 (parseInt/toString(16))。仅表示进制 16，不要借用它表示字节长度。 */
export const HEX_RADIX = 16 as const;
