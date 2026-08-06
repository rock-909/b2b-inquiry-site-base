import { describe, expect, it, vi } from "vitest";

import { resolveAirtableModule } from "@/lib/airtable/service-internal/client";

describe("resolveAirtableModule", () => {
  it("accepts Airtable's function-shaped default export", () => {
    const configure = vi.fn();
    const base = vi.fn();
    const airtableDefault = Object.assign(() => undefined, {
      configure,
      base,
    });

    const resolved = resolveAirtableModule({ default: airtableDefault });

    expect(resolved?.configure).toBe(configure);
    expect(resolved?.base).toBe(base);
  });
});
