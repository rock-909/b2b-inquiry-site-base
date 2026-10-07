/**
 * 页面级 JSON-LD 图谱：各生成器只产出节点，顶层 `@context` 只在这里写一次。
 */
export function createJsonLdGraphData(data: readonly unknown[]) {
  return {
    "@context": "https://schema.org",
    "@graph": data,
  };
}
