import { describe, expect, it } from "vitest";

describe("offerings", () => {
  it("exposes only canonical offerings and lookup helpers", async () => {
    const offeringsModule = await import("@/config/offerings").catch(
      (error: unknown) => ({ error }),
    );

    expect("error" in offeringsModule).toBe(false);
    if ("error" in offeringsModule) return;

    expect(Object.keys(offeringsModule).sort()).toEqual([
      "OFFERINGS",
      "getOfferingById",
      "getOfferingPath",
    ]);
    const offeringIds = new Set<string>();
    for (const offering of offeringsModule.OFFERINGS) {
      expect(offering).toEqual({
        id: expect.any(String) as string,
        name: expect.any(String) as string,
        summary: expect.any(String) as string,
        description: expect.any(String) as string,
        highlights: expect.any(Array) as string[],
        updatedAt: expect.any(String) as string,
      });
      expect(offering.id.trim()).toBe(offering.id);
      expect(offering.id).toMatch(/^[a-z0-9-]+$/u);
      expect(offering.id).not.toMatch(/(^-|-$|--)/u);
      expect(offering.name.trim()).toBe(offering.name);
      expect(offering.summary.trim()).toBe(offering.summary);
      expect(offering.description.trim()).toBe(offering.description);
      expect(offering.summary).not.toBe("");
      expect(offering.description).not.toBe("");
      expect(offering.highlights.length).toBeGreaterThan(0);
      for (const highlight of offering.highlights) {
        expect(highlight.trim()).toBe(highlight);
        expect(highlight).not.toBe("");
      }
      expect(Number.isNaN(new Date(offering.updatedAt).getTime())).toBe(false);
      expect(offeringIds.has(offering.id)).toBe(false);
      offeringIds.add(offering.id);
      expect(offeringsModule.getOfferingPath(offering.id)).toBe(
        `/products/${offering.id}`,
      );
    }

    const [firstOffering] = offeringsModule.OFFERINGS;
    expect(firstOffering?.id).toBe("sample-offering");
    expect(offeringsModule.getOfferingById("sample-offering")).toBe(
      firstOffering,
    );
    expect(offeringsModule.getOfferingPath("sample-offering")).toBe(
      "/products/sample-offering",
    );

    expect(offeringsModule.getOfferingById("unknown-product")).toBeUndefined();
  });
});
