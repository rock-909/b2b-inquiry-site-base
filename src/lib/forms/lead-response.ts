/**
 * Shared success-shape decode for the lead APIs.
 *
 * Production lead writes through `/api/inquiry` return the same success envelope
 * (`{ success: true, data: { referenceId } }`). The two form decoders used to
 * re-implement this check independently and drifted; this is the single place
 * that reads the public reference id. Each form keeps its own *error* mapping
 * (contact preserves `errorCode`/`details`; the RFQ collapses to a generic
 * message), so only the shared success shape lives here.
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
