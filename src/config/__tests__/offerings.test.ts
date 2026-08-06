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
    ]);
    const offeringIds = new Set<string>();
    for (const offering of offeringsModule.OFFERINGS) {
      expect(offering).toEqual({
        id: expect.any(String) as string,
        name: expect.any(String) as string,
      });
      expect(offering.id.trim()).toBe(offering.id);
      expect(offering.name.trim()).toBe(offering.name);
      expect(offeringIds.has(offering.id)).toBe(false);
      offeringIds.add(offering.id);
    }

    const [firstOffering] = offeringsModule.OFFERINGS;
    if (firstOffering !== undefined) {
      expect(offeringsModule.getOfferingById(firstOffering.id)).toBe(
        firstOffering,
      );
    }

    expect(offeringsModule.getOfferingById("missing-offering")).toBeUndefined();
  });
});
