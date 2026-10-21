// Local, synthetic-only demo. Uses the real authentication and ingestion APIs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';

const origin = 'http://127.0.0.1:3001';
const cache = '.local/demo-account.json';
let saved = await fs
  .readFile(cache, 'utf8')
  .then(JSON.parse)
  .catch(() => null);
const account = saved?.account ?? {
  email: 'demo@biovitai.test',
  password: 'BiovitAI-Demo-2026!',
};
if (saved && saved.purpose !== 'local synthetic demo only')
  throw Error('Unexpected demo manifest');
let cookie = '',
  context;
async function call(route, body, file) {
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
            'content-type': file
              ? 'application/octet-stream'
              : 'application/json',
          }),
      ...(file ? { 'idempotency-key': randomUUID(), 'x-file-name': file } : {}),
    },
    ...(body === undefined ? {} : { body: file ? body : JSON.stringify(body) }),
  });
  if (!response.ok)
    throw Error(
      `Demo request ${route} failed: ${response.status} ${await response.text()}`,
    );
  return response;
}
async function json(route, body, file) {
  return (await call(route, body, file)).json();
}
if (!saved) {
  await call('/api/auth/sign-up/email', { ...account, name: 'Alex Demo' });
  saved = { purpose: 'local synthetic demo only', account, profiles: [] };
  await fs.mkdir('.local', { recursive: true });
  await fs.writeFile(cache, JSON.stringify(saved, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
}
// Only consume this dedicated local test user's captured verification message.
for (const file of await fs.readdir('.local/auth-mailbox')) {
  if (!file.endsWith('.json')) continue;
  const mail = JSON.parse(
    await fs.readFile(path.join('.local/auth-mailbox', file), 'utf8'),
  );
  if (mail.recipient === account.email && mail.kind === 'verification') {
    if (new URL(mail.url).origin !== origin)
      throw Error('Expected loopback verification');
    await fetch(mail.url, { redirect: 'manual' });
  }
}
const login = await call('/api/auth/sign-in/email', account);
cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const me = await json('/v1/me');
if (!me.actor.emailVerified) throw Error('Demo email verification failed');
const profiles = (await json('/v1/profiles')).profiles;
const detailFor = (id) => json('/v1/health/reports/' + id);
for (const [personIndex, person] of [
  { displayName: 'Alex Demo', kind: 'self' },
  { displayName: 'Maya Demo', kind: 'family' },
].entries()) {
  const profile =
    profiles.find(
      (p) =>
        p.ownerId === me.actor.id &&
        p.kind === person.kind &&
        (p.kind === 'self' || p.displayName === person.displayName),
    ) ?? (await json('/v1/profiles', person)).profile;
  const current = await json('/v1/profile-context');
  const selected = await json('/v1/profile-context', {
    profileId: profile.id,
    expectedRevision: current.revision,
  });
  context = { profileId: profile.id, revision: selected.revision };
  const library = (await json('/v1/health/reports')).reports;
  const results = [];
  const fixtures = [
    {
      label: 'Baseline',
      date: '2026-08-20',
      values: personIndex
        ? ['5.20', '4.60', '65.00']
        : ['5.90', '5.10', '82.00'],
    },
    {
      label: 'Followup',
      date: '2026-09-20',
      values: personIndex
        ? ['5.10', '4.50', '64.00']
        : ['5.60', '4.90', '80.00'],
    },
    {
      label: 'Latest',
      date: '2026-10-20',
      values: personIndex
        ? ['5.00', '4.40', '63.00']
        : ['5.40', '4.70', '79.00'],
    },
    {
      label: 'NeedsReview',
      date: '2026-10-21',
      values: ['5.30', '4.60', '78.00'],
      pending: true,
    },
    ...(personIndex
      ? [
          {
            label: 'MixedIdentity',
            date: '2026-10-21',
            values: ['5.30', '4.60', '78.00'],
            quarantine: true,
          },
        ]
      : []),
  ];
  for (const fixture of fixtures) {
    const fileName = `${person.displayName.replaceAll(' ', '')}-${fixture.label}-Synthetic.png`;
    const markers = [
      { name: 'Glucose', code: 'SYNTH-GLUCOSE', unit: 'mmol/L' },
      { name: 'Cholesterol', code: 'SYNTH-CHOLESTEROL', unit: 'mmol/L' },
      { name: 'Creatinine', code: 'SYNTH-CREATININE', unit: 'umol/L' },
    ];
    let report = library.find(
      (r) => r.fileName === fileName && r.state !== 'cancelled',
    );
    if (!report) {
      const lines = [
        'SYNTHETIC DEMO - NOT A CLINICAL REPORT',
        `Patient: ${person.displayName}`,
        ...(fixture.quarantine ? ['Patient: Other Synthetic Person'] : []),
        ...markers.map(
          (m, i) =>
            `${m.name} ${fixture.values[i]} ${m.unit} Context synthetic-test ${m.code} serum synthetic-method ${fixture.date}`,
        ),
      ];
      const svg =
        '<svg width="2600" height="750"><rect width="2600" height="750" fill="white"/>' +
        lines
          .map(
            (line, i) =>
              `<text x="40" y="${70 + i * 90}" font-family="Arial" font-size="32">${line}</text>`,
          )
          .join('') +
        '</svg>';
      const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
      report = (await json('/v1/health/reports/upload', bytes, fileName))
        .report;
    }
    let detail;
    const deadline = Date.now() + 180000;
    do {
      detail = await detailFor(report.id);
      if (!['queued', 'processing'].includes(detail.report.state)) break;
      await delay(1000);
    } while (Date.now() < deadline);
    if (fixture.quarantine) {
      if (detail.report.state !== 'quarantined')
        throw Error('Expected mixed identity quarantine');
    } else {
      if (!['review_needed', 'verified'].includes(detail.report.state))
        throw Error(
          `Demo extraction unavailable: ${detail.report.state} ${detail.report.errorCode}`,
        );
      if (detail.candidates.length !== markers.length)
        throw Error('Unexpected demo extraction; inspect generated source');
      if (!fixture.pending && detail.report.state !== 'verified') {
        if (detail.identity?.state !== 'matched')
          await json(`/v1/health/reports/${report.id}/identity`, {
            context,
            expectedRevision: detail.report.revision,
            state: 'matched',
            confirmedSubject: true,
            reason:
              'Controlled synthetic demo patient checked against the generated source',
          });
        for (const [index, marker] of markers.entries()) {
          detail = await detailFor(report.id);
          const candidate = detail.candidates.find(
            (c) =>
              c.parsed.originalName.toLowerCase() === marker.name.toLowerCase(),
          );
          if (!candidate) throw Error('Demo field does not match source');
          if (candidate.observationId) continue;
          if (
            candidate.parsed.value.kind !== 'quantity' ||
            Number(candidate.parsed.value.amount) !==
              Number(fixture.values[index])
          )
            throw Error('Demo OCR differs from generated source');
          await json(`/v1/health/reports/${report.id}/verify`, {
            context,
            expectedRevision: detail.report.revision,
            candidateId: candidate.id,
            originalName: marker.name,
            value: {
              kind: 'quantity',
              amount: fixture.values[index],
              comparator: '=',
            },
            unit: marker.unit,
            referenceText: null,
            reason:
              'Synthetic demo observation checked against its generated source row',
            metadata: {
              conceptSystem: 'synthetic-test',
              conceptCode: marker.code,
              specimen: 'serum',
              method: 'synthetic-method',
              observedDate: fixture.date,
              sourceFieldId: candidate.rawFieldId,
            },
          });
        }
      }
    }
    detail = await detailFor(report.id);
    results.push({ id: report.id, fileName, state: detail.report.state });
    console.log(
      JSON.stringify({
        event: 'demo.report.ready',
        fileName,
        state: detail.report.state,
      }),
    );
  }
  const intelligence = await json('/v1/health/intelligence');
  const observations = await json('/v1/health/observations');
  const comparison = await json('/v1/health/comparisons', {
    context,
    left: results[0].id,
    right: results[2].id,
  });
  if (observations.observations.length < 9)
    throw Error('Demo verified history missing');
  if (
    intelligence.cohorts.length !== 3 ||
    intelligence.cohorts.some((c) => c.observations.length < 3) ||
    comparison.cohorts.length !== 3 ||
    comparison.cohorts.some((c) => c.observations.length !== 2)
  )
    throw Error('Demo trends or comparisons missing');
  const source = await call(
    `/v1/health/reports/${results[0].id}/pages/1?profileId=${context.profileId}&revision=${context.revision}`,
  );
  if (!source.headers.get('content-type')?.startsWith('image/'))
    throw Error('Demo source page unavailable');
  await source.arrayBuffer();
  saved.profiles = saved.profiles.filter((p) => p.id !== profile.id);
  saved.profiles.push({
    id: profile.id,
    displayName: person.displayName,
    reports: results,
    verifiedObservations: observations.observations.length,
    trendSeries: intelligence.cohorts.length,
    comparisonSeries: comparison.cohorts.length,
  });
  await fs.writeFile(cache, JSON.stringify(saved, null, 2), { mode: 0o600 });
}
console.log(
  JSON.stringify({
    event: 'demo.ready',
    profiles: saved.profiles.length,
    reports: saved.profiles.reduce((n, p) => n + p.reports.length, 0),
  }),
);
