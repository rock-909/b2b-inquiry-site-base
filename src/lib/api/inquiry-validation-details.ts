import { type ZodIssue } from "zod";
import {
  type InquiryErrorField,
  INQUIRY_FIELD_ERROR_DETAILS,
  INQUIRY_FIELD_ERROR_KEYS,
} from "@/constants/inquiry-field-error-protocol";

const GENERIC_VALIDATION_DETAIL = "errors.generic";

type InquiryErrorLeafName = "required" | "invalid" | "tooLong" | "tooShort";

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
 * - too_small：minimum<=1、source 缺失或空白 → required，否则 tooShort；
 * - invalid_type：source 缺失或空白 → required，否则 invalid；
 * - custom：显式 reason==="required"，或 source 缺失/空白 → required，否则 invalid；
 * - too_big → tooLong；其余 code → invalid。
 */
function classifyIssue(
  issue: ZodIssue,
  source: Record<string, unknown>,
): InquiryErrorLeafName {
  const sourceValue = getSourceValueAtPath(source, issue.path);
  const missingOrBlank =
    sourceValue === undefined || isBlankSourceValue(sourceValue);

  switch (issue.code) {
    case "too_small":
      if ("minimum" in issue && typeof issue.minimum === "number") {
        if (issue.minimum <= 1) return "required";
        return missingOrBlank ? "required" : "tooShort";
      }
      return missingOrBlank ? "required" : "tooShort";
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
function inquiryFieldPrefix(field: string): string | undefined {
  switch (field as InquiryErrorField) {
    case "fullName":
      return INQUIRY_FIELD_ERROR_KEYS.fullName;
    case "email":
      return INQUIRY_FIELD_ERROR_KEYS.email;
    case "message":
      return INQUIRY_FIELD_ERROR_KEYS.message;
    default:
      return undefined;
  }
}

/**
 * 服务端唯一入口：Zod issue 直接映射为精确的 wire detail 字符串。
 * 保持与旧实现完全一致的三条合同：issue 顺序去重、同字段 .required 抑制
 * .invalid、未注册字段回退 errors.generic。wire 字符串格式不变。
 */
export function mapInquiryValidationDetails(
  issues: readonly ZodIssue[],
  source: Record<string, unknown> = {},
): string[] {
  const details: string[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const [rawField] = issue.path;
    const prefix =
      typeof rawField === "string" ? inquiryFieldPrefix(rawField) : undefined;

    const detail = prefix
      ? `${prefix}.${classifyIssue(issue, source)}`
      : GENERIC_VALIDATION_DETAIL;

    if (!seen.has(detail)) {
      seen.add(detail);
      details.push(detail);
    }
  }

  return details.filter((detail) => {
    if (!detail.endsWith(".invalid")) return true;
    const baseKey = detail.slice(0, -".invalid".length);
    return !details.includes(`${baseKey}.required`);
  });
}

/** Detail leaves the inquiry mapper can emit for inquiryLeadSchema. */
export const INQUIRY_VALIDATION_DETAIL_KEYS = [
  GENERIC_VALIDATION_DETAIL,
  ...INQUIRY_FIELD_ERROR_DETAILS,
] as const;
