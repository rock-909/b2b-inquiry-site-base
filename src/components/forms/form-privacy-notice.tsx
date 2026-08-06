/**
 * Submit-adjacent privacy statement shared by the buyer lead forms.
 *
 * Owner decision (2026-07): both the contact and request-quote forms express
 * privacy as a short statement next to the submit button, sourced from a
 * translation key — not a consent checkbox. This is presentation only; each
 * form supplies its own already-translated text so the copy stays per-form
 * plumbing while the buyer-visible statement is identical.
 */
export function FormPrivacyNotice({ text }: { text: string }) {
  return (
    <p
      className="text-center text-sm text-muted-foreground"
      data-testid="form-privacy-notice"
    >
      {text}
    </p>
  );
}
