import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const root = path.resolve('.local/tools/clamav');
const bin = path.join(root, 'clamav-1.5.4.win.x64');
if (process.platform !== 'win32')
  throw new Error(
    'Install clamscan and Poppler using the OS package manager, then set CLAMSCAN_PATH and POPPLER_BIN_DIR if needed.',
  );
await fs.mkdir(root, { recursive: true });
const zip = path.join(root, 'clamav.zip');
const url =
  'https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.win.x64.zip';
const expected =
  '0d9e0228b2674137ea1a2853566c98a0278ad52ab2582c3d6dbd75373848c395';
try {
  await fs.access(path.join(bin, 'clamscan.exe'));
} catch {
  console.log('Downloading pinned ClamAV portable tools');
  const response = await fetch(url);
  if (!response.ok) throw new Error('ClamAV download failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('ClamAV checksum mismatch');
  await fs.writeFile(zip, bytes);
  await exec(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `Expand-Archive -LiteralPath '${zip.replaceAll("'", "''")}' -DestinationPath '${root.replaceAll("'", "''")}' -Force`,
    ],
    { windowsHide: true, timeout: 120000 },
  );
}
const database = path.join(root, 'database');
await fs.mkdir(database, { recursive: true });
const conf = path.join(root, 'freshclam.conf');
await fs.writeFile(
  conf,
  `DatabaseDirectory ${database}\nDatabaseMirror database.clamav.net\nChecks 1\n`,
);
console.log('Updating official ClamAV signatures');
await new Promise((resolve, reject) => {
  const child = spawn(
    path.join(bin, 'freshclam.exe'),
    ['--quiet', '--config-file=' + conf],
    { windowsHide: true, stdio: 'ignore' },
  );
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error('Signature update timed out'));
  }, 300000);
  child.once('error', () => {
    clearTimeout(timer);
    reject(new Error('Signature updater unavailable'));
  });
  child.once('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) resolve();
    else
      reject(
        new Error(
          'Signature update failed; report scanner remains unavailable',
        ),
      );
  });
});
console.log(
  'ClamAV configured. Report processing uses local signatures; no report is uploaded to the scanner vendor.',
);
