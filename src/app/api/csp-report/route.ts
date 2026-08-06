import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { createApiErrorResponse } from "@/lib/api/api-response";
import { createCorsPreflightResponse } from "@/lib/api/cors-utils";
import { logger, sanitizeIP, sanitizeLogContext } from "@/lib/logger";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import type { CSPReport } from "@/config/security";
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_ERROR,
  HTTP_NO_CONTENT,
  HTTP_OK,
  HTTP_PAYLOAD_TOO_LARGE,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
} from "@/constants";

const MAX_CSP_REPORT_BODY_BYTES = 16 * 1024; // 16 KB — CSP reports should be tiny; prevents body-based DoS
const MAX_CSP_REPORTS_PER_BATCH = 20;
const MAX_SCRIPT_SAMPLE_LENGTH = 200;
const MAX_CSP_LOG_FIELD_LENGTH = 200;
const MAX_CSP_POLICY_LOG_LENGTH = 500;
const MAX_CSP_URL_LOG_LENGTH = 500;

/** Zod schema for CSP report validation (all fields optional per browser behavior) */
const cspReportInnerSchema = z.object({
  "document-uri": z.string().optional(),
  referrer: z.string().optional(),
  "violated-directive": z.string().optional(),
  "effective-directive": z.string().optional(),
  "original-policy": z.string().optional(),
  disposition: z.string().optional(),
  "blocked-uri": z.string().optional(),
  "line-number": z.number().optional(),
  "column-number": z.number().optional(),
  "source-file": z.string().optional(),
  "status-code": z.number().optional(),
  "script-sample": z.string().optional(),
});

/** Legacy `report-uri` envelope: `{ "csp-report": { ... } }`. */
const legacyCspReportSchema = z.object({
  "csp-report": cspReportInnerSchema,
});

/**
 * Modern Reporting API (`report-to` / `Reporting-Endpoints`) body for a
 * `csp-violation` report. Field names are camelCase and differ from the legacy
 * `report-uri` hyphenated shape (e.g. `blockedURL` vs `blocked-uri`).
 */
const reportingApiCspBodySchema = z.object({
  documentURL: z.string().optional(),
  referrer: z.string().optional(),
  violatedDirective: z.string().optional(),
  effectiveDirective: z.string().optional(),
  originalPolicy: z.string().optional(),
  disposition: z.string().optional(),
  blockedURL: z.string().optional(),
  lineNumber: z.number().optional(),
  columnNumber: z.number().optional(),
  sourceFile: z.string().optional(),
  statusCode: z.number().optional(),
  sample: z.string().optional(),
});

/**
 * Modern Reporting API POST body: an array of report objects. Entries stay
 * lenient (best-effort telemetry): unknown `type` values are ignored, not
 * rejected, so the endpoint never errors on non-CSP report types.
 */
const reportingApiEnvelopeSchema = z.array(
  z.object({
    type: z.string().optional(),
    body: z.unknown().optional(),
  }),
);

type CspReportInner = CSPReport["csp-report"];

/**
 * Map a modern Reporting API `csp-violation` body onto the internal legacy
 * representation, dropping absent fields so an empty body normalizes to `{}`.
 */
function normalizeReportingApiCspReport(
  body: z.infer<typeof reportingApiCspBodySchema>,
): CspReportInner {
  const mapped: Record<string, string | number | undefined> = {
    "document-uri": body.documentURL,
    referrer: body.referrer,
    // `violatedDirective` is deprecated in favor of `effectiveDirective`;
    // browsers may send either, so fall back between them.
    "violated-directive": body.violatedDirective ?? body.effectiveDirective,
    "effective-directive": body.effectiveDirective,
    "original-policy": body.originalPolicy,
    disposition: body.disposition,
    "blocked-uri": body.blockedURL,
    "line-number": body.lineNumber,
    "column-number": body.columnNumber,
    "source-file": body.sourceFile,
    "status-code": body.statusCode,
    "script-sample": body.sample,
  };

  return Object.fromEntries(
    Object.entries(mapped).filter(([, value]) => value !== undefined),
  ) as CspReportInner;
}

/**
 * Accept both report shapes and normalize to a list of internal CSP reports.
 * Returns `null` when the payload matches neither shape (caller responds 400).
 */
function extractCspReports(data: unknown): CspReportInner[] | null {
  // Modern Reporting API array shape (report-to / Reporting-Endpoints).
  const reportingApi = reportingApiEnvelopeSchema.safeParse(data);
  if (reportingApi.success) {
    return reportingApi.data.flatMap((entry) => {
      if (entry.type !== "csp-violation") {
        return [];
      }
      const parsedBody = reportingApiCspBodySchema.safeParse(entry.body);
      return parsedBody.success
        ? [normalizeReportingApiCspReport(parsedBody.data)]
        : [];
    });
  }

  // Legacy report-uri envelope shape.
  const legacy = legacyCspReportSchema.safeParse(data);
  if (legacy.success) {
    return [legacy.data["csp-report"] as CspReportInner];
  }

  return null;
}

/**
 * CSP Report endpoint
 *
 * This endpoint receives Content Security Policy violation reports
 * and logs them for security monitoring and debugging.
 */
const isDevIgnored = () =>
  env.NODE_ENV === "development" && !env.CSP_REPORT_URI;
const isContentTypeValid = (ct: string | null) =>
  Boolean(
    ct &&
    // `application/csp-report`: legacy report-uri channel (Chrome/Firefox/Safari).
    // `application/reports+json`: modern Reporting-Endpoints/report-to channel.
    // `application/json`: permissive fallback for manual/test posts.
    (ct.includes("application/csp-report") ||
      ct.includes("application/reports+json") ||
      ct.includes("application/json")),
  );

function sanitizeLoggedText(
  value: string | null | undefined,
  maxLength = MAX_CSP_LOG_FIELD_LENGTH,
): string | null | undefined {
  if (!value) return value;
  return value.replace(/[\r\n\t\u2028\u2029]/gu, " ").slice(0, maxLength);
}

function sanitizeLoggedUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const normalized =
      url.protocol === "http:" || url.protocol === "https:"
        ? `${url.origin}${url.pathname}`
        : `${url.protocol}${url.pathname}`;
    return sanitizeLoggedText(normalized, MAX_CSP_URL_LOG_LENGTH) ?? undefined;
  } catch {
    return (
      sanitizeLoggedText(value.split(/[?#]/u, 1)[0], MAX_CSP_URL_LOG_LENGTH) ??
      undefined
    );
  }
}

function sanitizeScriptSample(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return sanitizeLoggedText(value, MAX_SCRIPT_SAMPLE_LENGTH) ?? undefined;
}

const buildViolationData = (
  request: NextRequest,
  cspReport: CSPReport["csp-report"],
  clientIP: string,
) => ({
  timestamp: new Date().toISOString(),
  documentUri: sanitizeLoggedUrl(cspReport["document-uri"]),
  referrer: sanitizeLoggedUrl(cspReport.referrer),
  violatedDirective: sanitizeLoggedText(cspReport["violated-directive"]),
  effectiveDirective: sanitizeLoggedText(cspReport["effective-directive"]),
  originalPolicy: sanitizeLoggedText(
    cspReport["original-policy"],
    MAX_CSP_POLICY_LOG_LENGTH,
  ),
  blockedUri: sanitizeLoggedUrl(cspReport["blocked-uri"]),
  lineNumber: cspReport["line-number"],
  columnNumber: cspReport["column-number"],
  sourceFile: sanitizeLoggedUrl(cspReport["source-file"]),
  statusCode: cspReport["status-code"],
  scriptSample: sanitizeScriptSample(cspReport["script-sample"]),
  disposition: sanitizeLoggedText(cspReport.disposition),
  userAgent: sanitizeLoggedText(request.headers.get("user-agent")),
  ip: clientIP,
});
const isSuspiciousReport = (csp: CSPReport["csp-report"]) => {
  const patterns = [
    "eval",
    "data:text/html",
    "vbscript:",
    "onload",
    "onerror",
    "onclick",
  ];
  const blocked = csp["blocked-uri"]?.toLowerCase() || "";
  const sample = csp["script-sample"]?.toLowerCase() || "";
  return patterns.some((p) => blocked.includes(p) || sample.includes(p));
};

async function parseAndValidateCSPReports(
  request: NextRequest,
): Promise<CspReportInner[] | NextResponse> {
  const parsedBody = await safeParseJson<unknown>(request, {
    route: "/api/csp-report",
    maxBytes: MAX_CSP_REPORT_BODY_BYTES,
    emptyBodyErrorCode: API_ERROR_CODES.INVALID_REQUEST,
    // Accept the Reporting API report-to batch, which POSTs a top-level array.
    allowTopLevelArray: true,
  });
  if (!parsedBody.ok) {
    return createApiErrorResponse(parsedBody.errorCode, parsedBody.statusCode);
  }

  if (
    Array.isArray(parsedBody.data) &&
    parsedBody.data.length > MAX_CSP_REPORTS_PER_BATCH
  ) {
    return createApiErrorResponse(
      API_ERROR_CODES.PAYLOAD_TOO_LARGE,
      HTTP_PAYLOAD_TOO_LARGE,
    );
  }

  const reports = extractCspReports(parsedBody.data);
  if (reports === null) {
    return createApiErrorResponse(
      API_ERROR_CODES.INVALID_REQUEST,
      HTTP_BAD_REQUEST,
    );
  }

  // Drop empty reports (legacy browser quirk, empty report-to batch, or an
  // ignored non-violation report type) — acknowledge with 204 No Content.
  const violations = reports.filter((report) => Object.keys(report).length > 0);
  if (violations.length === 0) {
    logger.warn(
      "Empty CSP report batch (browser quirk, empty report-to batch, or ignored report type)",
    );
    return new NextResponse(null, { status: HTTP_NO_CONTENT });
  }

  return violations;
}

function logCSPViolation(
  request: NextRequest,
  cspReport: CSPReport["csp-report"],
  clientIP: string,
): void {
  const violationData = buildViolationData(request, cspReport, clientIP);
  const logContext = sanitizeLogContext({
    ...violationData,
    // normalize before sanitization to avoid leaking multi-hop proxy chains
    ip: sanitizeIP(String(violationData.ip ?? "unknown")),
  });

  if (isSuspiciousReport(cspReport)) {
    logger.error("SUSPICIOUS CSP VIOLATION DETECTED", logContext);
    return;
  }

  logger.warn("CSP Violation Report", logContext);
}

async function processReport(
  request: NextRequest,
  clientIP: string,
): Promise<NextResponse> {
  const contentType = request.headers.get("content-type");
  if (!isContentTypeValid(contentType)) {
    return createApiErrorResponse(
      API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      HTTP_UNSUPPORTED_MEDIA_TYPE,
    );
  }

  const reports = await parseAndValidateCSPReports(request);
  if (reports instanceof NextResponse) {
    return reports;
  }

  for (const cspReport of reports) {
    logCSPViolation(request, cspReport, clientIP);
  }

  return NextResponse.json(
    { status: "received", timestamp: new Date().toISOString() },
    { status: HTTP_OK },
  );
}

const POST_RATE_LIMITED = withRateLimit(
  "csp",
  async (request: NextRequest, { clientIP }: RateLimitContext) => {
    try {
      return await processReport(request, clientIP);
    } catch (error) {
      logger.error("Error processing CSP report:", error as unknown);
      return createApiErrorResponse(
        API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        HTTP_INTERNAL_ERROR,
      );
    }
  },
);

export function POST(request: NextRequest) {
  if (isDevIgnored()) {
    return NextResponse.json({ status: "ignored" }, { status: HTTP_OK });
  }

  return POST_RATE_LIMITED(request);
}

/**
 * Handle GET requests (for health checks)
 */
export function GET() {
  return NextResponse.json(
    {
      status: "CSP report endpoint active",
      timestamp: new Date().toISOString(),
    },
    { status: HTTP_OK },
  );
}

/**
 * Only allow POST and GET methods
 */
export function OPTIONS(request: NextRequest) {
  const response = createCorsPreflightResponse(request, ["GET"]);
  response.headers.set("Allow", "POST, GET, OPTIONS");
  return response;
}
