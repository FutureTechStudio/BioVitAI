import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

// Purpose-separated encrypted payloads, bound to both subject and immutable version.
export function createEncryptedJson(secret: string, purpose: string) {
  const key = createHash('sha256')
    .update(`biovitai.${purpose}:` + secret)
    .digest();
  return {
    hash(value: unknown) {
      return createHmac('sha256', key)
        .update(JSON.stringify(value))
        .digest('hex');
    },
    encrypt(profile: string, id: string, value: unknown) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(`${purpose}:${profile}:${id}`));
      return Buffer.concat([
        iv,
        cipher.update(JSON.stringify(value)),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
    },
    decrypt(profile: string, id: string, bytes: Buffer): unknown {
      const cipher = createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(0, 12),
      );
      cipher.setAAD(Buffer.from(`${purpose}:${profile}:${id}`));
      cipher.setAuthTag(bytes.subarray(-16));
      return JSON.parse(
        Buffer.concat([
          cipher.update(bytes.subarray(12, -16)),
          cipher.final(),
        ]).toString('utf8'),
      );
    },
  };
}
