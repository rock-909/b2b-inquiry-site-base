/**
 * Fresh global regex per call so shared lastIndex state never leaks between
 * matchAll/replace consumers.
 */
export function createInternalLinkPattern(): RegExp {
  return /\[([^\]]+)\]\((\/[^\s)]*)\)/g;
}

/**
 * Strips inline markdown syntax (bold markers and internal links) so the
 * same authored string can feed plain-text surfaces such as JSON-LD.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(createInternalLinkPattern(), (_match, label: string) => label)
    .replace(/\*\*([^*]+)\*\*/g, (_match, inner: string) => inner);
}
