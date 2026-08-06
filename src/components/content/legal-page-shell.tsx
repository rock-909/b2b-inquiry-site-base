import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { LegalContentRenderer } from "@/components/content/legal-content-renderer";
import type { HeadingItem } from "@/lib/content/legal-page";
import {
  buildBreadcrumbListSchema,
  buildWebPageSchema,
  generateArticleData,
} from "@/lib/structured-data-generators";
import { SITE_CONFIG } from "@/config/paths";
import type { LegalPageMetadata, Locale } from "@/types/content.types";

interface LegalPageShellProps {
  metadata: LegalPageMetadata;
  content: string;
  headings: HeadingItem[];
  locale: Locale;
  schemaType: "WebPage" | "Article";
  /** Site-relative path (e.g. "/oem-wholesale"); enables BreadcrumbList output. */
  pagePath: string;
}

export interface ShellSchemaInput {
  metadata: LegalPageMetadata;
  locale: Locale;
  schemaType: LegalPageShellProps["schemaType"];
  pageUrl: string;
}

async function buildShellArticleSchema(
  input: ShellSchemaInput,
): Promise<Record<string, unknown>> {
  const { metadata, locale, pageUrl } = input;
  const tSchema = await getTranslations({
    locale,
    namespace: "structured-data",
  });
  const modifiedAt = metadata.updatedAt ?? metadata.lastReviewed;

  return generateArticleData(tSchema, locale, {
    title: metadata.seo?.title ?? metadata.title,
    description: metadata.seo?.description ?? metadata.description ?? "",
    ...(metadata.author ? { author: metadata.author } : {}),
    publishedTime: metadata.publishedAt ?? "",
    ...(modifiedAt ? { modifiedTime: modifiedAt } : {}),
    url: pageUrl,
  }) as Record<string, unknown>;
}

export function buildShellPageSchema(
  input: ShellSchemaInput,
): Promise<Record<string, unknown>> | Record<string, unknown> {
  const { metadata, locale, schemaType, pageUrl } = input;

  if (schemaType === "Article") {
    return buildShellArticleSchema(input);
  }

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
  content,
  headings,
  locale,
  schemaType,
  pagePath,
}: LegalPageShellProps): Promise<ReactNode> {
  const t = await getTranslations({ locale, namespace: "legal" });
  const tNav = await getTranslations({ locale, namespace: "navigation" });

  const pageUrl = new URL(pagePath, SITE_CONFIG.baseUrl).toString();
  const schema = await buildShellPageSchema({
    metadata,
    locale,
    schemaType,
    pageUrl,
  });

  const schemas: Array<Record<string, unknown>> = [
    schema,
    buildBreadcrumbListSchema([
      { name: tNav("home"), url: new URL("/", SITE_CONFIG.baseUrl).toString() },
      { name: metadata.title, url: pageUrl },
    ]),
  ];

  const tocHeadings = headings.filter((heading) => heading.level === 2);
  const hasToc = tocHeadings.length > 0;

  return (
    <>
      <JsonLdGraphScript locale={locale} data={schemas} />

      <div
        className={
          schemaType === "Article"
            ? "mx-auto max-w-[1080px] px-6 py-8 md:py-12"
            : "mx-auto max-w-[720px] px-6 py-8 md:py-12"
        }
      >
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
            <LegalContentRenderer content={content} />
            {schemaType === "Article" ? (
              <footer className="border-border mt-10 border-t pt-4">
                <p className="text-muted-foreground text-sm leading-6">
                  {t("articleAuthorLine")}
                </p>
              </footer>
            ) : null}
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
