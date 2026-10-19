import type { Page } from "@/types/content.types";

const contactPage = {
  slug: "contact",
  metadata: {
    title: "Contacto",
    description: "Contenido de referencia para contactar con una empresa B2B.",
    slug: "contact",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Contacto — Sitio de referencia para consultas B2B",
      description:
        "Página de contacto de referencia con la información mínima que debe sustituir una empresa real.",
    },
  },
  content: String.raw`
Utiliza el **[formulario de consulta](/contact#inquiry)**. Este sitio de referencia no está listo para recibir consultas comerciales hasta que su responsable configure el envío y los datos de contacto.
`,
} satisfies Page;

export default contactPage;
