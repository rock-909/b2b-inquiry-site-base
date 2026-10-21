import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { FaqSection } from "@/components/content/faq-section";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import {
  renderStaticMarkdownBlocks,
} from "@/lib/content/render-static-markdown-content";
import type { HeadingItem } from "@/lib/content/legal-page";
import {
  buildBreadcrumbListSchema,
  buildFaqPageSchema,
  buildWebPageSchema,
} from "@/lib/structured-data-generators";
import { buildCanonicalForPath } from "@/lib/seo-metadata";
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
  /** Page-specific sections rendered after the article, e.g. the contact details. */
  children?: ReactNode;
  /** Right-hand column on wide screens (the contact form); widens the page to the header width. */
  aside?: ReactNode;
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

  // 页面不显示日期，结构化数据也不声明日期，保持两者一致。
  return buildWebPageSchema({
    locale,
    name: metadata.seo?.title ?? metadata.title,
    url: pageUrl,
    ...(description ? { description } : {}),
  });
}

export async function LegalPageShell({
  metadata,
  blocks,
  headings,
  locale,
  pagePath,
  children,
  aside,
}: LegalPageShellProps): Promise<ReactNode> {
  const t = await getTranslations({ locale, namespace: "legal" });
  const tNav = await getTranslations({ locale, namespace: "navigation" });

  const pageUrl = buildCanonicalForPath(pagePath, locale);
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
        url: buildCanonicalForPath("/", locale),
      },
      { name: metadata.title, url: pageUrl },
    ]),
  ];
  if (metadata.faq?.length) {
    schemas.push(buildFaqPageSchema(metadata.faq));
  }

  const tocHeadings = headings.filter((heading) => heading.level === 2);
  const hasToc = tocHeadings.length > 0;

  const content = (
    <>
      <header className="mb-6 md:mb-8">
        <h1 className="text-heading mb-4">{metadata.title}</h1>
        {metadata.description && (
          <p className="text-body max-w-2xl text-muted-foreground">
            {metadata.description}
          </p>
        )}
      </header>

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

      <FaqSection heading={t("faq")} items={metadata.faq} />

      {children ? (
        <div className="mt-6 min-w-0 space-y-8">{children}</div>
      ) : null}
    </>
  );

  return (
    <>
      <JsonLdGraphScript locale={locale} data={schemas} />

      {aside ? (
        // Follows vercel.com/contact/sales: text in columns 1-6, form in 8-12, top-aligned.
        <div className="mx-auto max-w-[720px] px-6 py-8 md:py-12 lg:grid lg:max-w-[1080px] lg:grid-cols-12 lg:items-start lg:gap-x-6">
          <div className="min-w-0 lg:col-span-6">{content}</div>
          <div className="mt-10 min-w-0 lg:col-span-5 lg:col-start-8 lg:mt-0">
            {aside}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[720px] px-6 py-8 md:py-12">
          {content}
        </div>
      )}
    </>
  );
}
