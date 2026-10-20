import type { Page } from "@/types/content.types";

const privacyPage = {
  slug: "privacy",
  metadata: {
    title: "Privacidad — pendiente de completar",
    description: "Texto provisional incompleto. El responsable debe sustituirlo antes del lanzamiento.",
    slug: "privacy",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    draft: false,
    seo: {
      title: "Privacidad — pendiente de completar",
      description: "Texto provisional incompleto. El responsable debe sustituirlo antes del lanzamiento.",
    },
  },
  content: String.raw`
Esta política de privacidad está incompleta. Antes del lanzamiento, el responsable debe indicar quién controla los datos, qué se recoge, con qué fin, los proveedores, la conservación, las cookies (incluidas las cookies opcionales de análisis y publicidad, que solo se usan con el consentimiento del visitante) y cómo ejercer los derechos.

Sustituye este texto provisional por una política revisada para la actividad real y la legislación aplicable.
`,
} satisfies Page;

export default privacyPage;
