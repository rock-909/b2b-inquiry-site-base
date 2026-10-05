import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { getTranslations } from "next-intl/server";
import { createJsonLdGraphData } from "@/components/seo/json-ld-graph-data";
import {
  JsonLdGraphScript,
  JsonLdScript,
} from "@/components/seo/json-ld-script";
import { generateJSONLD } from "@/lib/structured-data";

function graphTypes(graphData: unknown) {
  if (
    typeof graphData !== "object" ||
    graphData === null ||
    !("@graph" in graphData)
  ) {
    return [];
  }

  const graph = (graphData as { "@graph": unknown })["@graph"];
  if (!Array.isArray(graph)) {
    return [];
  }

  return graph
    .map((node) =>
      typeof node === "object" && node !== null && "@type" in node
        ? (node as { "@type": unknown })["@type"]
        : undefined,
    )
    .filter((type): type is string => typeof type === "string");
}

describe("createJsonLdGraphData", () => {
  it("keeps page-level schema node types in the merged graph", () => {
    const graphData = createJsonLdGraphData([
      {
        "@type": "Organization",
        name: "Reference Industries",
      },
      {
        "@type": "WebSite",
        name: "Reference Industries",
      },
      {
        "@type": "FAQPage",
        mainEntity: [],
      },
    ]);

    expect(graphData["@context"]).toBe("https://schema.org");
    expect(graphTypes(graphData)).toEqual([
      "Organization",
      "WebSite",
      "FAQPage",
    ]);
  });

  it("uses shared JSON-LD escaping for script-injection text", () => {
    const graphData = createJsonLdGraphData([
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: '</script><script>alert("xss")</script>',
          },
        ],
      },
    ]);

    const scriptContent = generateJSONLD(graphData);

    expect(scriptContent).not.toContain("</script>");
    expect(scriptContent).not.toContain("<script>");
    expect(scriptContent).toContain("\\u003c/script\\u003e");
    expect(() => JSON.parse(scriptContent)).not.toThrow();
  });

  it("renders native JSON-LD script with escaped HTML-sensitive text", () => {
    const { container } = render(
      React.createElement(JsonLdScript, {
        data: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: '</script><script>alert("xss")</script>',
        },
      }),
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    if (!script) throw new Error("Expected a JSON-LD script element");
    expect(script.tagName).toBe("SCRIPT");
    expect(script).toHaveAttribute("type", "application/ld+json");
    expect(script.innerHTML).toContain("\\u003c/script\\u003e");
    expect(script.innerHTML).not.toContain("</script>");
    expect(script.innerHTML).not.toContain("<script>");
  });

  it("renders one @context with identity nodes ahead of the page nodes", async () => {
    const { container } = render(
      await JsonLdGraphScript({
        locale: "en",
        data: [{ "@type": "FAQPage", mainEntity: [] }],
      }),
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    if (!script) throw new Error("Expected a JSON-LD script element");
    const graphData = JSON.parse(script.innerHTML) as {
      "@context": string;
      "@graph": Array<Record<string, unknown>>;
    };

    expect(graphData["@context"]).toBe("https://schema.org");
    expect(graphTypes(graphData)).toEqual([
      "Organization",
      "WebSite",
      "FAQPage",
    ]);
    expect(graphData["@graph"].some((node) => "@context" in node)).toBe(false);
  });

  it("treats identity schema failures as a non-critical enhancement", async () => {
    vi.mocked(getTranslations).mockRejectedValueOnce(new Error("boom"));

    await expect(
      JsonLdGraphScript({ locale: "en", data: [] }),
    ).resolves.toBeNull();
  });
});
