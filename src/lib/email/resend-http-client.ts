export interface ResendEmailTag {
  name: string;
  value: string;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  tags: ResendEmailTag[];
}

export interface ResendEmailSendResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

export interface ResendHttpEmailClientOptions {
  readonly timeoutMs?: number;
}

type JsonObject = Record<string, unknown>;

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";
/** 导出是为了让客户端提交预算的测试能跟它对账，而不是手抄一个数。 */
export const DEFAULT_RESEND_TIMEOUT_MS = 5000;
const RESEND_TIMEOUT_ERROR_MESSAGE = "Resend API request timed out";

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(payload: unknown, status: number): string {
  if (isJsonObject(payload)) {
    const { error, message } = payload;
    if (isJsonObject(error) && typeof error.message === "string") {
      return error.message;
    }
    if (typeof message === "string") return message;
  }

  return `Resend API request failed with status ${status}`;
}

function getSuccessData(payload: unknown): { id: string } | null {
  if (!isJsonObject(payload) || typeof payload.id !== "string") return null;

  const id = payload.id.trim();
  return id.length > 0 ? { id } : null;
}

function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;

  return (error as { name?: unknown }).name === "AbortError";
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export class ResendHttpEmailClient {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly options: ResendHttpEmailClientOptions;

  constructor(
    apiKey: string,
    fetchFn: typeof fetch = fetch,
    options: ResendHttpEmailClientOptions = {},
  ) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
    this.options = options;
  }

  async send(payload: ResendEmailPayload): Promise<ResendEmailSendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_RESEND_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await this.fetchFn(RESEND_EMAILS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: payload.from,
          to: payload.to,
          reply_to: payload.replyTo,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          tags: payload.tags,
        }),
        signal: controller.signal,
      });

      const responsePayload = await parseJsonResponse(response);

      if (!response.ok) {
        return {
          data: null,
          error: { message: getErrorMessage(responsePayload, response.status) },
        };
      }

      const data = getSuccessData(responsePayload);
      if (!data) {
        return {
          data: null,
          error: {
            message: "Resend success response is missing a message id",
          },
        };
      }

      return { data, error: null };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          data: null,
          error: { message: RESEND_TIMEOUT_ERROR_MESSAGE },
        };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
