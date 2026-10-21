import fs from 'node:fs/promises';
import { openSync } from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const execute = promisify(execFile),
  config = JSON.parse(
    await fs.readFile('.local/android-tools/environment.json', 'utf8'),
  ),
  root = path.resolve('.local/android-tools'),
  avd = path.join(root, 'avd');
await fs.mkdir(avd, { recursive: true });
const env = {
  ...process.env,
  JAVA_HOME: config.javaHome,
  ANDROID_HOME: config.sdk,
  ANDROID_SDK_ROOT: config.sdk,
  ANDROID_AVD_HOME: avd,
};
if (!(await fs.stat(path.join(avd, 'BiovitAI_Pilot.ini')).catch(() => null)))
  await new Promise((resolve, reject) => {
    const manager = path.join(
        config.sdk,
        'cmdline-tools/13.0/bin/avdmanager.bat',
      ),
      command = `"${manager}" create avd --name BiovitAI_Pilot --package "system-images;android-36;google_apis;x86_64" --device pixel_7`;
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${command}"`], {
      env,
      windowsHide: true,
      windowsVerbatimArguments: true,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.stdin.end('no\n');
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('AVD provisioning failed')),
    );
  });
const log = openSync(path.join(root, 'emulator.log'), 'a');
const emulator = spawn(
  path.join(config.sdk, 'emulator/emulator.exe'),
  [
    '-avd',
    'BiovitAI_Pilot',
    '-no-window',
    '-no-audio',
    '-no-boot-anim',
    '-gpu',
    'swiftshader',
    '-memory',
    '4096',
    '-cores',
    '4',
    '-no-snapshot-save',
    '-no-snapshot-load',
    '-skin',
    '720x1280',
    '-feature',
    '-Vulkan',
  ],
  { env, windowsHide: true, detached: true, stdio: ['ignore', log, log] },
);
emulator.unref();
const adb = path.join(config.sdk, 'platform-tools/adb.exe');
console.log('Android emulator starting in the background');
for (let attempt = 0; attempt < 100; attempt++) {
  await delay(3000);
  try {
    const result = await execute(
      adb,
      ['-e', 'shell', 'getprop', 'sys.boot_completed'],
      { env, windowsHide: true, timeout: 3000 },
    );
    if (result.stdout.trim() === '1') {
      await execute(adb, ['-e', 'shell', 'wm', 'density', '320'], {
        windowsHide: true,
      });
      await execute(adb, ['-e', 'reverse', 'tcp:3001', 'tcp:3001'], {
        windowsHide: true,
      });
      await execute(adb, ['-e', 'reverse', 'tcp:8081', 'tcp:8081'], {
        windowsHide: true,
      });
      console.log('Emulator ready; API and Metro ports forwarded over adb.');
      process.exit(0);
    }
  } catch {
    /* booting */
  }
}
throw new Error('Emulator boot deadline; inspect the local emulator log');
