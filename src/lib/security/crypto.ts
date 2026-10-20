/**
 * 加密和密码哈希工具
 * Cryptography and password hashing utilities
 */

const HEX_PAD_LENGTH = 2;

/**
 * Generate HMAC-SHA256 signature
 */
export async function generateHMAC(
  data: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));

  return signatureArray
    .map((b) => b.toString(16).padStart(HEX_PAD_LENGTH, "0"))
    .join("");
}
