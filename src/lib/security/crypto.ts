import { HEX_RADIX } from "@/constants";

/**
 * 加密和密码哈希工具
 * Cryptography and password hashing utilities
 */

const HEX_PAD_LENGTH = 2;

/**
 * Generate HMAC signature
 */
export async function generateHMAC(
  data: string,
  secret: string,
  algorithm: "SHA-256" | "SHA-512" = "SHA-256",
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));

  return signatureArray
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_PAD_LENGTH, "0"))
    .join("");
}
