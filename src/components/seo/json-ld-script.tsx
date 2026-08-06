import "server-only";
import { generateJSONLD } from "@/lib/structured-data";
import { generatePageStructuredData } from "@/lib/page-structured-data";
import type { Locale } from "@/types/content.types";
import { createJsonLdGraphData } from "@/components/seo/json-ld-graph-data";

interface JsonLdScriptProps {
  readonly data: unknown;
}

interface JsonLdGraphScriptProps {
  readonly locale: Locale;
  readonly data?: readonly unknown[];
}

const EMPTY_JSON_LD_GRAPH_DATA: readonly unknown[] = [];

/**
 * Server Component for rendering JSON-LD structured data.
 *
 * Encapsulates the dangerouslySetInnerHTML usage in a single,
 * auditable location with proper XSS escaping via generateJSONLD.
 *
 * Security: generateJSONLD escapes < to \u003c to prevent script injection.
 *
 * @see https://nextjs.org/docs/app/guides/json-ld
 */
export function JsonLdScript({ data }: JsonLdScriptProps) {
  let jsonLd: string;

  try {
    jsonLd = generateJSONLD(data);
  } catch {
    // Silently fail - structured data is enhancement, not critical
    return null;
  }

  // nosemgrep: nextjs-unsafe-dangerouslySetInnerHTML -- 单一可审计的 JSON-LD 注入点；jsonLd 来自 generateJSONLD，已将 < 转义为 < 防脚本注入
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd,
      }}
    />
  );
}

export async function JsonLdGraphScript({
  locale,
  data = EMPTY_JSON_LD_GRAPH_DATA,
}: JsonLdGraphScriptProps) {
  let identity: Awaited<ReturnType<typeof generatePageStructuredData>>;

  try {
    identity = await generatePageStructuredData(locale);
  } catch {
    return null;
  }

  const { organizationData, websiteData } = identity;

  return (
    <JsonLdScript
      data={createJsonLdGraphData([organizationData, websiteData, ...data])}
    />
  );
}
