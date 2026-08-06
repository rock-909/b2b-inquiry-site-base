import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

const SHARED_STATIC_MDX_ROUTE_SOURCES = [
  {
    routeOwner: "src/app/[locale]/about/page.tsx",
    source: readFileSync("src/app/[locale]/about/page.tsx", "utf8"),
  },
  {
    routeOwner: "src/app/[locale]/oem-wholesale/page.tsx",
    source: readFileSync("src/app/[locale]/oem-wholesale/page.tsx", "utf8"),
  },
  {
    routeOwner:
      "src/app/[locale]/guides/flood-barrier-materials-guide/page.tsx",
    source: readFileSync(
      "src/app/[locale]/guides/flood-barrier-materials-guide/page.tsx",
      "utf8",
    ),
  },
  {
    routeOwner: "src/app/[locale]/guides/flood-barrier-specifications/page.tsx",
    source: readFileSync(
      "src/app/[locale]/guides/flood-barrier-specifications/page.tsx",
      "utf8",
    ),
  },
  {
    routeOwner: "src/app/[locale]/warranty/page.tsx",
    source: readFileSync("src/app/[locale]/warranty/page.tsx", "utf8"),
  },
] as const;

const LEGAL_ROUTE_SOURCES = [
  {
    routeOwner: "src/app/[locale]/privacy/page.tsx",
    source: readFileSync("src/app/[locale]/privacy/page.tsx", "utf8"),
  },
  {
    routeOwner: "src/app/[locale]/terms/page.tsx",
    source: readFileSync("src/app/[locale]/terms/page.tsx", "utf8"),
  },
] as const;

// 这些用例守的是"当前路由长什么样"，不守"过去删过什么"。断言某个已删文件继续
// 不存在属于 CLAUDE.md Gate Discipline 明令禁止的负空间门禁：git 已经记录了删除，
// 门禁只会在将来有人正当地新增同名路由时误伤。
describe("Cache Components page boundaries", () => {
  it("keeps target MDX pages routed through the shared static page shell", () => {
    for (const { routeOwner, source } of SHARED_STATIC_MDX_ROUTE_SOURCES) {
      expect(source, routeOwner).toContain("generateStaticMdxPageMetadata");
      expect(source, routeOwner).toContain("StaticMdxPage");
    }
  });

  // Deliberately no assertion about Suspense here. Whether these pages defer
  // their body is a question about the rendered document, and grepping source
  // text answers it badly: the string also matches a comment, and it would
  // reject a future boundary that is actually justified. The rendered truth —
  // body present, once, inside <main>, with scripting disabled — is asserted
  // by expectBodyRenderedOnce() in tests/e2e/no-js-html-contract.spec.ts,
  // which covers /privacy and /terms.
  it("keeps specialized legal pages on their own shell", () => {
    for (const { routeOwner, source } of LEGAL_ROUTE_SOURCES) {
      expect(source, routeOwner).toContain("LegalPageShell");
    }
  });
});
