/**
 * Shared success-shape decode for the lead APIs.
 *
 * Production lead writes through `/api/inquiry` return the same success envelope
 * (`{ success: true, data: { referenceId } }`). This is the single place that
 * reads the public reference id. Each form keeps its own *error* mapping layer;
 * only the shared success shape lives here.
 */
export function readLeadReferenceId(
  ok: boolean,
  payload: unknown,
): string | null {
  if (!ok || typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as {
    success?: unknown;
    data?: { referenceId?: unknown } | null;
  };

  if (
    candidate.success === true &&
    typeof candidate.data?.referenceId === "string"
  ) {
    return candidate.data.referenceId;
  }

  return null;
}
