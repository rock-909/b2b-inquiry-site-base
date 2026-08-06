import { type ZodIssue } from "zod";

export type ValidationFieldErrorKeys = Partial<Record<string, string>>;

export type ValidationIssueReason =
  | "missing_required"
  | "blank_required"
  | "wrong_type"
  | "custom_required"
  | "custom_invalid";

export type StructuredValidationIssue = ZodIssue & {
  validationReason?: ValidationIssueReason;
};

const FALLBACK_VALIDATION_DETAIL = "errors.generic";

function getValueAtPath(
  source: Record<string, unknown>,
  path: readonly PropertyKey[],
): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (typeof segment !== "string") {
      return undefined;
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isBlankSourceValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

function getBaseValidationKey(
  issue: StructuredValidationIssue,
  fieldKeys: ValidationFieldErrorKeys,
): string {
  const [rawField] = issue.path;
  if (typeof rawField !== "string") {
    return FALLBACK_VALIDATION_DETAIL;
  }

  return fieldKeys[rawField] ?? FALLBACK_VALIDATION_DETAIL;
}

function isRequiredMinimum(issue: StructuredValidationIssue): boolean {
  return (
    "minimum" in issue &&
    typeof issue.minimum === "number" &&
    issue.minimum <= 1
  );
}

function isMissingRequiredIssue(issue: StructuredValidationIssue): boolean {
  return issue.validationReason === "missing_required";
}

function isBlankRequiredIssue(issue: StructuredValidationIssue): boolean {
  return issue.validationReason === "blank_required";
}

function readCustomIssueReason(issue: ZodIssue): string | undefined {
  if (
    !("params" in issue) ||
    typeof issue.params !== "object" ||
    !issue.params
  ) {
    return undefined;
  }

  const { reason } = issue.params as { reason?: unknown };
  return typeof reason === "string" ? reason : undefined;
}

function enrichValidationIssueWithSource(
  issue: ZodIssue,
  source: Record<string, unknown>,
): StructuredValidationIssue {
  const sourceValue = getValueAtPath(source, issue.path);

  if (issue.code === "invalid_type") {
    if (sourceValue === undefined) {
      return { ...issue, validationReason: "missing_required" };
    }

    if (isBlankSourceValue(sourceValue)) {
      return { ...issue, validationReason: "blank_required" };
    }

    return { ...issue, validationReason: "wrong_type" };
  }

  if (issue.code === "too_small") {
    if (sourceValue === undefined) {
      return { ...issue, validationReason: "missing_required" };
    }

    if (isBlankSourceValue(sourceValue)) {
      return { ...issue, validationReason: "blank_required" };
    }
  }

  if (issue.code === "custom") {
    const explicitReason = readCustomIssueReason(issue);
    if (explicitReason === "required") {
      return { ...issue, validationReason: "custom_required" };
    }

    if (sourceValue === undefined || isBlankSourceValue(sourceValue)) {
      return { ...issue, validationReason: "custom_required" };
    }

    return { ...issue, validationReason: "custom_invalid" };
  }

  return issue;
}

export function enrichValidationIssuesWithSource(
  issues: readonly ZodIssue[],
  source: Record<string, unknown>,
): StructuredValidationIssue[] {
  return issues.map((issue) => enrichValidationIssueWithSource(issue, source));
}

function mapZodIssueToValidationDetail(
  issue: StructuredValidationIssue,
  fieldKeys: ValidationFieldErrorKeys,
): string {
  const baseKey = getBaseValidationKey(issue, fieldKeys);

  if (baseKey === FALLBACK_VALIDATION_DETAIL) {
    return FALLBACK_VALIDATION_DETAIL;
  }

  switch (issue.code) {
    case "too_small":
      return isRequiredMinimum(issue) || isBlankRequiredIssue(issue)
        ? `${baseKey}.required`
        : `${baseKey}.tooShort`;
    case "too_big":
      return `${baseKey}.tooLong`;
    case "invalid_type":
      return isMissingRequiredIssue(issue) || isBlankRequiredIssue(issue)
        ? `${baseKey}.required`
        : `${baseKey}.invalid`;
    case "custom":
      return issue.validationReason === "custom_required"
        ? `${baseKey}.required`
        : `${baseKey}.invalid`;
    default:
      return `${baseKey}.invalid`;
  }
}

export function mapZodIssuesToValidationDetails(
  issues: readonly ZodIssue[],
  fieldKeys: ValidationFieldErrorKeys,
  source: Record<string, unknown> = {},
): string[] {
  const structuredIssues = enrichValidationIssuesWithSource(issues, source);
  const details = Array.from(
    new Set(
      structuredIssues.map((issue) =>
        mapZodIssueToValidationDetail(issue, fieldKeys),
      ),
    ),
  );

  return details.filter((detail) => {
    if (!detail.endsWith(".invalid")) return true;
    const baseKey = detail.slice(0, -".invalid".length);
    return !details.includes(`${baseKey}.required`);
  });
}
