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
    expect(offeringsModule.OFFERINGS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String) as string,
          name: expect.any(String) as string,
        }),
      ]),
    );
    expect(
      offeringsModule.getOfferingById(offeringsModule.OFFERINGS[0]?.id),
    ).toBe(offeringsModule.OFFERINGS[0]);
    expect(offeringsModule.getOfferingById("missing-offering")).toBeUndefined();
  });
});
