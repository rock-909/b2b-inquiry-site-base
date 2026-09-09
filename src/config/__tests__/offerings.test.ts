import { describe, expect, it } from "vitest";

describe("offerings", () => {
  it("exposes only canonical offerings and lookup helpers", async () => {
    const offeringsModule = await import("@/config/offerings").catch(
      (error: unknown) => ({ error }),
    );

    expect("error" in offeringsModule).toBe(false);
    if ("error" in offeringsModule) return;

    const offeringIds = new Set<string>();
    for (const offering of offeringsModule.OFFERINGS) {
      expect(offering).toMatchObject({
        id: expect.any(String) as string,
        name: expect.any(String) as string,
        summary: expect.any(String) as string,
        description: expect.any(String) as string,
        applications: expect.any(Array) as string[],
        specifications: expect.any(Array) as Array<{
          label: string;
          value: string;
        }>,
        materials: expect.any(Array) as string[],
        configuration: expect.any(Array) as string[],
        delivery: expect.any(Array) as string[],
        evidence: expect.any(Array) as string[],
        updatedAt: expect.any(String) as string,
        translations: expect.objectContaining({ es: expect.any(Object) }),
      });
      expect(offering.id.trim()).toBe(offering.id);
      expect(offering.id).toMatch(/^[a-z0-9-]+$/u);
      expect(offering.id).not.toMatch(/(^-|-$|--)/u);
      expect(offering.name.trim()).toBe(offering.name);
      expect(offering.summary.trim()).toBe(offering.summary);
      expect(offering.description.trim()).toBe(offering.description);
      expect(offering.summary).not.toBe("");
      expect(offering.description).not.toBe("");
      for (const items of [
        offering.applications,
        offering.materials,
        offering.configuration,
        offering.delivery,
        offering.evidence,
      ]) {
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.trim()).toBe(item);
          expect(item).not.toBe("");
        }
      }
      expect(offering.specifications.length).toBeGreaterThan(0);
      for (const specification of offering.specifications) {
        expect(specification.label.trim()).toBe(specification.label);
        expect(specification.label).not.toBe("");
        expect(specification.value.trim()).toBe(specification.value);
        expect(specification.value).not.toBe("");
      }
      expect(Number.isNaN(new Date(offering.updatedAt).getTime())).toBe(false);
      expect(offeringIds.has(offering.id)).toBe(false);
      offeringIds.add(offering.id);
      expect(offeringsModule.getOfferingPath(offering.id)).toBe(
        `/products/${offering.id}`,
      );
    }

    const [firstOffering] = offeringsModule.OFFERINGS;
    expect(firstOffering).toBeDefined();
    expect(offeringsModule.getOfferingById(firstOffering!.id)).toBe(
      firstOffering,
    );
    expect(offeringsModule.getOfferingPath(firstOffering!.id)).toBe(
      `/products/${firstOffering!.id}`,
    );

    expect(offeringsModule.getOfferingById("unknown-product")).toBeUndefined();

    const spanish = offeringsModule.getOfferingForLocale(
      firstOffering!.id,
      "es",
    );
    expect(spanish.name).toBe(firstOffering!.translations.es.name);
    expect(spanish.summary).toBe(firstOffering!.translations.es.summary);
    expect(offeringsModule.getOfferingsForLocale("es")[0]?.name).toBe(
      spanish.name,
    );
  });
});
