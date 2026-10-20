import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { getTranslations } from "next-intl/server";
import { createJsonLdGraphData } from "@/components/seo/json-ld-graph-data";
import {
  JsonLdGraphScript,
  JsonLdScript,
} from "@/components/seo/json-ld-script";

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
    // 身份节点在前、页面节点在后；站点填了公司信息时身份节点还会多出 Organization。
    const types = graphTypes(graphData);
    expect(types.at(-1)).toBe("FAQPage");
    expect(types).toContain("WebSite");
    expect(["Organization", "WebSite"]).toEqual(
      expect.arrayContaining(types.slice(0, -1)),
    );
    expect(graphData["@graph"].some((node) => "@context" in node)).toBe(false);
  });

  it("treats identity schema failures as a non-critical enhancement", async () => {
    vi.mocked(getTranslations).mockRejectedValueOnce(new Error("boom"));

    await expect(
      JsonLdGraphScript({ locale: "en", data: [] }),
    ).resolves.toBeNull();
  });
});
