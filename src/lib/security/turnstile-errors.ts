const TURNSTILE_SERVICE_FAILURE_CODES = new Set([
  "not-configured",
  "network-error",
  "timeout",
  // Cloudflare siteverify returns `internal-error` for a retryable server-side
  // fault. Treating it as a service failure (503) avoids rejecting a genuine
  // buyer's lead with a 400 when the fault is on Cloudflare's side.
  "internal-error",
]);

export function isTurnstileServiceFailureCode(code: string): boolean {
  return TURNSTILE_SERVICE_FAILURE_CODES.has(code);
}

export function hasTurnstileServiceFailure(codes: readonly string[]): boolean {
  return codes.some(isTurnstileServiceFailureCode);
}
