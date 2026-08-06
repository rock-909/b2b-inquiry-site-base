function stripSchemaContext(value: Record<string, unknown>) {
  const { "@context": _context, ...node } = value;
  return node;
}

function collectGraphNodes(
  data: readonly unknown[],
): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];

  for (const item of data) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const graph = record["@graph"];

    if (Array.isArray(graph)) {
      nodes.push(...collectGraphNodes(graph));
      continue;
    }

    nodes.push(stripSchemaContext(record));
  }

  return nodes;
}

export function createJsonLdGraphData(data: readonly unknown[]) {
  return {
    "@context": "https://schema.org",
    "@graph": collectGraphNodes(data),
  };
}
