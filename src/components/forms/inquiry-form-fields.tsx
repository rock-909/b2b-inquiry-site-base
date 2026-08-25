import {
  INQUIRY_FIELD_WIRE_DETAIL_LEAVES,
  type InquiryErrorField,
} from "@/constants/inquiry-field-error-protocol";
import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";

const FIELD_CLASS = "min-w-0 space-y-2";
const LABEL_CLASS = "block text-sm leading-none font-medium text-foreground";
const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--control-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const HINT_CLASS = "text-xs leading-5 text-muted-foreground";
const ERROR_CLASS = "text-xs leading-5 text-[var(--error-foreground)]";
const REQUIRED_CLASS =
  "after:ml-0.5 after:text-destructive after:content-['*']";

const FIELD_ERROR_LEAVES = INQUIRY_FIELD_WIRE_DETAIL_LEAVES;

type VisibleField = InquiryErrorField;

function resolveFieldError<Field extends VisibleField>(
  field: Field,
  fieldDetails: readonly string[] | undefined,
  copy: InquiryFormCopy,
): string | null {
  if (!fieldDetails?.length) {
    return null;
  }

  // 精确查找表替代字符串拆解与 copy 断言：leaf 与文案 key 全部由协议类型封口。
  const leafByDetail: Record<string, string | undefined> =
    FIELD_ERROR_LEAVES[field];

  for (const detail of fieldDetails) {
    const leaf = leafByDetail[detail];
    if (leaf !== undefined) {
      // 查找表只含该 field 协议内 leaf，copy 完整性由 InquiryFieldErrorCopyMap 合同封口。
      const fieldCopy: Record<string, string | undefined> = copy.errors[field];
      return fieldCopy[leaf] ?? null;
    }
  }

  return null;
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
          {...(initialMessage ? { defaultValue: initialMessage } : {})}
          id="inquiry-message"
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
