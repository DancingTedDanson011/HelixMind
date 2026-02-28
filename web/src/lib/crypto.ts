import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getSecret(): Buffer {
  const secret = process.env.LLM_KEY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('LLM_KEY_SECRET must be set (min 32 chars)');
  }
  // Use first 32 bytes as key (256 bits)
  return Buffer.from(secret.slice(0, 32), 'utf-8');
}

/**
 * Encrypt an API key using AES-256-GCM.
 * Returns base64-encoded string containing: IV (12 bytes) + authTag (16 bytes) + ciphertext
 */
export function encryptApiKey(plainKey: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainKey, 'utf-8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: IV + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt an API key encrypted with encryptApiKey.
 */
export function decryptApiKey(encryptedKey: string): string {
  const key = getSecret();
  const packed = Buffer.from(encryptedKey, 'base64');

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}
