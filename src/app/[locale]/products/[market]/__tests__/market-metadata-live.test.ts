import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import { getProductMarketPath } from "@/config/paths/utils";
import { shouldIndexPublicPage } from "@/config/single-site-seo";

describe("market metadata live integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const expectedProductMetadata = [
    [
      "abs-flood-barriers",
      "ABS Interlocking Flood Barriers — Freestanding Boxwall",
      "Freestanding ABS interlocking flood barriers, factory-direct from China. 50–85 cm heights; straight, curve and gable-end units. Reply within 12 hours.",
    ],
    [
      "aluminum-flood-gates",
      "Aluminum Flood Gates for Doors & Garages — Custom-Cut",
      "Demountable aluminum flood gates (flood boards): 6063-T6 planks, EPDM seals, custom-cut to your openings — doors, garages, loading docks. Reply within 12 hours.",
    ],
    [
      "absorbent-flood-bags",
      "Sandless Sandbags & Water-Activated Flood Bags — Wholesale",
      "Water-activated absorbent flood bags factory-direct: 0.23 kg flat, 20 kg in 3–4 minutes, 3-year shelf life. Carton to pallet, private label. Fresh water only.",
    ],
    [
      "flood-tube-dams",
      "Water & Air-Filled Tube Dams — Flood Barriers for Long Runs",
      "Inflatable PVC tube dams factory-direct: 1 m height, 5–10 m sections, deploy on grass and mud where rigid barriers can't seal. Kit included. Reply within 12 hours.",
    ],
    [
      "frp-flood-barriers",
      "FRP Composite Flood Barrier Planks — Corrosion-Free",
      "Pultruded FRP composite flood planks: corrosion-free, non-conductive, built for coastal and industrial sites. Order-driven production — register interest.",
    ],
  ] as const;

  it("indexes current catalog product markets in the public SEO profile", async () => {
    vi.stubEnv("APP_ENV", "production");

    const path = getProductMarketPath("abs-flood-barriers");

    expect(shouldIndexPublicPage("products", path)).toBe(true);

    const metadata = generateMetadataForPath({
      locale: "en",
      pageType: "products",
      path,
      config: {
        title: "test",
        description: "test",
      },
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("page generateMetadata matches path-aware helper", async () => {
    vi.stubEnv("APP_ENV", "production");

    const { generateMetadata } = await import("../page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en", market: "abs-flood-barriers" }),
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      modifiedTime: "2026-07-05T00:00:00Z",
    });
  });

  it.each(expectedProductMetadata)(
    "uses owner-approved source meta for %s",
    async (market, title, description) => {
      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({
        params: Promise.resolve({ locale: "en", market }),
      });

      expect(metadata.title).toBe(title);
      expect(metadata.description).toBe(description);
    },
  );
});
