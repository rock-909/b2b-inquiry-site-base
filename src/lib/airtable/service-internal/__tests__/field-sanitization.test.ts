import { describe, expect, it } from "vitest";
import { sanitizeAirtableTextField } from "@/lib/airtable/service-internal/field-sanitization";

describe("sanitizeAirtableTextField", () => {
  it("reuses the shared spreadsheet formula prefix truth", () => {
    expect(sanitizeAirtableTextField("-Acme")).toBe("'-Acme");
    expect(sanitizeAirtableTextField("+SUM(1,1)")).toBe("'+SUM(1,1)");
  });
});
