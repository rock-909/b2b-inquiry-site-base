const LOCAL_CANARY_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  if (first === undefined || second === undefined) return false;

  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function isDeployedCanaryUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;

  try {
    const { hostname, protocol } = new URL(rawUrl);
    const normalizedHostname = hostname.toLowerCase();

    return (
      protocol === "https:" &&
      normalizedHostname !== "" &&
      !LOCAL_CANARY_HOSTS.has(normalizedHostname) &&
      !normalizedHostname.endsWith(".local") &&
      !isPrivateIpv4(normalizedHostname)
    );
  } catch {
    return false;
  }
}
