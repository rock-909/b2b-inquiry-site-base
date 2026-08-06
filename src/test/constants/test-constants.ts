/**
 * 测试相关常量定义 - 主入口文件
 * 重新导出所有拆分的测试常量，保持向后兼容性
 * 遵循项目编码标准，提高测试代码的可维护性
 */

// ==================== 基础测试常量 ====================

/** 测试基础数字常量 */
const TEST_BASE_NUMBERS = {
  // 时间相关
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  TWENTY_FIVE_HOURS: 25,

  // 计数相关
  SMALL_COUNT: 2,
  MEDIUM_COUNT: 5,
  LARGE_COUNT: 10,
  VERY_LARGE_COUNT: 20,
  HUGE_COUNT: 25,

  // 数学运算
  DIVISION_BY_TWO: 2,

  // 百分比
  PERCENTAGE_FULL: 100,
  HALF_PERCENTAGE: 50,

  // 角度
  FULL_CIRCLE_DEGREES: 360,
  RIGHT_ANGLE_DEGREES: 90,

  // 浮点数测试
  FLOAT_DECIMAL_ONE: 0.1,
  FLOAT_DECIMAL_TWO: 0.2,

  // 内存大小（MB）
  MEMORY_SIZE_50MB: 50,
  MEMORY_SIZE_100MB: 100,
  MEMORY_SIZE_200MB: 200,

  // 字节转换
  BYTES_PER_KB: 1024,
} as const;

/** 测试迭代和计数常量 */
export const TEST_COUNT_CONSTANTS = {
  /** 微小计数 - 3 */
  TINY: 3,

  /** 小计数 - 2 */
  SMALL: TEST_BASE_NUMBERS.SMALL_COUNT,

  /** 中等计数 - 5 */
  MEDIUM: TEST_BASE_NUMBERS.MEDIUM_COUNT,

  /** 大计数 - 10 */
  LARGE: TEST_BASE_NUMBERS.LARGE_COUNT,

  /** 超大计数 - 20 */
  VERY_LARGE: TEST_BASE_NUMBERS.VERY_LARGE_COUNT,

  /** 巨大计数 - 25 */
  HUGE: TEST_BASE_NUMBERS.HUGE_COUNT,

  /** 完整百分比 - 100 */
  PERCENTAGE_FULL: TEST_BASE_NUMBERS.PERCENTAGE_FULL,

  /** 最大标签数 - 5 */
  MAX_TAGS: TEST_BASE_NUMBERS.MEDIUM_COUNT,
} as const;

// ==================== 性能测试常量 ====================
// Web Vitals 常量已移动到 test-web-vitals-constants.ts
