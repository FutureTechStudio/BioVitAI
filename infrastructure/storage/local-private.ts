import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { telemetry } from '../observability/tracing.js';
import {
  DownloadTicketSchema,
  PrivateObjectError,
} from '../../modules/health/src/contracts/private-objects.js';
import type {
  PrivateObjectFiles,
  PrivateObjectSecurity,
} from '../../modules/health/src/contracts/private-objects.js';

export const MAX_PRIVATE_BYTES = 5 * 1024 * 1024;
export function createPrivateObjectSecurity(
  secret: string,
  now = () => Date.now(),
): PrivateObjectSecurity {
  if (secret.length < 32) throw new Error('Private object secret is invalid');
  const key = createHmac('sha256', secret)
    .update('biovitai:download-signing:v1')
    .digest();
  const mac = (value: string) =>
    createHmac('sha256', key).update(value).digest();
  return {
    id: randomUUID,
    digest: (bytes) => createHash('sha256').update(bytes).digest('hex'),
    issue(input) {
      const expiresAt = Math.floor(now() / 1000) + 60;
      const payload = DownloadTicketSchema.parse({
        ...input,
        version: 1,
        expiresAt,
      });
      const encoded = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
      );
      return {
        ticket: `${encoded}.${mac(encoded).toString('base64url')}`,
        expiresAt,
      };
    },
    verify(ticket) {
      try {
        if (
          ticket.length > 2048 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket)
        )
          throw Error();
        const [payload, signature] = ticket.split('.');
        const actual = Buffer.from(signature!, 'base64url'),
          expected = mac(payload!);
        if (
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected) ||
          actual.toString('base64url') !== signature
        )
          throw Error();
        const value = DownloadTicketSchema.parse(
          JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')),
        );
        const seconds = Math.floor(now() / 1000);
        if (value.expiresAt <= seconds || value.expiresAt > seconds + 60)
          throw Error();
        return value;
      } catch {
        throw new PrivateObjectError('INVALID_TICKET');
      }
    },
  };
}
export function createLocalPrivateFiles(
  directory: string,
  secret: string,
  maxBytes = MAX_PRIVATE_BYTES,
): PrivateObjectFiles {
  if (secret.length < 32) throw new Error('Private object secret is invalid');
  const root = path.resolve(directory);
  const key = createHmac('sha256', secret)
    .update('biovitai:object-encryption:v1')
    .digest();
  const filename = (id: string) => path.join(root, `${z.uuid().parse(id)}.bin`);
  const aad = (id: string, profileId: string) =>
    Buffer.from(
      `biovitai:v1:${z.uuid().parse(profileId)}:${z.uuid().parse(id)}`,
    );
  return {
    async write(id, profileId, bytes) {
      telemetry('storage.write');
      if (!bytes.length || bytes.length > maxBytes)
        throw new PrivateObjectError('OBJECT_TOO_LARGE');
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(aad(id, profileId));
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
      const contents = Buffer.concat([
        Buffer.from('BVO1'),
        nonce,
        cipher.getAuthTag(),
        encrypted,
      ]);
      const file = await fs.open(filename(id), 'wx', 0o600);
      try {
        await file.writeFile(contents);
        await file.sync();
      } catch (error) {
        await file.close();
        await fs.rm(filename(id), { force: true });
        throw error;
      }
      await file.close();
    },
    async read(object) {
      telemetry('storage.read');
      try {
        const file = await fs.open(filename(object.id), 'r');
        let contents: Buffer;
        try {
          const stat = await file.stat();
          if (stat.size < 33 || stat.size > maxBytes + 32)
            throw new PrivateObjectError('INTEGRITY_FAILURE');
          contents = await file.readFile();
        } finally {
          await file.close();
        }
        if (contents.subarray(0, 4).toString() !== 'BVO1')
          throw new PrivateObjectError('INTEGRITY_FAILURE');
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          contents.subarray(4, 16),
        );
        decipher.setAAD(aad(object.id, object.profileId));
        decipher.setAuthTag(contents.subarray(16, 32));
        const bytes = Buffer.concat([
          decipher.update(contents.subarray(32)),
          decipher.final(),
        ]);
        if (
          bytes.length !== object.byteLength ||
          createHash('sha256').update(bytes).digest('hex') !== object.sha256
        )
          throw new PrivateObjectError('INTEGRITY_FAILURE');
        return bytes;
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          throw new PrivateObjectError('OBJECT_UNAVAILABLE');
        throw new PrivateObjectError('INTEGRITY_FAILURE');
      }
    },
    async remove(id) {
      await fs.rm(filename(id), { force: true });
    },
  };
}
