/**
 * TypeScript declarations for non-code assets (JSON) used by this project.
 */

// JSON module declarations for translation files
declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}
