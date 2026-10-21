import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IdentityMailer } from '../contracts/auth.js';

// Explicit local synthetic-data adapter: capture files, no external email delivery.
export function createLocalMailer(directory: string): IdentityMailer {
  return {
    async deliver(message) {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.writeFile(
        path.join(directory, `${randomUUID()}.json`),
        JSON.stringify({
          ...message,
          capturedAt: new Date().toISOString(),
          delivery: 'local-capture-only',
        }),
        { flag: 'wx', mode: 0o600 },
      );
    },
  };
}
