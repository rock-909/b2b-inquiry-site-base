import { Card } from "@/components/ui/card";
import { getPublicContactEmail } from "@/config/public-trust";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { type InquiryFormCopy } from "@/components/forms/inquiry-form-copy";

export function InquiryFormStaticFallback({ copy }: { copy: InquiryFormCopy }) {
  const publicEmail = getPublicContactEmail(SINGLE_SITE_FACTS.contact.email);

  return (
    <Card
      className="mx-auto w-full max-w-2xl p-6"
      data-testid="inquiry-form-static-fallback"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        {copy.noJsExplanation}
      </p>
      {publicEmail ? (
        <p className="mt-4 text-sm leading-6 text-foreground">
          {copy.noJsEmailPrefix}{" "}
          <a
            className="font-medium underline underline-offset-4 hover:no-underline"
            href={`mailto:${publicEmail}`}
          >
            {publicEmail}
          </a>
        </p>
      ) : null}
    </Card>
  );
}
