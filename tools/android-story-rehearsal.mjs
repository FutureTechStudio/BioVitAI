// Automated local synthetic rehearsal. Logs steps, never credentials or medical payloads.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const execute = promisify(execFile),
  root = path.resolve('.local/android-tools');
const environment = JSON.parse(
  await fs.readFile(path.join(root, 'environment.json'), 'utf8'),
);
const adb = path.join(environment.sdk, 'platform-tools/adb.exe');
const demo = JSON.parse(await fs.readFile('.local/demo-account.json', 'utf8'));
if (demo.purpose !== 'local synthetic demo only')
  throw Error('Dedicated synthetic demo required');
const evidence = path.resolve(
  'documentation/design-system/evidence/health-story-2026-10-22',
);
await fs.mkdir(evidence, { recursive: true });
async function command(args, binary = false) {
  try {
    return await execute(adb, ['-e', ...args], {
      windowsHide: true,
      timeout: 30000,
      maxBuffer: binary ? 8388608 : 1048576,
      ...(binary ? { encoding: 'buffer' } : {}),
    });
  } catch {
    throw Error('Android command failed');
  }
}
const decode = (s) =>
  s
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#10;', '\n');
async function nodes() {
  await command(['shell', 'uiautomator', 'dump', '/sdcard/biovitai-story.xml']);
  const xml = (await command(['exec-out', 'cat', '/sdcard/biovitai-story.xml']))
    .stdout;
  await fs.writeFile(path.join(root, 'story-ui.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map((m) =>
    Object.fromEntries(
      [...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [
        a[1],
        decode(a[2]),
      ]),
    ),
  );
}
const match = (n, label) =>
  n.text === label ||
  n['content-desc'] === label ||
  n.hint === label ||
  (label === 'Choose profile' &&
    n['content-desc']?.startsWith('Choose profile,'));
const box = (n) => n.bounds.match(/\d+/g).map(Number);
async function find(label, input = false) {
  const list = await nodes();
  return list.find(
    (n) =>
      match(n, label) &&
      n.enabled !== 'false' &&
      (!input || n.class === 'android.widget.EditText'),
  );
}
async function wait(label, timeout = 30000, input = false) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const n = await find(label, input);
    if (n) return n;
    await delay(400);
  }
  throw Error(
    'Android control unavailable: ' +
      (label === 'Password' ? 'password field' : label),
  );
}
async function tap(label, input = false) {
  await wait(label, 30000, input);
  await delay(600);
  const b = box(await wait(label, 10000, input));
  await command([
    'shell',
    'input',
    'swipe',
    String(Math.round((b[0] + b[2]) / 2)),
    String(Math.round((b[1] + b[3]) / 2)),
    String(Math.round((b[0] + b[2]) / 2)),
    String(Math.round((b[1] + b[3]) / 2)),
    '150',
  ]);
}
async function scrollTo(label, input = false) {
  await record('locating control: ' + label);
  // Native keyboard resize can reposition the form after submission. Starting
  // each field search at the top prevents skipping a field that moved above it.
  if (input) await top();
  for (let i = 0; i < 22; i++) {
    const list = await nodes();
    const n = list.find(
      (n) =>
        match(n, label) &&
        n.enabled !== 'false' &&
        (!input || n.class === 'android.widget.EditText'),
    );
    if (n) {
      const b = box(n);
      if (b[3] - b[1] >= 30 && b[1] >= 100 && b[3] <= 1240) return;
    }
    const scroll = list.find((n) => n.scrollable === 'true'),
      viewport = scroll ? box(scroll) : [0, 200, 720, 1200];
    const from = Math.min(1100, viewport[3] - 25),
      to = Math.max(viewport[1] + 30, from - 480);
    await command([
      'shell',
      'input',
      'swipe',
      '360',
      String(from),
      '360',
      String(to),
      '250',
    ]);
    await delay(200);
  }
  throw Error('Android scroll target unavailable: ' + label);
}
async function top() {
  for (let i = 0; i < 9; i++)
    await command([
      'shell',
      'input',
      'swipe',
      '360',
      '430',
      '360',
      '1090',
      '100',
    ]);
}
async function fill(label, value) {
  if (!/^[A-Za-z0-9@._!%-]+$/.test(value))
    throw Error('Unsafe synthetic input');
  await scrollTo(label, true);
  await tap(label, true);
  await delay(400);
  if ((await find(label, true))?.focused !== 'true')
    throw Error('Android input did not receive focus: ' + label);
  await command([
    'shell',
    'input',
    'keycombination',
    'KEYCODE_CTRL_LEFT',
    'KEYCODE_A',
  ]);
  await command(['shell', 'input', 'keyevent', 'KEYCODE_DEL']);
  // A native Modal's EditText is outside Activity.currentFocus. RN's debug
  // double-R recognizer can therefore reload JS during fast adb typing.
  // Separate R-bearing chunks beyond its installed 200 ms shortcut window.
  for (const chunk of value.match(/[^rR]*[rR]|[^rR]+$/g) ?? []) {
    await command(['shell', 'input', 'text', chunk]);
    if (/[rR]$/.test(chunk)) await delay(250);
  }
  // The modal exposes an explicit dismissal control. Hardware Enter is not
  // an IME action on every multiline field; Back/Escape can close the Modal.
  if (label === 'Email address' || label === 'Password')
    await command(['shell', 'input', 'keyevent', 'KEYCODE_ENTER']);
  else await tap('Hide keyboard');
  await delay(1000);
  await record('completed input: ' + label);
  if (label === 'Record name' || label === 'Details as reported or recorded')
    await fs.writeFile(
      path.join(
        root,
        label === 'Record name' ? 'editor-name.png' : 'editor-details.png',
      ),
      (await command(['exec-out', 'screencap', '-p'], true)).stdout,
    );
}
async function waitClosed(label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (!(await find(label))) return;
    await delay(300);
  }
  throw Error('Native panel did not close');
}
const steps = [];
async function record(step, capture) {
  steps.push(step);
  console.log(JSON.stringify({ event: 'android.story', step }));
  await fs.writeFile(
    path.join(root, 'story-rehearsal.json'),
    JSON.stringify(
      { kind: 'automated synthetic emulator rehearsal', steps },
      null,
      2,
    ),
  );
  if (capture)
    await fs.writeFile(
      path.join(evidence, capture + '.png'),
      (await command(['exec-out', 'screencap', '-p'], true)).stdout,
    );
}
const origin = 'http://127.0.0.1:3001';
let cookie = '',
  context;
async function api(route, body) {
  const r = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(context
        ? {
            'x-profile-id': context.profileId,
            'x-context-revision': String(context.revision),
          }
        : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) throw Error('Synthetic API check failed: ' + r.status);
  return r;
}
async function snapshot() {
  return (await api('/v1/health/journey')).json();
}
let originalFont;
try {
  await record('launching the local synthetic health-story rehearsal');
  await command(['reverse', 'tcp:3001', 'tcp:3001']);
  await command(['reverse', 'tcp:8081', 'tcp:8081']);
  await command(['shell', 'am', 'force-stop', 'com.biovitai.pilot']);
  await command([
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    'com.biovitai.pilot/.MainActivity',
  ]);
  const deadline = Date.now() + 150000;
  let initial = [];
  while (Date.now() < deadline) {
    initial = await nodes();
    if (initial.some((n) => match(n, 'Sign out') || match(n, 'Email address')))
      break;
    await delay(500);
  }
  if (!initial.some((n) => match(n, 'Sign out') || match(n, 'Email address')))
    throw Error(
      'Application did not become ready; check the local Metro bundle',
    );
  if (initial.some((n) => match(n, 'Sign out'))) await tap('Sign out');
  await fill('Email address', demo.account.email);
  await fill('Password', demo.account.password);
  await tap('Sign in');
  await wait('Choose profile');
  await tap('Choose profile');
  await tap('Alex Demo · Me');
  await scrollTo('Open my health story');
  await tap('Open my health story');
  await wait('Add health context');
  await record(
    'native authenticated health story and timeline',
    'android-story',
  );
  await tap('Add health context');
  await wait('Close context editor');
  await tap('Record type: Medicines');
  const name = 'AndroidStory' + randomUUID().slice(0, 6);
  await fill('Record name', name);
  await fill(
    'Details as reported or recorded',
    'Synthetic%sreported%smedicine%sfor%snative%stest',
  );
  await fill('Effective from (optional)', '2024-03');
  await scrollTo('Confirm reported or transcribed context');
  await tap('Confirm reported or transcribed context');
  await scrollTo('Save health context');
  await tap('Save health context');
  await waitClosed('Close context editor');
  const login = await api('/api/auth/sign-in/email', demo.account);
  cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const selected = await (
    await api('/v1/profile-context', {
      profileId: demo.profiles.find((p) => p.displayName === 'Alex Demo').id,
      expectedRevision: 0,
    })
  ).json();
  context = { profileId: selected.profile.id, revision: selected.revision };
  const created = (await snapshot()).records.find(
    (r) => r.content?.information.label === name,
  );
  if (
    !created ||
    created.revision !== 1 ||
    created.content.information.kind !== 'medication' ||
    created.content.start.precision !== 'month'
  )
    throw Error('Native context did not persist with approximate date');
  await record(
    'native reported medicine saved with approximate date and attribution',
  );
  await top();
  await tap('Personal context');
  await scrollTo('Context category: Medicines');
  await tap('Context category: Medicines');
  await scrollTo('Correct record: ' + name);
  await tap('Correct record: ' + name);
  await wait('Close context editor');
  await fill(
    'Details as reported or recorded',
    'Synthetic%scorrected%snative%srecord',
  );
  await fill('Correction reason', 'Synthetic%srevision%srehearsal');
  await scrollTo('Confirm reported or transcribed context');
  await tap('Confirm reported or transcribed context');
  await scrollTo('Save corrected record');
  await tap('Save corrected record');
  await waitClosed('Close context editor');
  if (
    (await snapshot()).records.find((r) => r.id === created.id)?.revision !== 2
  )
    throw Error('Native correction did not append revision');
  await top();
  await tap('Personal context');
  await scrollTo('Context category: Medicines');
  await tap('Context category: Medicines');
  await scrollTo('View revision history: ' + name);
  await tap('View revision history: ' + name);
  await wait('Close revision history');
  await record(
    'native append correction and revision history',
    'android-history',
  );
  await tap('Close revision history');
  await top();
  await tap('Timeline');
  await scrollTo('Inspect source · page 1');
  await tap('Inspect source · page 1');
  await scrollTo('Zoom in source page');
  await tap('Zoom in source page');
  await wait('Source zoom: 150%');
  await tap('Zoom in source page');
  await wait('Source zoom: 200%');
  await scrollTo('Original report source page');
  const zoomedBounds = box(await wait('Original report source page')),
    sourceY = String(
      Math.max(
        400,
        Math.min(1050, Math.round((zoomedBounds[1] + zoomedBounds[3]) / 2)),
      ),
    );
  await command([
    'shell',
    'input',
    'swipe',
    '600',
    sourceY,
    '100',
    sourceY,
    '450',
  ]);
  await top();
  await scrollTo('Reset source page zoom');
  await tap('Reset source page zoom');
  await wait('Source zoom: 100%');
  await scrollTo('Original report source page');
  const resetBounds = box(await wait('Original report source page'));
  if (resetBounds[2] - resetBounds[0] < 600)
    throw Error('Source reset did not restore the full emulator page');
  await record(
    'native exact source-page navigation and preview',
    'android-source',
  );
  await command(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  await tap('Choose profile');
  await tap('Maya Demo · Family');
  await wait('Add health context');
  if ((await nodes()).some((n) => match(n, name)))
    throw Error('Previous subject remained visible');
  await record(
    'native family switch clears prior story and editor',
    'android-family-story',
  );
  originalFont = (
    await command(['shell', 'settings', 'get', 'system', 'font_scale'])
  ).stdout.trim();
  await command(['shell', 'settings', 'put', 'system', 'font_scale', '1.5']);
  await delay(1500);
  await top();
  await scrollTo('Add health context');
  await wait('Add health context');
  await wait('Choose profile');
  await record(
    'native 150 percent text retains story and profile controls',
    'android-story-large-text',
  );
  console.log(
    JSON.stringify({ event: 'android.story.complete', steps: steps.length }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'android.story.failed',
      reason:
        error instanceof Error ? error.message : 'Native rehearsal failed',
    }),
  );
  process.exitCode = 1;
} finally {
  if (originalFont)
    await command([
      'shell',
      'settings',
      'put',
      'system',
      'font_scale',
      originalFont,
    ]);
}
