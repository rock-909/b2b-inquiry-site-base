import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CONTENT_MANIFEST } from "@/lib/content-manifest.generated";

const RUNTIME_FILES = [
  "src/lib/content-manifest.ts",
  "src/lib/content-query/queries.ts",
  "src/lib/content/page-dates.ts",
  "src/lib/content/legal-page.ts",
  "src/app/[locale]/static-mdx-page.tsx",
] as const;

const FORBIDDEN_RUNTIME_IMPORTS = [
  "node:fs",
  "fs",
  "node:path",
  "path",
  "gray-matter",
  "glob",
  "fast-glob",
  "@/lib/content-parser",
  "@/lib/content-utils",
] as const;

function readSource(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local runtime files from the allowlist above
  return readFileSync(relativePath, "utf8");
}

/**
 * Every module this source actually pulls in, whatever syntax it used.
 *
 * Parsed rather than grepped. The first version matched three regexes for
 * `from "…mdx"`, `import("…mdx")` and `require("…mdx")`, which missed the one
 * spelling that needs no `from` at all — `import "./page.mdx"` is a real edge
 * in the module graph — while a `.mdx` path sitting in a comment or an ordinary
 * string turned it red for nothing.
 */
function moduleSpecifiers(source: string): string[] {
  const parsed = ts.createSourceFile(
    "module-graph-probe.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (ts.isCallExpression(node)) {
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      const [first] = node.arguments;

      if (
        (isDynamicImport || isRequire) &&
        first &&
        ts.isStringLiteral(first)
      ) {
        specifiers.push(first.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed);

  return specifiers;
}

/** True when `candidate` really lands inside `root` after normalisation. */
function isInside(root: string, candidate: string): boolean {
  const step = relative(root, candidate);

  return step !== "" && !step.startsWith("..") && !step.startsWith(sep);
}

describe("MDX manifest-only runtime contract", () => {
  it("keeps runtime content loading free of filesystem and parser imports", () => {
    for (const file of RUNTIME_FILES) {
      const source = readSource(file);

      for (const forbidden of FORBIDDEN_RUNTIME_IMPORTS) {
        expect(source).not.toContain(`from "${forbidden}"`);
        expect(source).not.toContain(`from '${forbidden}'`);
        expect(source).not.toContain(`require("${forbidden}")`);
        expect(source).not.toContain(`require('${forbidden}')`);
      }
    }
  });

  it("loads static page bodies through manifest string content and the static markdown renderer", () => {
    expect(readSource("src/lib/content-manifest.ts")).toContain(
      "./content-manifest.generated",
    );
    expect(readSource("src/lib/content-query/queries.ts")).toContain(
      "@/lib/content-manifest",
    );
    expect(readSource("src/lib/content/page-dates.ts")).toContain(
      "@/lib/content-manifest",
    );
    expect(readSource("src/lib/content/legal-page.ts")).toContain(
      "@/lib/content-query/queries",
    );
    expect(readSource("src/lib/content/legal-page.ts")).toContain(
      "render-static-markdown-content",
    );
    expect(readSource("src/app/[locale]/static-mdx-page.tsx")).toContain(
      "loadLegalPage",
    );
    expect(readSource("src/lib/content/render-legal-content.tsx")).toContain(
      "render-static-markdown-content",
    );
  });

  // 这里以前还有一条,断言生成的清单里不出现 `showcase-full/...capabilities.mdx`
  // 和几个退役页的 `@content/...` 路径。那是负空间守卫:锁的是几个已经删掉的名字
  // 保持缺席,永远为真。换成下面两条——一条管导出的每一项,一条管这个文件往
  // 模块图里拉了什么,都不点名任何一个具体的退役页。
  //
  // 路径要归一化之后再判包含。只用 startsWith 的话
  // `/content/../src/test/example.ts` 两个前缀都过，归一化后却指到 content
  // 之外一个真实存在的文件——所有条件全绿,清单已经逃出目录了。
  it("keeps the generated manifest catalog-only", () => {
    expect(CONTENT_MANIFEST.entries.length).toBeGreaterThan(0);

    const contentRoot = join(process.cwd(), "content");
    const offenders = CONTENT_MANIFEST.entries.filter((entry) => {
      const fromFilePath = resolve(process.cwd(), `.${entry.filePath}`);
      const fromRelative = resolve(process.cwd(), entry.relativePath);

      return (
        entry.source !== "active-content" ||
        !isInside(contentRoot, fromFilePath) ||
        !isInside(contentRoot, fromRelative) ||
        fromFilePath !== fromRelative ||
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolved path is proven to sit inside content/ above
        !existsSync(fromFilePath)
      );
    });

    expect(offenders.map((entry) => entry.filePath)).toEqual([]);
  });

  // 检查导出的 entries 还不够:生成器完全可以在 entries 之外多写一个静态 import,
  // 导出的每一项照样干净,而 bundler 已经把那份 MDX 拉进模块图了。整个 manifest
  // 的存在理由就是运行时不碰 MDX——所以这里守的是"这个文件不 import 任何 .mdx",
  // 而不是某几个退役文件名缺席。
  it("pulls no MDX into the module graph", () => {
    const specifiers = moduleSpecifiers(
      readSource("src/lib/content-manifest.generated.ts"),
    );

    expect(specifiers.filter((id) => id.endsWith(".mdx"))).toEqual([]);
  });

  // 上面那条只有在解析器真的看得见每种写法时才成立。这里钉住解析器本身:
  // 副作用 import 没有 `from`,是文本扫描漏掉的那一种;注释和普通字符串里的
  // `.mdx` 不是模块边,不该算。
  it("sees every import spelling, and only imports", () => {
    expect(moduleSpecifiers('import "./page.mdx";')).toEqual(["./page.mdx"]);
    expect(moduleSpecifiers('import page from "./page.mdx";')).toEqual([
      "./page.mdx",
    ]);
    expect(moduleSpecifiers('export * from "./page.mdx";')).toEqual([
      "./page.mdx",
    ]);
    expect(moduleSpecifiers('void import("./page.mdx");')).toEqual([
      "./page.mdx",
    ]);
    expect(moduleSpecifiers('require("./page.mdx");')).toEqual(["./page.mdx"]);

    expect(moduleSpecifiers("// see ./page.mdx for the source")).toEqual([]);
    expect(moduleSpecifiers('const origin = "./page.mdx";')).toEqual([]);
  });
});
