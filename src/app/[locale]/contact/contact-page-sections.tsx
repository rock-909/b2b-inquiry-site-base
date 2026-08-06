import { FaqAccordion } from "@/components/sections/faq-accordion";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import {
  getPublicContactEmail,
  getPublicContactPhone,
} from "@/config/public-trust";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { readRequiredMessagePath } from "@/lib/i18n/read-message-path";
import type { FaqItem } from "@/types/content.types";
import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import type { ContactPageData } from "@/app/[locale]/contact/contact-page-data";

const CONTACT_HANDOFF_ITEM_KEYS = ["need", "context", "timing"] as const;

export function ContactInquiryHandoff({
  messages,
}: {
  messages: Record<string, unknown>;
}) {
  const title = readRequiredMessagePath(messages, [
    "contact",
    "inquiryHandoff",
    "title",
  ]);
  const description = readRequiredMessagePath(messages, [
    "contact",
    "inquiryHandoff",
    "description",
  ]);

  return (
    <section
      className="surface-card mb-10 p-6 md:p-8"
      data-testid="contact-inquiry-handoff"
    >
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CONTACT_HANDOFF_ITEM_KEYS.map((key) => (
          <div key={key} className="rounded-2xl border border-border p-4">
            <h3 className="text-base font-semibold text-foreground">
              {readRequiredMessagePath(messages, [
                "contact",
                "inquiryHandoff",
                "items",
                key,
                "title",
              ])}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {readRequiredMessagePath(messages, [
                "contact",
                "inquiryHandoff",
                "items",
                key,
                "description",
              ])}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ContactMethodsCard({
  copy,
}: {
  copy: ContactPageData["copy"]["panel"]["contact"];
}) {
  const publicEmail = getPublicContactEmail(SINGLE_SITE_FACTS.contact.email);
  const publicPhone = getPublicContactPhone(SINGLE_SITE_FACTS.contact.phone);

  return (
    <Card className="gap-0 p-0 shadow-[var(--shadow-xs)]">
      <div className="border-b border-border px-6 py-5">
        <h3 className="text-lg font-semibold">{copy.title}</h3>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
            <svg
              className="size-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-medium">{copy.emailLabel}</p>
            <p className="break-words text-muted-foreground">
              {publicEmail ?? copy.emailUnavailable}
            </p>
          </div>
        </div>

        {publicPhone ? (
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <svg
                className="size-5 text-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-medium">{copy.phoneLabel}</p>
              <p className="break-words text-muted-foreground">{publicPhone}</p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function ResponseExpectationsCard({
  responseCopy,
  hoursCopy,
}: {
  responseCopy: ContactPageData["copy"]["panel"]["response"];
  hoursCopy: ContactPageData["copy"]["panel"]["hours"];
}) {
  return (
    <Card className="gap-0 p-0 shadow-[var(--shadow-xs)]">
      <div className="border-b border-border px-6 py-5">
        <h3 className="text-lg font-semibold">{responseCopy.title}</h3>
      </div>
      <div className="p-6">
        <dl className="space-y-4 text-sm">
          <div className="space-y-1">
            <dt className="font-medium">{responseCopy.responseTimeLabel}</dt>
            <dd className="min-w-0 break-words text-muted-foreground">
              {responseCopy.responseTimeValue}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium">{responseCopy.bestForLabel}</dt>
            <dd className="min-w-0 break-words text-muted-foreground">
              {responseCopy.bestForValue}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium">{responseCopy.prepareLabel}</dt>
            <dd className="min-w-0 break-words text-muted-foreground">
              {responseCopy.prepareValue}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t pt-6">
          <h4 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {hoursCopy.title}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex min-w-0 justify-between gap-4">
              <span>{hoursCopy.weekdaysLabel}</span>
              <span className="text-muted-foreground">
                {SINGLE_SITE_FACTS.contact.businessHours?.weekdays}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-4">
              <span>{hoursCopy.saturdayLabel}</span>
              <span className="text-muted-foreground">
                {SINGLE_SITE_FACTS.contact.businessHours?.saturday}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-4">
              <span>{hoursCopy.sundayLabel}</span>
              <span className="text-muted-foreground">
                {hoursCopy.closedLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ContactFaqSection({
  faqItems,
  title,
}: {
  faqItems: FaqItem[];
  title: string;
}) {
  const accordionItems = faqItems.map((item) => ({
    key: item.id,
    question: item.question,
    answer: item.answer,
  }));

  return (
    <section
      className="section-divider py-14 md:py-[72px]"
      data-testid="faq-section"
    >
      <div className="mx-auto max-w-[1080px] px-6">
        <SectionHead title={title} />
        <FaqAccordion items={accordionItems} />
      </div>
    </section>
  );
}

export function ContactFormWithFallback({
  messages,
}: {
  messages: Record<string, unknown>;
}) {
  const inquiryCopy = createInquiryFormCopyFromMessages(messages);
  const inquiryFallback = <InquiryFormStaticFallback copy={inquiryCopy} />;

  return (
    <div className="min-w-0 space-y-6" data-testid="contact-form-column">
      <InquiryForm
        source="contact"
        copy={inquiryCopy}
        context={{ kind: "general-context" }}
        fallback={inquiryFallback}
      />
    </div>
  );
}
