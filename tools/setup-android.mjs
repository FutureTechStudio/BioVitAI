import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile),
  root = path.resolve('.local/android-tools');
if (process.platform !== 'win32')
  throw new Error('This portable setup targets the current Windows workspace.');
await fs.mkdir(root, { recursive: true });
async function download(url, file, hash, algorithm = 'sha256') {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Tool download failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (createHash(algorithm).update(bytes).digest('hex') !== hash)
    throw new Error('Tool checksum mismatch');
  await fs.writeFile(file, bytes);
}
async function unpack(file, directory) {
  await fs.mkdir(directory, { recursive: true });
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `Expand-Archive -LiteralPath '${file.replaceAll("'", "''")}' -DestinationPath '${directory.replaceAll("'", "''")}' -Force`,
    ],
    { windowsHide: true, timeout: 120000 },
  );
}
const assets = await (
  await fetch(
    'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse',
  )
).json();
const jdkPackage = assets[0].binary.package,
  jdkRoot = path.join(root, 'jdk');
if (!(await fs.stat(jdkRoot).catch(() => null))) {
  console.log('Provisioning portable Java 17');
  const archive = path.join(root, 'jdk.zip');
  await download(jdkPackage.link, archive, jdkPackage.checksum);
  await unpack(archive, jdkRoot);
}
const jdkFolder = (await fs.readdir(jdkRoot, { withFileTypes: true })).find(
  (e) => e.isDirectory() && e.name.startsWith('jdk-'),
)?.name;
if (!jdkFolder) throw new Error('JDK layout unavailable');
const javaHome = path.join(jdkRoot, jdkFolder);
const xml = await (
  await fetch('https://dl.google.com/android/repository/repository2-1.xml')
).text();
const block = xml.match(
  /<remotePackage path="cmdline-tools;13.0"[\s\S]*?<\/remotePackage>/,
)?.[0];
const archive = [
  ...(block ?? '').matchAll(/<archive>[\s\S]*?<\/archive>/g),
].find((m) => m[0].includes('<host-os>windows</host-os>'))?.[0];
const url = archive?.match(/<url>([^<]+)<\/url>/)?.[1],
  checksum = archive?.match(/<checksum[^>]*>([^<]+)<\/checksum>/)?.[1];
if (!url || !checksum)
  throw new Error('Official Android command-line metadata unavailable');
const sdk = path.join(root, 'sdk'),
  commandRoot = path.join(sdk, 'cmdline-tools', '13.0');
if (
  !(await fs
    .stat(path.join(commandRoot, 'bin', 'sdkmanager.bat'))
    .catch(() => null))
) {
  console.log('Provisioning Android command-line tools');
  const zip = path.join(root, 'android-command-tools.zip');
  await download(
    'https://dl.google.com/android/repository/' + url,
    zip,
    checksum,
    checksum.length === 40 ? 'sha1' : 'sha256',
  );
  const staging = path.join(root, 'command-tools');
  await unpack(zip, staging);
  await fs.cp(path.join(staging, 'cmdline-tools'), commandRoot, {
    recursive: true,
  });
}
const sdkmanager = path.join(commandRoot, 'bin', 'sdkmanager.bat');
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
};
async function manager(args, accept = false) {
  await new Promise((resolve, reject) => {
    const command = `"${sdkmanager}" --sdk_root="${sdk}" ${args}`;
    let tail = '';
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${command}"`], {
      env,
      windowsHide: true,
      windowsVerbatimArguments: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const capture = (chunk) => {
      tail = (tail + chunk.toString()).slice(-4000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', () => reject(new Error('SDK manager unavailable')));
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Android SDK provisioning failed: ' + tail)),
    );
    child.stdin.end(accept ? 'y\n'.repeat(100) : '');
  });
}
console.log(
  'Preparing Android SDK packages for the requested local development build',
);
await manager('--licenses', true);
await manager(
  '"platform-tools" "platforms;android-36" "build-tools;36.0.0" "emulator" "system-images;android-36;google_apis;x86_64"',
  true,
);
await fs.writeFile(
  path.join(root, 'environment.json'),
  JSON.stringify(
    { javaHome, sdk, jdkSource: jdkPackage.link, commandToolsSource: url },
    null,
    2,
  ),
);
console.log(
  'Android SDK and portable JDK are ready; environment paths recorded locally.',
);
