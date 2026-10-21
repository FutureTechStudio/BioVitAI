import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const root = path.resolve('.local/tools/postgres-client');
await fs.mkdir(root, { recursive: true });
const source = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609';
const response = await fetch(source);
if (
  !response.ok ||
  !['get.enterprisedb.com', 'sbp.enterprisedb.com'].includes(
    new URL(response.url).hostname,
  ) ||
  !response.body
)
  throw new Error('Official PostgreSQL client archive unavailable');
const archive = path.join(root, 'postgresql.zip');
console.log('Downloading official PostgreSQL 18 client utilities');
await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
const sha256 = hash.digest('hex');
await promisify(execFile)(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive=[System.IO.Compression.ZipFile]::OpenRead('${archive.replaceAll("'", "''")}'); $target='${root.replaceAll("'", "''")}'; foreach($entry in $archive.Entries) { if($entry.FullName -match '^pgsql/bin/([^/]+\\.dll|pg_dump\\.exe|pg_restore\\.exe)$') { $destination=Join-Path $target ([IO.Path]::GetFileName($entry.FullName)); [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$destination,$true) } }; $archive.Dispose()`,
  ],
  { windowsHide: true, timeout: 120000, maxBuffer: 16000 },
);
await fs.access(path.join(root, 'pg_dump.exe'));
await fs.access(path.join(root, 'pg_restore.exe'));
await fs.writeFile(
  path.join(root, 'provenance.json'),
  JSON.stringify(
    {
      source,
      resolved: response.url,
      sha256,
      version: '18.6',
      downloadedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  'PostgreSQL client utilities ready. Download digest recorded locally.',
);
