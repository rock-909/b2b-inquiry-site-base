import type { Page } from "@/types/content.types";

const termsPage = {
  slug: "terms",
  filePath: "/src/content/pages/es/terms.ts",
  metadata: {
    title: "Condiciones — pendientes de completar",
    description: "Texto provisional incompleto. El responsable debe sustituirlo antes del lanzamiento.",
    slug: "terms",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    draft: false,
    seo: {
      title: "Condiciones — pendientes de completar",
      description: "Texto provisional incompleto. El responsable debe sustituirlo antes del lanzamiento.",
    },
  },
  content: String.raw`
Estas condiciones están incompletas. Antes del lanzamiento, el responsable debe indicar su identidad, el uso del sitio, la gestión de consultas, las condiciones aplicables y un medio de contacto operativo.

Sustituye este texto provisional por condiciones revisadas para la actividad real y la legislación aplicable.
`,
} satisfies Page;

export default termsPage;
