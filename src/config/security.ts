import {
  getRuntimeAppEnv,
  getRuntimeEnvBoolean,
  getRuntimeEnvString,
  isRuntimeDevelopment,
  isRuntimeProduction,
} from "../lib/env";

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Named endpoint for the modern Reporting API (`Reporting-Endpoints` header +
 * CSP `report-to` directive). Runs in parallel with the legacy `report-uri`
 * directive, which stays for Firefox/Safari compatibility.
 */
const CSP_REPORT_TO_ENDPOINT = "csp-endpoint";

/**
 * Resolve the CSP report destination. Env override wins; otherwise the built-in
 * `/api/csp-report` route handles reports.
 */
function resolveCspReportUri(): string {
  const configured = getRuntimeEnvString("CSP_REPORT_URI")?.trim();
  return configured && configured.length > 0 ? configured : "/api/csp-report";
}

/**
 * Security configuration for the application
 * Includes CSP, security headers, and other security-related settings
 */

/**
 * Content Security Policy configuration
 *
 * Boundary: NEXT_PUBLIC_SECURITY_MODE=strict means enforced security headers
 * with a static-compatible CSP for the current site deployment. It is not
 * nonce-level strict CSP. A nonce-level policy needs dynamic rendering and a
 * proxy-generated nonce, which is intentionally outside this deployment boundary.
 */
export function generateCSP(): string {
  const isDevelopment = isRuntimeDevelopment();
  const isProduction = isRuntimeProduction();
  const reportUri = resolveCspReportUri();

  // Base CSP directives
  const cspDirectives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      ...(isDevelopment
        ? ["'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"]
        : []),
      // Cloudflare Turnstile
      "https://challenges.cloudflare.com",
      // Google Analytics (if enabled)
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ],
    // Static App Router/RSC emits inline bootstrap script elements. A strict
    // no-inline script-element policy needs nonce/proxy dynamic rendering, which
    // is intentionally outside this site's static-compatible deployment boundary.
    "script-src-elem": [
      "'self'",
      ...(isDevelopment
        ? ["'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"]
        : ["'unsafe-inline'"]),
      "https://challenges.cloudflare.com",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ],
    "script-src-attr": ["'none'"],
    "style-src": [
      "'self'",
      // Static CSP intentionally keeps inline style allowances for framework
      // and runtime style attributes until a dedicated dynamic nonce plan exists.
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ],
    // Static CSP intentionally keeps inline style element allowances for
    // framework/runtime style tags that cannot be reliably statically hashed.
    "style-src-elem": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ],
    // Static CSP intentionally keeps style attributes allowed for framework and
    // runtime-rendered style attributes used by server/client components.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      // Google Analytics
      "https://www.google-analytics.com",
      "https://www.googletagmanager.com",
    ],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      // API endpoints
      ...(isDevelopment ? ["http://localhost:*", "ws://localhost:*"] : []),
      // Google Analytics
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://region1.google-analytics.com",
    ],
    "frame-src": [
      // Cloudflare Turnstile (removed 'none' - conflicts with allowlist)
      "https://challenges.cloudflare.com",
    ],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    // Legacy reporting channel (Firefox/Safari). Kept alongside `report-to`.
    "report-uri": [reportUri],
    // Modern Reporting API channel; endpoint URL is published via the
    // `Reporting-Endpoints` response header in getSecurityHeaders().
    "report-to": [CSP_REPORT_TO_ENDPOINT],
    "upgrade-insecure-requests": isProduction ? [] : undefined,
  };

  // Convert directives to CSP string
  return Object.entries(cspDirectives)
    .flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      if (Array.isArray(value) && value.length > 0) {
        return [`${key} ${value.join(" ")}`];
      }

      return [key];
    })
    .join("; ");
}

/**
 * Security headers configuration
 */
function isProductionDeployment(): boolean {
  const appEnv = getRuntimeAppEnv();
  return appEnv === "production" || (!appEnv && isRuntimeProduction());
}

function isSecurityHeadersEnabled(): boolean {
  return (
    isProductionDeployment() ||
    getRuntimeEnvBoolean("SECURITY_HEADERS_ENABLED") !== false
  );
}

export function getSecurityHeaders(): SecurityHeader[] {
  if (!isSecurityHeadersEnabled()) {
    return [];
  }

  const cspReportOnly = isCspReportOnly();
  const cspHeaderKey = cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  return [
    // Prevent clickjacking
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    // Prevent MIME type sniffing
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    // Referrer policy
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    // HSTS (HTTP Strict Transport Security)
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    // Content Security Policy (enforced or report-only based on security mode)
    {
      key: cspHeaderKey,
      value: generateCSP(),
    },
    // Modern Reporting API endpoint map. Binds the CSP `report-to` endpoint
    // name to the report URL. Kept in sync with the `report-to` directive.
    {
      key: "Reporting-Endpoints",
      value: `${CSP_REPORT_TO_ENDPOINT}="${resolveCspReportUri()}"`,
    },
    // Permissions Policy (formerly Feature Policy)
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "interest-cohort=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
    // Cross-Origin policies
    {
      key: "Cross-Origin-Embedder-Policy",
      value: "unsafe-none", // Changed from require-corp for compatibility
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "cross-origin",
    },
  ];
}

/**
 * Security mode configuration
 *
 * `strict` (default) enforces CSP via `Content-Security-Policy`.
 * `relaxed` emits the same policy as report-only for staging diagnosis.
 */
function isCspReportOnly(): boolean {
  if (isProductionDeployment()) return false;

  const mode = getRuntimeEnvString("NEXT_PUBLIC_SECURITY_MODE") || "strict";
  return mode === "relaxed";
}

/**
 * Legacy CSP report payload shape for `/api/csp-report`.
 */
export interface CSPReport {
  "csp-report": {
    "document-uri": string;
    referrer: string;
    "violated-directive": string;
    "effective-directive": string;
    "original-policy": string;
    disposition: string;
    "blocked-uri": string;
    "line-number": number;
    "column-number": number;
    "source-file": string;
    "status-code": number;
    "script-sample": string;
  };
}
