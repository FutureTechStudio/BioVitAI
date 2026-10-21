import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
const execute = promisify(execFile),
  root = path.resolve('.local/android-tools'),
  config = JSON.parse(
    await fs.readFile(path.join(root, 'environment.json'), 'utf8'),
  ),
  adb = path.join(config.sdk, 'platform-tools/adb.exe'),
  origin = 'http://127.0.0.1:3001';
let lastCommand = 'setup';
let lastControl = 'setup';
let changedFont = false;
const command = (args) => {
  lastCommand = args.slice(0, 3).join(' ');
  return execute(adb, ['-e', ...args], {
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1048576,
  });
};
const steps = [];
const runId = randomUUID();
async function record(step) {
  steps.push({ step, at: new Date().toISOString() });
  await fs.writeFile(
    path.join(root, 'rehearsal.json'),
    JSON.stringify({ kind: 'automated synthetic rehearsal', steps }, null, 2),
  );
  const history = path.join(root, 'rehearsals');
  await fs.mkdir(history, { recursive: true });
  await fs.writeFile(
    path.join(history, runId + '.json'),
    JSON.stringify({ kind: 'automated synthetic rehearsal', steps }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ event: 'android.rehearsal', step }));
}
function decode(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#10;', '\n');
}
async function snapshot() {
  await command([
    'shell',
    'uiautomator',
    'dump',
    '/sdcard/biovitai-rehearsal.xml',
  ]);
  const xml = (
    await command(['exec-out', 'cat', '/sdcard/biovitai-rehearsal.xml'])
  ).stdout;
  await fs.writeFile(path.join(root, 'rehearsal-ui.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [
        a[1],
        decode(a[2]),
      ]),
    ),
  );
}
const matches = (node, label) =>
  node.text === label ||
  node['content-desc'] === label ||
  node.hint === label ||
  (label === 'Choose profile' &&
    node['content-desc']?.startsWith('Choose profile, '));
async function wait(label, timeout = 30000) {
  lastControl =
    label.startsWith('AndroidSynthetic') || label.startsWith('Signed in as ')
      ? 'generated family entry'
      : label;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const nodes = await snapshot(),
      node = nodes.find((n) => matches(n, label) && n.enabled !== 'false');
    if (node) return node;
    await delay(500);
  }
  throw new Error('Native expected control unavailable: ' + label);
}
async function tap(label) {
  // A modal may expose its accessibility node before its slide animation finishes.
  // Re-read bounds after settling so input is sent to the final control position.
  await wait(label);
  await delay(800);
  const node = await wait(label),
    box = node.bounds.match(/\d+/g).map(Number);
  console.log(
    JSON.stringify({
      event: 'android.control',
      control: label.startsWith('AndroidSynthetic')
        ? 'generated family entry'
        : label,
      bounds: box,
    }),
  );
  await command([
    'shell',
    'input',
    'swipe',
    String(Math.round((box[0] + box[2]) / 2)),
    String(Math.round((box[1] + box[3]) / 2)),
    String(Math.round((box[0] + box[2]) / 2)),
    String(Math.round((box[1] + box[3]) / 2)),
    '150',
  ]);
}
async function navigate(label, next) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await tap(label);
    try {
      await wait(next, 10000);
      return;
    } catch (error) {
      if (attempt === 2 || !(await snapshot()).some((n) => matches(n, label)))
        throw error;
    }
  }
}
async function scrollTo(label) {
  lastControl = label;
  for (let attempt = 0; attempt < 12; attempt++) {
    const node = (await snapshot()).find((n) => matches(n, label));
    if (node) {
      const box = node.bounds.match(/\d+/g).map(Number);
      if (box[3] - box[1] >= 30 && box[1] >= 140 && box[3] < 1220) return;
    }
    const scroller = (await snapshot()).find((n) => n.scrollable === 'true');
    const viewport = scroller?.bounds.match(/\d+/g).map(Number) ?? [
      0, 280, 720, 1140,
    ];
    const start = Math.min(1050, viewport[3] - 30),
      end = Math.max(viewport[1] + 30, start - 500);
    await command([
      'shell',
      'input',
      'swipe',
      '360',
      String(start),
      '360',
      String(end),
      '400',
    ]);
    await delay(400);
  }
  throw new Error('Native scroll target unavailable');
}
async function top() {
  for (let i = 0; i < 7; i++)
    await command([
      'shell',
      'input',
      'swipe',
      '360',
      '450',
      '360',
      '1050',
      '150',
    ]);
}
async function fill(label, text) {
  if (!/^[A-Za-z0-9@._%-]+$/.test(text)) throw new Error('Unsafe test input');
  await scrollTo(label);
  await tap(label);
  await delay(300);
  const target = (await snapshot()).find((n) => matches(n, label));
  if (target && target.focused !== 'true')
    throw new Error('Expected native input did not receive focus');
  await command([
    'shell',
    'input',
    'keycombination',
    'KEYCODE_CTRL_LEFT',
    'KEYCODE_A',
  ]);
  await command(['shell', 'input', 'keyevent', 'KEYCODE_DEL']);
  await command(['shell', 'input', 'text', text]);
  // The app's fields use blurAndSubmit. Done dismisses the IME without a Back
  // event that could accidentally leave the form or close the application.
  await command(['shell', 'input', 'keyevent', 'KEYCODE_ENTER']);
  await delay(600);
  if (label !== 'Password') {
    await scrollTo(label);
    const entered = (await snapshot()).find((n) => matches(n, label));
    if (entered?.text !== text.replaceAll('%s', ' '))
      throw new Error(
        'Native input value did not match the controlled fixture',
      );
  }
}
async function post(route, data, cookie) {
  const response = await fetch(origin + route, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!response.ok)
    throw new Error('Synthetic account setup failed: ' + response.status);
  return response;
}
try {
  if (process.argv.includes('--large-text-only')) {
    await command(['shell', 'settings', 'put', 'system', 'font_scale', '1.5']);
    changedFont = true;
  }
  const accountFile = path.join(root, 'synthetic-rehearsal-account.json');
  let account = await fs
    .readFile(accountFile, 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  const email = account?.email ?? `android-${randomUUID()}@example.test`,
    password =
      account?.password ?? 'BiovitAiPilot' + randomUUID().replaceAll('-', ''),
    name = 'AndroidSynthetic' + randomUUID().slice(0, 6);
  if (!account)
    await post('/api/auth/sign-up/email', {
      email,
      password,
      name,
      callbackURL: 'biovitai://auth',
    });
  let verification;
  for (const file of await fs.readdir('.local/auth-mailbox')) {
    if (!file.endsWith('.json')) continue;
    const item = JSON.parse(
      await fs.readFile(path.join('.local/auth-mailbox', file), 'utf8'),
    );
    if (item.recipient === email && item.kind === 'verification')
      verification = item.url;
  }
  if (!verification || new URL(verification).origin !== origin)
    throw new Error('Synthetic verification capture unavailable');
  await fetch(verification, { redirect: 'manual' });
  if (!account) {
    account = { email, password, purpose: 'synthetic test account only' };
    await fs.writeFile(accountFile, JSON.stringify(account), {
      mode: 0o600,
      flag: 'wx',
    });
  }
  await command(['shell', 'am', 'force-stop', 'com.biovitai.pilot']);
  await command([
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    'com.biovitai.pilot/.MainActivity',
  ]);
  await delay(1000);
  let initial = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    initial = await snapshot();
    if (
      initial.some((n) => matches(n, 'Sign out') || matches(n, 'Email address'))
    )
      break;
    await delay(300);
  }
  let resumedSession = initial.some((n) => matches(n, 'Sign out'));
  if (resumedSession) {
    await navigate('Choose profile', 'Add or manage family profiles →');
    resumedSession = (await snapshot()).some((n) =>
      matches(n, 'Signed in as ' + email),
    );
    await tap('Close');
    if (!resumedSession) await navigate('Sign out', 'Email address');
  }
  if (!resumedSession) {
    await fill('Email address', email);
    await fill('Password', password);
    await navigate('Sign in', 'Choose profile');
  }
  await wait('Choose profile');
  await record(
    resumedSession
      ? 'SecureStore session restored after cold launch'
      : 'native authentication and SecureStore session',
  );
  if (process.argv.includes('--large-text-only')) {
    await scrollTo('Upload report');
    let upload = await wait('Upload report');
    let bounds = upload.bounds.match(/\d+/g).map(Number);
    if (bounds[3] - bounds[1] < 88) {
      await command([
        'shell',
        'input',
        'swipe',
        '360',
        '1000',
        '360',
        '800',
        '300',
      ]);
      upload = await wait('Upload report');
      bounds = upload.bounds.match(/\d+/g).map(Number);
    }
    if (bounds[0] < 0 || bounds[2] > 720 || bounds[3] - bounds[1] < 88)
      throw Error('Native large-text action geometry failed');
    await record(
      'native 150 percent text retains visible profile controls and an accessible upload action',
    );
    await command(['shell', 'settings', 'put', 'system', 'font_scale', '1.0']);
    changedFont = false;
    process.exit(0);
  }
  if (process.argv.includes('--compare-only')) {
    for (const file of ['SyntheticTrendOne.png', 'SyntheticTrendTwo.png']) {
      await scrollTo('Select comparison report ' + file);
      await tap('Select comparison report ' + file);
    }
    await scrollTo('Compare verified results');
    await tap('Compare verified results');
    await scrollTo('Results remain distinct; no averaging is applied.');
    await wait('Results remain distinct; no averaging is applied.');
    await record('native comparison of two generated verified sources');
    await scrollTo(
      'Approximate trend chart. Exact dates, values and sources follow below.',
    );
    await record(
      'native comparable trend chart with exact source-linked values',
    );
    process.exit(0);
  }
  if (process.argv.includes('--caregiver-only')) {
    await navigate('Choose profile', 'Caregiver Shared Synthetic · Family');
    await tap('Caregiver Shared Synthetic · Family');
    await scrollTo('Open report SharedCaregiverSynthetic.png');
    await tap('Open report SharedCaregiverSynthetic.png');
    await tap('View source page 1');
    await wait('Original report source page');
    await record('native caregiver reads an authorized verified source');
    await execute(
      process.execPath,
      ['tools/seed-android-caregiver.mjs', '--revoke'],
      { windowsHide: true, timeout: 30000, maxBuffer: 4096 },
    );
    await wait('Select a profile first.', 30000);
    if (
      (await snapshot()).some(
        (n) =>
          matches(n, 'Original report source page') ||
          n.text?.includes('Caregiver Marker'),
      )
    )
      throw Error('Revoked native evidence remained visible');
    await record(
      'native caregiver revocation clears report values and source image',
    );
    await tap('Back');
    await navigate('Choose profile', 'Refresh profile access');
    await tap('Refresh profile access');
    const fixture = JSON.parse(
      await fs.readFile(path.join(root, 'caregiver-fixture.json'), 'utf8'),
    );
    await navigate('Choose profile', fixture.restoreProfileName + ' · Family');
    await tap(fixture.restoreProfileName + ' · Family');
    await record(
      'native owner profile restored after refreshing revoked access',
    );
    process.exit(0);
  }
  if (
    !process.argv.includes('--continue-review') &&
    !process.argv.includes('--continue-chat')
  ) {
    if (!process.argv.includes('--continue-upload')) {
      await navigate('Choose profile', 'Add or manage family profiles →');
      await navigate('Add or manage family profiles →', 'Family member name');
      await fill('Family member name', name);
      await navigate(
        'Add family member',
        'Family profile created. Select it using the profile picker.',
      );
      await tap('Choose profile');
      await tap(name + ' · Family');
      await tap('Back');
      await record('email-less family creation and active profile selection');
      await fs.writeFile(
        path.join(root, 'native-profile.json'),
        JSON.stringify({
          purpose: 'native synthetic family created by rehearsal',
          displayName: name,
        }),
      );
    }
    await scrollTo('Upload report');
    const svg =
        '<svg width="1200" height="400"><rect width="1200" height="400" fill="white"/><text x="40" y="80" font-family="Arial" font-size="36">Patient: Synthetic Subject</text><text x="40" y="170" font-family="Arial" font-size="36">Glucose 5.90 mmol/L</text></svg>',
      file = path.join(root, 'BiovitAI_Synthetic_Pilot.png');
    await sharp(Buffer.from(svg)).png().toFile(file);
    await command([
      'push',
      file,
      '/sdcard/Download/BiovitAI_Synthetic_Pilot.png',
    ]);
    await command([
      'shell',
      'am',
      'broadcast',
      '-a',
      'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
      '-d',
      'file:///sdcard/Download/BiovitAI_Synthetic_Pilot.png',
    ]);
    await tap('Upload report');
    await delay(1000);
    try {
      await wait('BiovitAI_Synthetic_Pilot.png', 10000);
    } catch {
      await navigate('Show roots', 'Downloads');
      await tap('Downloads');
    }
    await tap('BiovitAI_Synthetic_Pilot.png');
    await scrollTo(
      'Uploaded. Scanning and extraction must finish before verification.',
    );
    await wait(
      'Uploaded. Scanning and extraction must finish before verification.',
      30000,
    );
    await record('native document picker and authenticated binary upload');
  }
  await scrollTo('Open report BiovitAI_Synthetic_Pilot.png');
  await tap('Open report BiovitAI_Synthetic_Pilot.png');
  if (!process.argv.includes('--continue-chat')) {
    await wait('Identity confirmation reason', 180000);
    await fill(
      'Identity confirmation reason',
      'CheckedSyntheticSourceForSelectedFamily',
    );
    await scrollTo('I checked the source and confirm this person');
    await tap('I checked the source and confirm this person');
    await wait('Saved.');
    await scrollTo('Verification reason');
    await fill('Verification reason', 'CheckedOriginalSyntheticResult');
    await scrollTo('Verify result');
    await tap('Verify result');
    await top();
    await wait('verified · identity matched');
    await record(
      'native identity confirmation and verified observation publication',
    );
  }
  await top();
  await tap('View source page 1');
  await wait('Original report source page');
  await record('native source-page navigation');
  await tap('Back');
  await top();
  await tap('✳ Health assistant');
  await tap('Allow AI processing for this profile');
  await wait('Consent recorded.');
  await scrollTo('Ask about verified health evidence');
  await fill(
    'Ask about verified health evidence',
    'ExplainVerifiedSyntheticEvidence',
  );
  await scrollTo('Ask AI');
  await tap('Ask AI');
  await scrollTo('AI unavailable: PROVIDER_NOT_CONFIGURED');
  await wait('AI unavailable: PROVIDER_NOT_CONFIGURED');
  await top();
  await scrollTo('Withdraw AI consent');
  await tap('Withdraw AI consent');
  await wait('AI access requires current permission and health AI consent.');
  await record(
    'native chat consent, honest unconfigured provider and withdrawal',
  );
  await fs.writeFile(
    path.join(root, 'rehearsal.json'),
    JSON.stringify(
      {
        kind: 'automated synthetic rehearsal',
        steps,
        status:
          'Selected native phase passed. Recorded steps define this run; comparison, caregiver and large-text runs have separate records.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (changedFont)
    await command(['shell', 'settings', 'put', 'system', 'font_scale', '1.0']);
  if (
    error &&
    typeof error === 'object' &&
    error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
  )
    console.log(
      JSON.stringify({
        event: 'android.harness_output_limit',
        stdoutBytes: error.stdout?.length,
        stderrBytes: error.stderr?.length,
        xmlHeaders:
          typeof error.stdout === 'string'
            ? error.stdout.split('<?xml').length - 1
            : 0,
      }),
    );
  console.log(
    JSON.stringify({
      event: 'android.rehearsal_failure_location',
      command: lastCommand,
      control: lastControl,
      code:
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : 'ASSERTION',
      type: error instanceof Error ? error.name : 'unknown',
    }),
  );
  if (
    error instanceof Error &&
    /^(Synthetic account setup failed: \d+|Expected native input did not receive focus|Unsafe test input)$/.test(
      error.message,
    )
  )
    console.log(
      JSON.stringify({ event: 'android.rehearsal_error', code: error.message }),
    );
  await record('failed; inspect private local UI snapshot');
  process.exitCode = 1;
}
