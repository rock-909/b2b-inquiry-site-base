/**
 * TypeScript declarations for non-code assets (JSON/MDX) used by this project.
 */

// JSON module declarations for translation files
declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}

// MDX module declarations
declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType;
  export default MDXComponent;

  export const frontmatter: Record<string, unknown>;
}

// Content path alias MDX declarations
declare module "@content/posts/*" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType;
  export default MDXComponent;

  export const frontmatter: Record<string, unknown>;
}

declare module "@content/products/*" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType;
  export default MDXComponent;

  export const frontmatter: Record<string, unknown>;
}

declare module "@content/pages/*" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType;
  export default MDXComponent;

  export const frontmatter: Record<string, unknown>;
}
