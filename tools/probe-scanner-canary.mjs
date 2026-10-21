import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';
const database = path.resolve('.local/tools/clamav/database'),
  canary = path.join(database, `biovitai-test-${randomUUID()}.hdb`);
const bytes = Buffer.from(
  'BiovitAI harmless synthetic detection canary version 1',
);
await fs.writeFile(
  canary,
  createHash('md5').update(bytes).digest('hex') +
    ':' +
    bytes.length +
    ':BiovitAI.Synthetic.Canary\n',
  { flag: 'wx', mode: 0o600 },
);
try {
  const result = await createLocalReportProcessor().scan(bytes);
  if (result !== 'infected')
    throw new Error('Synthetic canary was not detected');
  console.log(
    JSON.stringify({ event: 'scanner.synthetic_signature_probe', result }),
  );
} finally {
  await fs.unlink(canary);
}
