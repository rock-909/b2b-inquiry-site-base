const STRUCTURED_DATA = "src/lib/structured-data-generators.ts";

function parameterOverrides(file, functionNames, identifier, namespace) {
  return functionNames.map((functionName) => ({
    file,
    functionName,
    identifier,
    namespace,
    reason: `${functionName} receives the ${namespace || "root"} translator`,
  }));
}

const TRANSLATOR_PARAMETER_OVERRIDES = [
  ...parameterOverrides(
    "src/components/forms/inquiry-form-copy.ts",
    ["createInquiryFormCopy"],
    "t",
    "inquiry.form",
  ),
  ...parameterOverrides(
    "src/components/cookie/cookie-banner.tsx",
    ["MainBanner", "PreferencesPanel"],
    "t",
    "cookie",
  ),
  ...parameterOverrides(
    STRUCTURED_DATA,
    [
      "getSocialProfileUrls",
      "generateOrganizationData",
      "generateWebSiteData",
      "generateArticleData",
    ],
    "t",
    "structured-data",
  ),
];

const DYNAMIC_MESSAGE_KEY_PREFIXES = [
  [
    "contact.inquiryHandoff.items.",
    "contact handoff cards are keyed by the fixed need/context/timing tuple",
  ],
  [
    "inquiry.form.",
    "createInquiryFormCopyFromMessages maps the fixed createInquiryFormCopy key set through key.split('.')",
  ],
  ["navigation.", "navigation config provides the dynamic mobile link keys"],
  ["theme.", "theme options store their label keys"],
].map(([prefix, reason]) => ({ prefix, reason }));

const MESSAGE_OBJECT_KEY_CONSUMERS = [];

const MESSAGE_DERIVED_KEY_CONSUMERS = [
  {
    kind: "collection-values",
    file: "src/config/pages.config.ts",
    sourceName: "PUBLIC_STATIC_PAGE_DEFINITIONS",
    valueProperty: "navigationKey",
    prefix: "",
    suffixes: [""],
    reason: "main navigation consumes the active page definition keys",
  },
  {
    kind: "collection-values",
    file: "src/config/single-site.ts",
    sourceName: "FOOTER_TRANSLATION_KEYS",
    prefix: "",
    suffixes: [""],
    reason: "footer links consume the configured translation key values",
  },
  {
    kind: "collection-values",
    file: "src/config/single-site.ts",
    sourceName: "FOOTER_COLUMN_TRANSLATION_KEYS",
    prefix: "",
    suffixes: [""],
    reason: "footer column headings consume their literal translation keys",
  },
  {
    kind: "collection-values",
    file: "src/app/[locale]/contact/contact-page-sections.tsx",
    sourceName: "CONTACT_HANDOFF_ITEM_KEYS",
    prefix: "contact.inquiryHandoff.items.",
    suffixes: [".title", ".description"],
    reason: "contact handoff cards derive their exact keys from this tuple",
  },
  {
    kind: "collection-values",
    file: "src/components/ui/theme-switcher.tsx",
    sourceName: "themes",
    valueProperty: "labelKey",
    prefix: "theme.",
    suffixes: [""],
    reason: "the theme switcher translates its configured labels",
  },
  {
    kind: "collection-values",
    file: "src/constants/api-error-codes.ts",
    sourceName: "API_ERROR_CODES",
    prefix: "apiErrors.",
    suffixes: [""],
    reason: "every stable API error code keeps a localized message leaf",
  },
  {
    kind: "collection-values",
    file: "src/lib/api/inquiry-validation-details.ts",
    sourceName: "PRODUCT_INQUIRY_RENDERABLE_DETAIL_KEYS",
    prefix: "inquiry.form.",
    suffixes: [""],
    reason: "inquiry validation emits these detail keys to the client",
  },
  {
    kind: "property-accesses",
    file: "src/emails/email-copy.ts",
    rootName: "emailTemplateCopy",
    prefix: "emailTemplates.",
    reason: "email copy consumes only the properties reached from this object",
  },
];

const UNUSED_MESSAGE_KEYS = [];

module.exports = {
  DYNAMIC_MESSAGE_KEY_PREFIXES,
  MESSAGE_DERIVED_KEY_CONSUMERS,
  MESSAGE_OBJECT_KEY_CONSUMERS,
  TRANSLATOR_PARAMETER_OVERRIDES,
  UNUSED_MESSAGE_KEYS,
};
