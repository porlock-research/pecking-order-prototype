import { describe, it, expect } from 'vitest';
import { deriveKeys, encrypt, decrypt, hmac } from './crypto';

const TEST_MASTER_KEY_HEX = 'a'.repeat(64);

describe('crypto', () => {
  describe('deriveKeys', () => {
    it('derives two distinct CryptoKey objects', async () => {
      const keys = await deriveKeys(TEST_MASTER_KEY_HEX);
      expect(keys.encKey).toBeDefined();
      expect(keys.hmacKey).toBeDefined();
      expect(keys.encKey).not.toBe(keys.hmacKey);
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips plaintext', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const plaintext = 'test@example.com';
      const ciphertext = await encrypt(plaintext, encKey);
      expect(ciphertext.startsWith('enc:')).toBe(true);
      const decrypted = await decrypt(ciphertext, encKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await encrypt('hello', encKey);
      const b = await encrypt('hello', encKey);
      expect(a).not.toBe(b);
    });

    it('returns plaintext as-is when not encrypted (fallback)', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const result = await decrypt('plaintext@example.com', encKey);
      expect(result).toBe('plaintext@example.com');
    });

    it('returns null values as-is', async () => {
      const { encKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const result = await decrypt(null as any, encKey);
      expect(result).toBe(null);
    });
  });

  describe('hmac', () => {
    it('produces deterministic hex hash', async () => {
      const { hmacKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await hmac('test@example.com', hmacKey);
      const b = await hmac('test@example.com', hmacKey);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', async () => {
      const { hmacKey } = await deriveKeys(TEST_MASTER_KEY_HEX);
      const a = await hmac('alice@example.com', hmacKey);
      const b = await hmac('bob@example.com', hmacKey);
      expect(a).not.toBe(b);
    });
  });
});
