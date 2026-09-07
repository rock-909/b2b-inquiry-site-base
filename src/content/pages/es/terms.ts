import type { Page } from "@/types/content.types";

const termsPage = {
  slug: "terms",
  filePath: "/src/content/pages/es/terms.ts",
  metadata: {
    title: "Referencia de condiciones del sitio web",
    description:
      "Texto de referencia no destinado a producción sobre el uso del sitio y los límites de la fase de consulta B2B.",
    slug: "terms",
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-06",
    author: "B2B Inquiry Site Base",
    layout: "legal",
    showToc: true,
    lastReviewed: "2026-08-06",
    draft: false,
    seo: {
      title: "Referencia de condiciones del sitio web",
      description:
        "Texto de referencia que debe revisarse y sustituirse según la empresa y la oferta reales.",
    },
  },
  content: String.raw`
> Solo como referencia. Esto no es asesoramiento jurídico ni un documento de condiciones para producción. Sustitúyelo por condiciones revisadas para la empresa, la oferta y la jurisdicción reales.

## Responsable del sitio

Identifica la entidad legal responsable del sitio web y proporciona un medio de contacto operativo.

## Información del sitio web

Explica si las páginas, descargas y ejemplos son información general, especificaciones, presupuestos o compromisos contractuales. No prometas garantías que la empresa no haya aprobado.

## Consultas y presupuestos

Indica que una consulta no crea un pedido. Define qué documento escrito confirma el precio, el alcance, los plazos, la entrega, el pago y cualquier requisito personalizado.

## Responsabilidades del comprador y del proveedor

Describe los límites reales respecto a la selección, instalación, cumplimiento, operación, mantenimiento y aprobaciones locales cuando corresponda.

## Actualizaciones

Explica cuándo entran en vigor las condiciones actualizadas del sitio y qué documentos comerciales firmados tienen prioridad en una operación real.
`,
} satisfies Page;

export default termsPage;
