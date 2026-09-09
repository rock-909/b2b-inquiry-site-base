import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import {
  renderStaticMarkdownBlocks,
} from "@/lib/content/render-static-markdown-content";
import type { HeadingItem } from "@/lib/content/legal-page";
import {
  buildBreadcrumbListSchema,
  buildWebPageSchema,
} from "@/lib/structured-data-generators";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import type { StaticMarkdownBlock } from "@/lib/content/static-markdown-blocks";
import type { LegalPageMetadata, Locale } from "@/types/content.types";

interface LegalPageShellProps {
  metadata: LegalPageMetadata;
  /** 正文渲染与 TOC 共用的同一次解析结果。 */
  blocks: readonly StaticMarkdownBlock[];
  headings: HeadingItem[];
  locale: Locale;
  /** Site-relative path (e.g. "/privacy"); enables BreadcrumbList output. */
  pagePath: string;
}

export interface ShellSchemaInput {
  metadata: LegalPageMetadata;
  locale: Locale;
  pageUrl: string;
}

export function buildShellPageSchema(
  input: ShellSchemaInput,
): Record<string, unknown> {
  const { metadata, locale, pageUrl } = input;

  const description = metadata.seo?.description ?? metadata.description;
  const modifiedAt =
    metadata.updatedAt ?? metadata.lastReviewed ?? metadata.publishedAt;

  return buildWebPageSchema({
    locale,
    name: metadata.seo?.title ?? metadata.title,
    url: pageUrl,
    ...(description ? { description } : {}),
    ...(metadata.publishedAt ? { datePublished: metadata.publishedAt } : {}),
    ...(modifiedAt ? { dateModified: modifiedAt } : {}),
  });
}

export async function LegalPageShell({
  metadata,
  blocks,
  headings,
  locale,
  pagePath,
}: LegalPageShellProps): Promise<ReactNode> {
  const t = await getTranslations({ locale, namespace: "legal" });
  const tNav = await getTranslations({ locale, namespace: "navigation" });

  const pageUrl = new URL(pagePath, SINGLE_SITE_CONFIG.baseUrl).toString();
  const schema = await buildShellPageSchema({
    metadata,
    locale,
    pageUrl,
  });

  const schemas: Array<Record<string, unknown>> = [
    schema,
    buildBreadcrumbListSchema([
      {
        name: tNav("home"),
        url: new URL("/", SINGLE_SITE_CONFIG.baseUrl).toString(),
      },
      { name: metadata.title, url: pageUrl },
    ]),
  ];

  const tocHeadings = headings.filter((heading) => heading.level === 2);
  const hasToc = tocHeadings.length > 0;

  return (
    <>
      <JsonLdGraphScript locale={locale} data={schemas} />

      <div className="mx-auto max-w-[720px] px-6 py-8 md:py-12">
        <header className="mb-6 md:mb-8">
          <h1 className="text-heading mb-4">{metadata.title}</h1>
          {metadata.description && (
            <p className="text-body max-w-2xl text-muted-foreground">
              {metadata.description}
            </p>
          )}
        </header>

        <section className="mb-8 flex flex-wrap gap-4 text-xs text-muted-foreground sm:text-sm">
          {metadata.publishedAt !== undefined && (
            <div>
              <span className="font-medium">{t("effectiveDate")}:</span>{" "}
              <span>{metadata.publishedAt}</span>
            </div>
          )}
          {metadata.updatedAt !== undefined && (
            <div>
              <span className="font-medium">{t("lastUpdated")}:</span>{" "}
              <span>{metadata.updatedAt}</span>
            </div>
          )}
        </section>

        <div
          className={
            hasToc
              ? "grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)]"
              : undefined
          }
        >
          <article className="min-w-0">
            {renderStaticMarkdownBlocks(blocks)}
          </article>

          {hasToc && (
            <aside className="order-first surface-card p-4 text-sm lg:order-none">
              <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("tableOfContents")}
              </h2>
              <nav aria-label={t("tableOfContents")}>
                <ol className="space-y-2">
                  {tocHeadings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className="inline-flex text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
