import type { Page } from "@/types/content.types";

const contactPage = {
  slug: "contact",
  filePath: "/src/content/pages/es/contact.ts",
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
Esta página es una **referencia no destinada a producción**. Sustituye la identidad, el correo, la ubicación, el plazo de respuesta y el horario por datos confirmados por el responsable.

La vía más rápida es el **[formulario de consulta](/contact)**. Una solicitud útil suele incluir el requisito, la cantidad o el alcance, el mercado de destino y los plazos.
`,
} satisfies Page;

export default contactPage;
