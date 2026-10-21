import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
const origin = 'http://127.0.0.1:3001';
const account = JSON.parse(
  await fs.readFile(
    '.local/android-tools/synthetic-rehearsal-account.json',
    'utf8',
  ),
);
if (
  account.purpose !== 'synthetic test account only' ||
  !account.email.endsWith('@example.test')
)
  throw Error('Dedicated synthetic rehearsal account required');
let cookie = '',
  context;
async function request(route, body, binary) {
  const response = await fetch(origin + route, {
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
      ...(body === undefined
        ? {}
        : {
            'content-type': binary
              ? 'application/octet-stream'
              : 'application/json',
          }),
      ...(binary
        ? { 'idempotency-key': randomUUID(), 'x-file-name': binary }
        : {}),
    },
    ...(body === undefined
      ? {}
      : { body: binary ? body : JSON.stringify(body) }),
  });
  if (!response.ok)
    throw Error('Synthetic seed request failed with status ' + response.status);
  return response;
}
const login = await request('/api/auth/sign-in/email', {
  email: account.email,
  password: account.password,
});
cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const me = await (await request('/v1/me')).json();
const profiles = (await (await request('/v1/profiles')).json()).profiles;
const native = await fs
  .readFile('.local/android-tools/native-profile.json', 'utf8')
  .then(JSON.parse)
  .catch(() => null);
const priorFixtures = await fs
  .readFile('.local/android-tools/comparison-fixtures.json', 'utf8')
  .then(JSON.parse)
  .catch(() => null);
const candidates = profiles.filter(
  (p) =>
    p.ownerId === me.actor.id && p.displayName.startsWith('AndroidSynthetic'),
);
const profile =
  native?.purpose === 'native synthetic family created by rehearsal'
    ? candidates.find((p) => p.displayName === native.displayName)
    : (candidates.find((p) => p.id === priorFixtures?.profileId) ??
      (candidates.length === 1 ? candidates[0] : undefined));
if (!profile) throw Error('Create the native synthetic family profile first');
const prior = await (await request('/v1/profile-context')).json();
const selected = await (
  await request('/v1/profile-context', {
    profileId: profile.id,
    expectedRevision: prior.revision,
  })
).json();
context = { profileId: profile.id, revision: selected.revision };
const manifest = {
  kind: 'generated synthetic comparison fixtures',
  profileId: profile.id,
  displayName: profile.displayName,
  reports: [],
};
for (const fixture of [
  { name: 'SyntheticTrendOne.png', value: '6.10', date: '2026-10-20' },
  { name: 'SyntheticTrendTwo.png', value: '6.50', date: '2026-10-21' },
]) {
  const library = (await (await request('/v1/health/reports')).json()).reports;
  let report = library.find(
    (r) => r.fileName === fixture.name && r.state !== 'cancelled',
  );
  if (!report) {
    const svg = `<svg width="2400" height="400"><rect width="2400" height="400" fill="white"/><text x="40" y="80" font-family="Arial" font-size="32">Patient: Synthetic Subject</text><text x="40" y="170" font-family="Arial" font-size="32">Glucose ${fixture.value} mmol/L Context synthetic-test SYNTH-GLUCOSE serum synthetic-method ${fixture.date}</text></svg>`;
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    report = (
      await (
        await request('/v1/health/reports/upload', bytes, fixture.name)
      ).json()
    ).report;
  }
  let detail;
  const deadline = Date.now() + 180000;
  do {
    detail = await (await request('/v1/health/reports/' + report.id)).json();
    if (['failed', 'quarantined', 'cancelled'].includes(detail.report.state))
      throw Error('Synthetic fixture needs processing review');
    if (!['queued', 'processing'].includes(detail.report.state)) break;
    await delay(1000);
  } while (Date.now() < deadline);
  if (['queued', 'processing'].includes(detail.report.state))
    throw Error('Synthetic fixture worker deadline');
  if (detail.report.state !== 'verified') {
    if (
      detail.candidates.length !== 1 ||
      !/glucose/i.test(detail.candidates[0].parsed.originalName)
    )
      throw Error('Unexpected synthetic extraction; inspect source');
    if (detail.identity?.state !== 'matched')
      await request(`/v1/health/reports/${report.id}/identity`, {
        context,
        expectedRevision: detail.report.revision,
        state: 'matched',
        confirmedSubject: true,
        reason:
          'Controlled synthetic subject and generated source checked for this fixture',
      });
    detail = await (await request('/v1/health/reports/' + report.id)).json();
    const candidate = detail.candidates[0];
    await request(`/v1/health/reports/${report.id}/verify`, {
      context,
      expectedRevision: detail.report.revision,
      candidateId: candidate.id,
      originalName: 'Glucose',
      value: { kind: 'quantity', amount: fixture.value, comparator: '=' },
      unit: 'mmol/L',
      referenceText: null,
      reason:
        'Generated synthetic fixture checked against the explicit source row',
      metadata: {
        conceptSystem: 'synthetic-test',
        conceptCode: 'SYNTH-GLUCOSE',
        specimen: 'serum',
        method: 'synthetic-method',
        observedDate: fixture.date,
        sourceFieldId: candidate.rawFieldId,
      },
    });
  }
  manifest.reports.push({ id: report.id, fileName: fixture.name });
}
await fs.writeFile(
  '.local/android-tools/comparison-fixtures.json',
  JSON.stringify(manifest, null, 2),
);
console.log(
  JSON.stringify({
    event: 'android.synthetic_comparison_ready',
    reports: manifest.reports.length,
  }),
);
