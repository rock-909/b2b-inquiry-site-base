import { type ZodIssue } from "zod";
import {
  type InquiryFieldErrorDetail,
  INQUIRY_FIELD_ERROR_DETAILS,
} from "@/constants/inquiry-field-error-protocol";

const GENERIC_VALIDATION_DETAIL = "errors.generic";

/** 协议声明的全部可见 leaf（inquiry schema 不存在 minLength>1，无 tooShort）。 */
type InquiryVisibleLeaf = "required" | "invalid" | "tooLong";

function getSourceValueAtPath(
  source: Record<string, unknown>,
  path: readonly PropertyKey[],
): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (typeof segment !== "string") return undefined;
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isBlankSourceValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

function readCustomReason(issue: ZodIssue): unknown {
  if (
    !("params" in issue) ||
    typeof issue.params !== "object" ||
    !issue.params
  ) {
    return undefined;
  }

  if (!("reason" in issue.params)) return undefined;
  return issue.params.reason;
}

/**
 * 与既有 wire 行为逐条对齐的分类规则：
 * - too_small：minimum<=1 或 source 缺失/空白 → required，否则 tooLong 之外的
 *   tooSmall 场景在 inquiryLeadSchema 下不存在（各字段均为 min(1)/max(N)）；
 * - too_big → tooLong；
 * - invalid_type：source 缺失或空白 → required，否则 invalid；
 * - custom：显式 reason==="required"，或 source 缺失/空白 → required，否则 invalid；
 * - 其余 code（含 email 格式 invalid_format 等）→ invalid。
 */
function classifyIssue(
  issue: ZodIssue,
  source: Record<string, unknown>,
): InquiryVisibleLeaf {
  const sourceValue = getSourceValueAtPath(source, issue.path);
  const missingOrBlank =
    sourceValue === undefined || isBlankSourceValue(sourceValue);

  switch (issue.code) {
    case "too_small":
      if ("minimum" in issue && typeof issue.minimum === "number") {
        return issue.minimum <= 1 || missingOrBlank ? "required" : "invalid";
      }
      return missingOrBlank ? "required" : "invalid";
    case "too_big":
      return "tooLong";
    case "invalid_type":
      return missingOrBlank ? "required" : "invalid";
    case "custom":
      if (readCustomReason(issue) === "required") return "required";
      return missingOrBlank ? "required" : "invalid";
    default:
      return "invalid";
  }
}

/** 协议字段名单的 exhaustive 封口：新增字段漏写分支时 type-check 直接红。 */
function mapInquiryIssue(
  issue: ZodIssue,
  source: Record<string, unknown>,
): InquiryFieldErrorDetail | typeof GENERIC_VALIDATION_DETAIL {
  const [rawField] = issue.path;

  switch (rawField) {
    case "fullName":
      return `errors.fullName.${classifyIssue(issue, source)}`;
    case "email":
      return `errors.email.${classifyIssue(issue, source)}`;
    case "message": {
      // message 协议只有 invalid/tooLong；required 在该 schema 下不可达
      //（message 为 optional 且无 min>1），防御性归入 generic 回退。
      const leaf = classifyIssue(issue, source);
      if (leaf === "required") {
        return GENERIC_VALIDATION_DETAIL;
      }
      return `errors.message.${leaf}`;
    }
    default:
      return GENERIC_VALIDATION_DETAIL;
  }
}

/**
 * 服务端唯一入口：Zod issue 直接映射为精确的 wire detail key。
 * 与旧实现完全一致的三条运行时合同：issue 顺序去重、同字段 .required 抑制
 * .invalid、未注册字段回退 errors.generic；wire 字符串格式不变。
 */
export function mapInquiryValidationDetails(
  issues: readonly ZodIssue[],
  source: Record<string, unknown> = {},
): Array<InquiryFieldErrorDetail | typeof GENERIC_VALIDATION_DETAIL> {
  const details: Array<
    InquiryFieldErrorDetail | typeof GENERIC_VALIDATION_DETAIL
  > = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const detail = mapInquiryIssue(issue, source);

    if (!seen.has(detail)) {
      seen.add(detail);
      details.push(detail);
    }
  }

  return details.filter((detail) => {
    if (!detail.endsWith(".invalid")) return true;
    const baseKey = detail.slice(0, -".invalid".length);
    return !details.some((other) => other === `${baseKey}.required`);
  });
}

/** Detail leaves the inquiry mapper can emit for inquiryLeadSchema. */
export const INQUIRY_VALIDATION_DETAIL_KEYS = [
  GENERIC_VALIDATION_DETAIL,
  ...INQUIRY_FIELD_ERROR_DETAILS,
] as const;
