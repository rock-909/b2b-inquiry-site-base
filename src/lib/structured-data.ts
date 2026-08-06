/**
 * 生成JSON-LD脚本标签
 * 包含 </script> 注入防护（XSS 转义）
 * @see https://nextjs.org/docs/app/guides/json-ld
 */
export function generateJSONLD(structuredData: unknown): string {
  const jsonString = JSON.stringify(structuredData, null, 2);
  // Escape HTML-sensitive characters and JS line separators before embedding
  // JSON-LD in a script tag so every call site shares the same hardening.
  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
