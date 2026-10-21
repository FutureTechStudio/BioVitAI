import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, '.local'), { recursive: true });
const passwordPath = path.join(root, '.local/postgres-password');
const authSecretPath = path.join(root, '.local/auth-secret');
try {
  await fs.writeFile(authSecretPath, randomBytes(32).toString('hex'), {
    flag: 'wx',
    mode: 0o600,
  });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const authSecret = (await fs.readFile(authSecretPath, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/.test(authSecret))
  throw new Error('Existing auth secret has an unexpected format; preserved');
try {
  await fs.writeFile(passwordPath, randomBytes(32).toString('hex'), {
    flag: 'wx',
    mode: 0o600,
  });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const password = (await fs.readFile(passwordPath, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/.test(password))
  throw new Error(
    'Existing local password file has an unexpected format; preserved without overwrite',
  );
const contents = `NODE_ENV=development\nDATA_MODE=synthetic\nAPI_HOST=127.0.0.1\nAPI_PORT=3001\nPGHOST=127.0.0.1\nPGPORT=54329\nPGDATABASE=biovitai_dev\nPGUSER=biovitai_dev\nPGPASSWORD=${password}\nAUTH_SECRET=${authSecret}\n`;
try {
  await fs.writeFile(path.join(root, '.env.local'), contents, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Created ignored local settings and random database password. Existing database volumes are not modified.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const existing = await fs.readFile(path.join(root, '.env.local'), 'utf8');
  if (!/^AUTH_SECRET=/m.test(existing)) {
    await fs.appendFile(
      path.join(root, '.env.local'),
      `${existing.endsWith('\n') ? '' : '\n'}AUTH_SECRET=${authSecret}\n`,
    );
    console.log(
      'Added missing local auth secret; existing settings preserved.',
    );
  }
  console.log('Preserved existing .env.local and local password.');
}
