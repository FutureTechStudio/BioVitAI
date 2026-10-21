import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const config = JSON.parse(
  await fs.readFile('.local/android-tools/environment.json', 'utf8'),
);
const env = {
  ...process.env,
  JAVA_HOME: config.javaHome,
  ANDROID_HOME: config.sdk,
  ANDROID_SDK_ROOT: config.sdk,
  PATH: path.join(config.javaHome, 'bin') + path.delimiter + process.env.PATH,
  CI: '1',
};
async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Android build failed')),
    );
  });
}
await run(
  process.execPath,
  [
    '../../node_modules/expo/bin/cli',
    'prebuild',
    '--platform',
    'android',
    '--no-install',
  ],
  path.resolve('apps/mobile'),
);
await run(
  'cmd.exe',
  ['/d', '/c', 'gradlew.bat assembleDebug --no-daemon'],
  path.resolve('apps/mobile/android'),
);
console.log(
  'Debug APK: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk',
);
