import type { ReactNode } from "react";

export function InquiryFormSectionShell({
  children,
  id,
  title,
  description,
}: {
  children: ReactNode;
  id?: string;
  title: string;
  description?: string;
}) {
  return (
    <section
      {...(id ? { id } : {})}
      className="section-divider px-6 py-14 md:py-[72px]"
    >
      <div className="mx-auto max-w-[720px]">
        <h2 className="text-section text-balance">{title}</h2>
        {description ? (
          <p className="mt-3 text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
