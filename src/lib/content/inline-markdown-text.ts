/**
 * Fresh global regex per call so shared lastIndex state never leaks between
 * matchAll/replace consumers. Matches site paths (`/...`) and http(s) URLs.
 */
export function createMarkdownLinkPattern(): RegExp {
  return /\[([^\]]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]+)\)/g;
}
