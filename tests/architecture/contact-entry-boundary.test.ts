import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取下方固定的仓库文件
  return readFileSync(repoPath, "utf8");
}

describe("contact entry boundary", () => {
  it("keeps homepage, product, and contact forms on their intended client boundaries", () => {
    const homepage = read("src/components/sections/inquiry-form-embed.tsx");
    expect(homepage).toContain(
      'from "@/components/forms/deferred-inquiry-form"',
    );
    expect(homepage).not.toContain('from "@/components/forms/inquiry-form"');

    const deferred = read("src/components/forms/deferred-inquiry-form.tsx");
    expect(deferred).toContain('import("@/components/forms/inquiry-form")');
    expect(deferred).not.toMatch(
      /import\s+(?!type\b)[^;]*from\s+["']@\/components\/forms\/inquiry-form["']/u,
    );

    const product = read(
      "src/components/sections/immediate-inquiry-form-section.tsx",
    );
    expect(product).toContain('from "@/components/forms/inquiry-form"');
    expect(product).not.toContain(
      'from "@/components/forms/deferred-inquiry-form"',
    );

    const contact = read("src/app/[locale]/contact/contact-page-sections.tsx");
    expect(contact).toContain('from "@/components/forms/inquiry-form"');
  });
});
