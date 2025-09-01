import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';

// Encodes secrets as: v1:<saltBase64>:<ivBase64>:<cipherBase64>:<tagBase64>
const VERSION = 'v1';

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'Encryption secret not configured. Set NEXTAUTH_SECRET or SESSION_SECRET.',
    );
  }
  const salt = 'wpAgentic.static.salt';
  // Derive 32-byte key for AES-256-GCM
  return scryptSync(secret, salt, 32);
}

export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(12); // GCM IV size 12 bytes
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const salt = randomBytes(16); // reserved for future key-rotation; not used in current scrypt
  return [
    VERSION,
    salt.toString('base64'),
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

export function decryptSecret(encoded: string): string {
  const [version, _saltB64, ivB64, ctB64, tagB64] = encoded.split(':');
  if (version !== VERSION) throw new Error('Unsupported secret encoding');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return plaintext;
}
