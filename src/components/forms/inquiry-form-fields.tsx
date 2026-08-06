import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";

const FIELD_CLASS = "min-w-0 space-y-2";
const LABEL_CLASS = "block text-sm leading-none font-medium text-foreground";
const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--shadow-xs)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const HINT_CLASS = "text-xs leading-5 text-muted-foreground";
const ERROR_CLASS = "text-xs leading-5 text-[var(--error-foreground)]";
const REQUIRED_CLASS =
  "after:ml-0.5 after:text-destructive after:content-['*']";

const FIELD_ERROR_CODES = {
  fullName: [
    "errors.fullName.required",
    "errors.fullName.invalid",
    "errors.fullName.tooLong",
  ],
  email: [
    "errors.email.required",
    "errors.email.invalid",
    "errors.email.tooLong",
  ],
  message: ["errors.message.invalid", "errors.message.tooLong"],
} as const;

type VisibleField = keyof typeof FIELD_ERROR_CODES;

function resolveFieldError(
  field: VisibleField,
  fieldDetails: readonly string[] | undefined,
  copy: InquiryFormCopy,
): string | null {
  if (!fieldDetails?.length) {
    return null;
  }

  const codes = FIELD_ERROR_CODES[field];
  const codeSet = new Set<string>(codes as readonly string[]);
  const matchedCode = fieldDetails.find((detail) => codeSet.has(detail));

  if (!matchedCode) {
    return null;
  }

  const leaf = matchedCode.split(".").slice(2).join(".");
  const fieldErrors = copy.errors[field] as Record<string, string>;
  return fieldErrors[leaf] ?? null;
}

export function InquiryBuyerInterestContext({
  buyerInterest,
  copy,
}: {
  buyerInterest: string;
  copy: InquiryFormCopy;
}) {
  return (
    <p
      className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground"
      data-testid="inquiry-buyer-interest-context"
    >
      <span className="font-medium text-foreground">{copy.contextLabel}: </span>
      <span translate="no">{buyerInterest}</span>
    </p>
  );
}

export function InquiryFormFields({
  copy,
  fieldDetails,
  initialMessage,
  messageMaxLength,
}: {
  copy: InquiryFormCopy;
  fieldDetails?: readonly string[];
  initialMessage?: string;
  messageMaxLength: number;
}) {
  const messageHintId = "inquiry-message-hint";
  const fullNameError = resolveFieldError("fullName", fieldDetails, copy);
  const emailError = resolveFieldError("email", fieldDetails, copy);
  const messageError = resolveFieldError("message", fieldDetails, copy);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={FIELD_CLASS}>
          <label
            className={`${LABEL_CLASS} ${REQUIRED_CLASS}`}
            htmlFor="inquiry-fullName"
          >
            {copy.fullName}
          </label>
          <input
            aria-describedby={
              fullNameError ? "inquiry-full-name-error" : undefined
            }
            aria-invalid={fullNameError ? true : undefined}
            autoComplete="name"
            className={INPUT_CLASS}
            id="inquiry-fullName"
            name="fullName"
            required
            type="text"
          />
          {fullNameError ? (
            <p className={ERROR_CLASS} id="inquiry-full-name-error">
              {fullNameError}
            </p>
          ) : null}
        </div>
        <div className={FIELD_CLASS}>
          <label
            className={`${LABEL_CLASS} ${REQUIRED_CLASS}`}
            htmlFor="inquiry-email"
          >
            {copy.email}
          </label>
          <input
            aria-describedby={emailError ? "inquiry-email-error" : undefined}
            aria-invalid={emailError ? true : undefined}
            autoComplete="email"
            className={INPUT_CLASS}
            id="inquiry-email"
            inputMode="email"
            name="email"
            required
            type="email"
          />
          {emailError ? (
            <p className={ERROR_CLASS} id="inquiry-email-error">
              {emailError}
            </p>
          ) : null}
        </div>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS} htmlFor="inquiry-message">
          {copy.message}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({copy.optional})
          </span>
        </label>
        <textarea
          aria-describedby={
            messageError
              ? `${messageHintId} inquiry-message-error`
              : messageHintId
          }
          aria-invalid={messageError ? true : undefined}
          className={`${INPUT_CLASS} min-h-32 resize-y leading-6`}
          defaultValue={initialMessage}
          id="inquiry-message"
          key={initialMessage ?? "empty-message"}
          maxLength={messageMaxLength}
          name="message"
          rows={5}
        />
        <p className={HINT_CLASS} id={messageHintId}>
          {copy.messageHint}
        </p>
        {messageError ? (
          <p className={ERROR_CLASS} id="inquiry-message-error">
            {messageError}
          </p>
        ) : null}
      </div>

      <input
        aria-hidden="true"
        autoComplete="off"
        className="sr-only"
        id="website"
        name="website"
        tabIndex={-1}
        type="text"
      />
    </>
  );
}
