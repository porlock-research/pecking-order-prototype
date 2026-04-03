const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export interface DerivedKeys {
  encKey: CryptoKey;
  hmacKey: CryptoKey;
}

export async function deriveKeys(masterHex: string): Promise<DerivedKeys> {
  const masterBytes = hexToBytes(masterHex);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    masterBytes,
    'HKDF',
    false,
    ['deriveKey'],
  );

  const [encKey, hmacKey] = await Promise.all([
    crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: ENCODER.encode('aes-gcm-encrypt'),
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
    crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: ENCODER.encode('hmac-sha256-dedup'),
      },
      baseKey,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    ),
  ]);

  return { encKey, hmacKey };
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext),
  );
  return `enc:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decrypt(
  encoded: string | null,
  key: CryptoKey,
): Promise<string | null> {
  if (encoded == null) return null;
  if (!encoded.startsWith('enc:')) return encoded;
  const parts = encoded.slice(4).split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted value format');
  const iv = base64ToBytes(parts[0]);
  const ciphertext = base64ToBytes(parts[1]);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return DECODER.decode(plaintext);
}

export async function hmac(value: string, key: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(value));
  return bytesToHex(new Uint8Array(sig));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
