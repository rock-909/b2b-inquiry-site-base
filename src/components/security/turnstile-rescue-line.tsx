export interface TurnstileRescueLineProps {
  beforeEmail: string;
  afterEmail: string;
  email: string;
  subject: string;
}

/**
 * The whole site funnels into one submit button; when verification is down,
 * the failure state must still offer a working channel instead of a dead end.
 */
export function TurnstileRescueLine({
  beforeEmail,
  afterEmail,
  email,
  subject,
}: TurnstileRescueLineProps) {
  return (
    <p className="mt-1 text-sm leading-6 text-muted-foreground">
      {beforeEmail}{" "}
      <a
        className="font-medium text-[var(--primary-text)] underline underline-offset-4 hover:no-underline"
        href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
      >
        {email}
      </a>
      . {afterEmail}
    </p>
  );
}
