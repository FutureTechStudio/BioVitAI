import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile),
  MAX = 256 * 1024 * 1024;
function password(value) {
  if (typeof value !== 'string' || value.length < 24)
    throw new Error(
      'A separate backup passphrase of at least 24 characters is required',
    );
  return value;
}
function safeTarget(root, name) {
  if (!/^[a-f0-9-]{36}\.bin$/.test(name))
    throw new Error('Invalid object name');
  const target = path.resolve(root, name);
  if (path.dirname(target) !== path.resolve(root))
    throw new Error('Invalid object path');
  return target;
}
async function binary(name) {
  if (process.env.PG_CLIENT_BIN_DIR)
    return path.join(
      process.env.PG_CLIENT_BIN_DIR,
      name + (process.platform === 'win32' ? '.exe' : ''),
    );
  if (process.platform === 'win32') {
    const local = path.resolve('.local/tools/postgres-client', name + '.exe');
    if (await fs.stat(local).catch(() => null)) return local;
  }
  if (process.platform !== 'win32') return name;
  const platform = { win32: 'windows', linux: 'linux', darwin: 'darwin' }[
    process.platform
  ];
  if (!platform) throw new Error('Unsupported platform');
  const tools = await import(`@embedded-postgres/${platform}-${process.arch}`);
  return path.join(
    path.dirname(tools.pg_ctl),
    name + (process.platform === 'win32' ? '.exe' : ''),
  );
}
function connection(config) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.PGHOST))
    throw new Error('Backup tools require loopback PostgreSQL');
  return [
    '--host',
    config.PGHOST,
    '--port',
    String(config.PGPORT),
    '--username',
    config.PGUSER,
    '--dbname',
    config.PGDATABASE,
  ];
}
export async function createPilotBackup({
  config,
  objectsDirectory,
  authSecret,
  passphrase,
  destination,
}) {
  password(passphrase);
  if (!authSecret || authSecret.length < 32)
    throw new Error('Application encryption key required');
  const dump = await execute(
    await binary('pg_dump'),
    [...connection(config), '--format=custom', '--no-owner', '--no-acl'],
    {
      env: { ...process.env, PGPASSWORD: config.PGPASSWORD },
      encoding: 'buffer',
      maxBuffer: MAX,
      timeout: 60000,
      windowsHide: true,
    },
  );
  const objects = [];
  let total = dump.stdout.length;
  for (const name of await fs.readdir(objectsDirectory)) {
    if (!name.endsWith('.bin')) continue;
    const target = safeTarget(objectsDirectory, name),
      stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('Unexpected object entry');
    total += stat.size;
    if (total > MAX) throw new Error('Pilot backup size limit');
    const bytes = await fs.readFile(target);
    objects.push({
      name,
      hash: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.toString('base64'),
    });
  }
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv(
      'aes-256-gcm',
      scryptSync(passphrase, salt, 32),
      iv,
    );
  cipher.setAAD(Buffer.from('BiovitAI-pilot-backup-v1'));
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      authSecret,
      createdAt: new Date().toISOString(),
      database: dump.stdout.toString('base64'),
      objects,
    }),
  );
  const encrypted = Buffer.concat([
    Buffer.from('BVBACK01'),
    salt,
    iv,
    cipher.update(payload),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  await fs.mkdir(path.dirname(path.resolve(destination)), {
    recursive: true,
    mode: 0o700,
  });
  await fs.writeFile(destination, encrypted, { flag: 'wx', mode: 0o600 });
  return { objects: objects.length, bytes: encrypted.length };
}
export async function readPilotBackup(file, passphrase) {
  password(passphrase);
  const stat = await fs.stat(file);
  if (stat.size > MAX * 2) throw new Error('Backup size limit');
  const data = await fs.readFile(file);
  if (data.subarray(0, 8).toString() !== 'BVBACK01')
    throw new Error('Unsupported backup');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    scryptSync(passphrase, data.subarray(8, 24), 32),
    data.subarray(24, 36),
  );
  cipher.setAAD(Buffer.from('BiovitAI-pilot-backup-v1'));
  cipher.setAuthTag(data.subarray(-16));
  const payload = JSON.parse(
    Buffer.concat([
      cipher.update(data.subarray(36, -16)),
      cipher.final(),
    ]).toString('utf8'),
  );
  if (
    payload.version !== 1 ||
    !Array.isArray(payload.objects) ||
    typeof payload.authSecret !== 'string' ||
    typeof payload.database !== 'string'
  )
    throw new Error('Invalid backup manifest');
  return payload;
}
export async function restorePilotBackup({
  file,
  passphrase,
  config,
  objectsDirectory,
  isolatedRoot,
}) {
  const root = path.resolve(isolatedRoot),
    allowed = path.resolve('.local/tests');
  const relative = path.relative(allowed, root);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Restore is restricted to an isolated test environment');
  const pid = (
    await fs.readFile(path.join(root, 'postmaster.pid'), 'utf8')
  ).split(/\r?\n/);
  if (
    path.resolve(pid[1] ?? '') !== root ||
    Number(pid[3]) !== Number(config.PGPORT) ||
    config.PGDATABASE !== 'postgres'
  )
    throw new Error(
      'Restore connection must match the dedicated isolated cluster',
    );
  const target = path.resolve(objectsDirectory),
    inside = path.relative(root, target);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside))
    throw new Error('Invalid isolated object destination');
  const payload = await readPilotBackup(file, passphrase);
  await fs.mkdir(target, { recursive: true, mode: 0o700 });
  if ((await fs.readdir(target)).length)
    throw new Error('Restore target must be empty');
  const dump = path.join(root, 'restore.dump');
  await fs.writeFile(dump, Buffer.from(payload.database, 'base64'), {
    flag: 'wx',
    mode: 0o600,
  });
  // No --clean: existing tables cause failure instead of overwriting a database.
  await execute(
    await binary('pg_restore'),
    [
      ...connection(config),
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
      dump,
    ],
    {
      env: { ...process.env, PGPASSWORD: config.PGPASSWORD },
      maxBuffer: 16384,
      timeout: 60000,
      windowsHide: true,
    },
  );
  for (const object of payload.objects) {
    const bytes = Buffer.from(object.bytes, 'base64');
    if (createHash('sha256').update(bytes).digest('hex') !== object.hash)
      throw new Error('Object checksum mismatch');
    await fs.writeFile(safeTarget(target, object.name), bytes, {
      flag: 'wx',
      mode: 0o600,
    });
  }
  await fs.unlink(dump);
  return { authSecret: payload.authSecret, objects: payload.objects.length };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { readRuntimeConfig } =
    await import('../dist/infrastructure/config/runtime.js');
  try {
    const result = await createPilotBackup({
      config: readRuntimeConfig(process.env),
      objectsDirectory: path.resolve('.local/private-objects'),
      authSecret: process.env.AUTH_SECRET,
      passphrase: process.env.BACKUP_PASSPHRASE,
      destination: path.resolve(
        '.local/backups',
        new Date().toISOString().replaceAll(':', '-') + '.bvbackup',
      ),
    });
    console.log(JSON.stringify({ event: 'backup.created', ...result }));
  } catch {
    console.error(
      'Backup unavailable. Check local configuration, independent passphrase and destination.',
    );
    process.exitCode = 1;
  }
}
