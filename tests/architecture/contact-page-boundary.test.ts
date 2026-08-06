import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const CONTACT_ROUTE = "src/app/[locale]/contact/page.tsx";
const CONTACT_PAGE_DATA = "src/app/[locale]/contact/contact-page-data.ts";
const CONTACT_SECTIONS = "src/app/[locale]/contact/contact-page-sections.tsx";
const INQUIRY_STATIC_FALLBACK =
  "src/components/forms/inquiry-form-static-fallback.tsx";

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from fixed constants
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

function rendersInquiryFormWithContactSource(source: string): boolean {
  const sourceFile = createSourceFile(CONTACT_SECTIONS, source);
  let rendersInquiryForm = false;
  let hasContactSource = false;
  let hasGeneralContext = false;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName) && tagName.text === "InquiryForm") {
        rendersInquiryForm = true;

        for (const attribute of node.attributes.properties) {
          if (
            !ts.isJsxAttribute(attribute) ||
            !ts.isIdentifier(attribute.name) ||
            attribute.initializer === undefined
          ) {
            continue;
          }

          if (
            attribute.name.text === "source" &&
            ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === "contact"
          ) {
            hasContactSource = true;
          }

          if (
            attribute.name.text === "context" &&
            ts.isJsxExpression(attribute.initializer)
          ) {
            const expression = attribute.initializer.expression;
            if (
              expression &&
              ts.isObjectLiteralExpression(expression) &&
              expression.properties.some(
                (property) =>
                  ts.isPropertyAssignment(property) &&
                  ts.isIdentifier(property.name) &&
                  property.name.text === "kind" &&
                  ts.isStringLiteral(property.initializer) &&
                  property.initializer.text === "general-context",
              )
            ) {
              hasGeneralContext = true;
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return rendersInquiryForm && hasContactSource && hasGeneralContext;
}

describe("Contact page source boundaries", () => {
  it("keeps generated content and message loading out of the route file", () => {
    const source = read(CONTACT_ROUTE);

    expect(source).not.toContain("CONTENT_MANIFEST");
    expect(source).not.toContain("@messages/en/critical.json");
    expect(source).not.toContain("@messages/en/deferred.json");
    expect(source).not.toContain("@messages/zh/critical.json");
    expect(source).not.toContain("@messages/zh/deferred.json");
    expect(source).not.toContain("mergeObjects");
  });

  it("keeps the route focused on Contact orchestration", () => {
    const source = read(CONTACT_ROUTE);

    expect(source).toContain("ContactFormWithFallback");
    expect(source).toContain("contact-page-sections");
    expect(source).not.toContain("InquiryFormStaticFallback");
    expect(source).not.toContain("inquiry-form-static-fallback");
  });

  it("validates manifest metadata before returning typed contact page data", () => {
    const source = read(CONTACT_PAGE_DATA);

    expect(source).not.toContain("as unknown as Page");
    expect(source).toContain("assertContactPageMetadata");
  });

  it("renders InquiryForm directly with general context and static fallback", () => {
    const source = read(CONTACT_SECTIONS);

    expect(source).toContain("InquiryForm");
    expect(source).toContain("InquiryFormStaticFallback");
    expect(source).toContain("inquiry-form-static-fallback");
    expect(source).toContain("fallback={inquiryFallback}");
    expect(rendersInquiryFormWithContactSource(source)).toBe(true);
  });

  it("keeps the no-JS fallback informational without fake form markup", () => {
    const source = read(INQUIRY_STATIC_FALLBACK);

    expect(source).toContain('data-testid="inquiry-form-static-fallback"');
    expect(source).toContain("getPublicContactEmail");
    expect(source).toContain("mailto:");
    expect(source).not.toContain("<form");
    expect(source).not.toContain('type="submit"');
  });
});
