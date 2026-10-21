import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDirectory = path.join(root, '.local/native-postgres');
const platform = { win32: 'windows', linux: 'linux', darwin: 'darwin' }[
  process.platform
];

async function control(args) {
  if (!platform) throw new Error('Unsupported native PostgreSQL platform');
  const binary = await import(`@embedded-postgres/${platform}-${process.arch}`);
  return new Promise((resolve, reject) => {
    // Wait for pg_ctl itself, not pipe closure inherited by a detached Windows server.
    const child = spawn(binary.pg_ctl, args, {
      windowsHide: true,
      stdio: 'ignore',
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('PostgreSQL control deadline'));
    }, 20000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else
        reject(Object.assign(new Error('PostgreSQL control failed'), { code }));
    });
  });
}

function validateDirectory(directory) {
  const relative = path.relative(
    path.join(root, '.local'),
    path.resolve(directory),
  );
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(
      'Native PostgreSQL directory must be inside this workspace .local folder',
    );
}

export async function startNativePostgres(port, directory = defaultDirectory) {
  validateDirectory(directory);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid PostgreSQL port');
  // pg_ctl detaches the server from the terminal, including on Windows.
  await control([
    'start',
    '-D',
    directory,
    '-o',
    `-h 127.0.0.1 -p ${port}`,
    '-l',
    path.join(path.dirname(directory), `${path.basename(directory)}.log`),
    '-w',
    '-t',
    '15',
  ]);
}

export async function stopNativePostgres(directory = defaultDirectory) {
  validateDirectory(directory);
  try {
    await fs.access(path.join(directory, 'postmaster.pid'));
  } catch {
    return;
  }
  try {
    await control(['status', '-D', directory]);
  } catch (error) {
    if (error.code === 3) return;
    throw error;
  }
  // pg_ctl targets this workspace's data directory and performs a clean shutdown.
  await control(['stop', '-D', directory, '-m', 'fast', '-w', '-t', '10']);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  stopNativePostgres()
    .then(() => console.log('Local native PostgreSQL stopped; data preserved.'))
    .catch(() => {
      console.error(
        'Could not stop this workspace native PostgreSQL cluster. Data preserved.',
      );
      process.exitCode = 1;
    });
}
