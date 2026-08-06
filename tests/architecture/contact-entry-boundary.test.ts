import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const INQUIRY_FORM_MODULE = "@/components/forms/inquiry-form";

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files.
  return readFileSync(repoPath, "utf8");
}

function createSourceFile(filePath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectNamedImports(
  sourceFile: ts.SourceFile,
  moduleSpecifier: string,
): string[] {
  const importedNames: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleSpecifier
    ) {
      continue;
    }

    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }

    for (const element of clause.namedBindings.elements) {
      importedNames.push(element.name.text);
    }
  }

  return importedNames;
}

function rendersImportedJsxIdentifier(
  sourceFile: ts.SourceFile,
  importedName: string,
): boolean {
  let rendersBinding = false;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName) && tagName.text === importedName) {
        rendersBinding = true;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return rendersBinding;
}

describe("contact entry boundary", () => {
  it("keeps production contact and request-quote pages on InquiryForm -> /api/inquiry", () => {
    // 「表单自己发请求到 /api/inquiry」这半条契约，证明在
    // src/components/forms/__tests__/inquiry-form.test.tsx，那里断言的是真实发
    // 出的请求地址。源码文本断言换不来这个：把地址提成常量就会让它假报警。
    // 「中间没有第二层封装」这半条目前不设门禁——请求地址一样的话，重新引入一个
    // 抽象层也不会有任何断言变红。旧的源码文本断言同样守不住，这里不是回退。
    for (const filePath of [
      "src/app/[locale]/contact/contact-page-sections.tsx",
      "src/app/[locale]/request-quote/page.tsx",
    ]) {
      const source = read(filePath);
      const sourceFile = createSourceFile(filePath, source);
      const importedNames = collectNamedImports(
        sourceFile,
        INQUIRY_FORM_MODULE,
      );

      expect(importedNames, filePath).toContain("InquiryForm");
      expect(
        rendersImportedJsxIdentifier(sourceFile, "InquiryForm"),
        filePath,
      ).toBe(true);
    }
  });
});
