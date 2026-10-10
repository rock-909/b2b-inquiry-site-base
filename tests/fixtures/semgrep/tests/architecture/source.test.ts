import { existsSync as exists, readFileSync } from "node:fs";
import * as fs from "node:fs";
import { expect } from "vitest";

// ruleid: test-no-file-existence-assertion
expect(fs.existsSync("src/proxy.ts")).toBe(true);
// ruleid: test-no-file-existence-assertion
expect(exists("src/proxy.ts")).toBe(true);
const source = readFileSync("src/example.ts", "utf8");
// ruleid: architecture-no-source-string-assertion
expect(source).toContain("import('example')");
// ruleid: architecture-no-source-string-assertion
expect(source, "source").not.toMatch(/import/);
// ok: architecture-no-source-string-assertion
expect("rendered email").toContain("email");
// ok: test-no-file-existence-assertion
if (fs.existsSync("fixture.json"))
  JSON.parse(readFileSync("fixture.json", "utf8"));
