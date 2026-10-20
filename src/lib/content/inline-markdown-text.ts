/**
 * Fresh global regex per call so shared lastIndex state never leaks between
 * matchAll/replace consumers.
 */
export function createInternalLinkPattern(): RegExp {
  return /\[([^\]]+)\]\((\/[^\s)]*)\)/g;
}

