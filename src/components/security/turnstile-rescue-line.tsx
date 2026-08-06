// Kept literal so this client boundary does not pull in server env resolution.
// The production gate rejects this reference address until a business replaces it.
const TURNSTILE_RESCUE_EMAIL = "sales@example.invalid";

export interface TurnstileRescueLineProps {
  beforeEmail: string;
  afterEmail: string;
  subject: string;
}

/**
 * The whole site funnels into one submit button; when verification is down,
 * the failure state must still offer a working channel instead of a dead end.
 */
export function TurnstileRescueLine({
  beforeEmail,
  afterEmail,
  subject,
}: TurnstileRescueLineProps) {
  return (
    <p className="mt-1 text-sm leading-6 text-muted-foreground">
      {beforeEmail}{" "}
      <a
        className="font-medium text-[var(--primary-text)] underline underline-offset-4 hover:no-underline"
        href={`mailto:${TURNSTILE_RESCUE_EMAIL}?subject=${encodeURIComponent(subject)}`}
      >
        {TURNSTILE_RESCUE_EMAIL}
      </a>
      . {afterEmail}
    </p>
  );
}
