import { vi } from "vitest";
import * as pipeline from "@/lib/lead-pipeline/process-lead";

// ruleid: inquiry-integration-no-business-replacement
vi.mock("@/lib/lead-pipeline/process-lead", () => ({}));
// ruleid: inquiry-integration-no-business-replacement
vi.doMock("@/lib/security/turnstile", () => ({}));
// ruleid: inquiry-integration-no-business-replacement
vi.mock(import("@/lib/airtable/service"), () => ({}));
// ruleid: inquiry-integration-no-business-spy
vi.spyOn(pipeline, "processValidatedInquiry");
// ok: inquiry-integration-no-business-replacement
vi.mock("server-only", () => ({}));
// ok: inquiry-integration-no-business-spy
vi.stubGlobal("fetch", vi.fn());
