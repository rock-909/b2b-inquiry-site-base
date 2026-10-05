/**
 * Public base-URL readiness for production / public-launch gates.
 * Pure helpers — no runtime env reads.
 *
 * Shared by:
 * - production readiness checks
 * - scripts/quality/checks/production-config.js
 *
 * Accepts only an https origin suitable as a public production base URL:
 * https, non-empty hostname, no credentials, no query/hash, pathname `/` only,
 * and not local / example / reserved special-use / workers.dev hosts.
 */

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isExampleHostname(hostname) {
  return (
    hostname === "example.com" ||
    hostname === "example.org" ||
    hostname === "example.net" ||
    hostname === "example.invalid" ||
    hostname.endsWith(".example.com") ||
    hostname.endsWith(".example.org") ||
    hostname.endsWith(".example.net") ||
    hostname.endsWith(".example.invalid") ||
    hostname.endsWith(".example")
  );
}

/**
 * RFC 2606 / special-use labels that must never be treated as public launch hosts.
 * @param {string} hostname
 * @returns {boolean}
 */
function isReservedSpecialUseHostname(hostname) {
  return (
    hostname === "test" ||
    hostname === "invalid" ||
    hostname === "localhost" ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".localhost")
  );
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isWorkersDevHostname(hostname) {
  return hostname === "workers.dev" || hostname.endsWith(".workers.dev");
}

/**
 * @param {string} baseUrl
 * @returns {boolean} true when the URL is acceptable as a public production base URL
 */
function isPublicBaseUrlReady(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return false;
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return false;
  if (url.username || url.password) return false;
  if (url.search.length > 0 || url.hash.length > 0) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  // Reject explicit non-default ports; public site origin should be bare https host.
  if (url.port !== "") return false;

  if (isLocalHostname(hostname)) return false;
  if (isExampleHostname(hostname)) return false;
  if (isReservedSpecialUseHostname(hostname)) return false;
  if (isWorkersDevHostname(hostname)) return false;
  return true;
}

module.exports = {
  isPublicBaseUrlReady,
};
