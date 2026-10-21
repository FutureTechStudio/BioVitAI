import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile),
  root = path.resolve('.local/android-tools'),
  config = JSON.parse(
    await fs.readFile(path.join(root, 'environment.json'), 'utf8'),
  ),
  adb = path.join(config.sdk, 'platform-tools/adb.exe');
const command = (args) =>
  run(adb, ['-e', ...args], {
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16384,
  });
await command([
  'install',
  '-r',
  path.resolve('apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
]);
await command(['reverse', 'tcp:3001', 'tcp:3001']);
await command(['reverse', 'tcp:8081', 'tcp:8081']);
await command(['shell', 'am', 'force-stop', 'com.biovitai.pilot']);
await command([
  'shell',
  'run-as',
  'com.biovitai.pilot',
  'mkdir',
  '-p',
  'shared_prefs',
]);
const preferences = path.join(root, 'debug-preferences.xml');
await fs.writeFile(
  preferences,
  '<?xml version="1.0" encoding="utf-8"?><map><string name="debug_http_host">127.0.0.1:8081</string></map>',
);
await command([
  'push',
  preferences,
  '/data/local/tmp/biovitai-debug-preferences.xml',
]);
await command([
  'shell',
  'run-as',
  'com.biovitai.pilot',
  'cp',
  '/data/local/tmp/biovitai-debug-preferences.xml',
  'shared_prefs/com.biovitai.pilot_preferences.xml',
]);
await command([
  'shell',
  'am',
  'start',
  '-n',
  'com.biovitai.pilot/.MainActivity',
]);
console.log('Debug APK installed with loopback API and Metro forwarding.');
