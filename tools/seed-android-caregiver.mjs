import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
async function main() {
  const origin = 'http://127.0.0.1:3001',
    cache = '.local/android-tools/caregiver-fixture.json';
  const member = JSON.parse(
    await fs.readFile(
      '.local/android-tools/synthetic-rehearsal-account.json',
      'utf8',
    ),
  );
  if (
    member.purpose !== 'synthetic test account only' ||
    !member.email.endsWith('@example.test')
  )
    throw Error('Dedicated synthetic account required');
  let saved = await fs
    .readFile(cache, 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  const owner = saved?.owner ?? {
    email: `caregiver-owner-${randomUUID()}@example.test`,
    password: 'SyntheticOwner' + randomUUID().replaceAll('-', ''),
  };
  async function call(route, body, cookie = '', context, file) {
    const response = await fetch(origin + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined
          ? {}
          : {
              'content-type': file
                ? 'application/octet-stream'
                : 'application/json',
            }),
        ...(context
          ? {
              'x-profile-id': context.profileId,
              'x-context-revision': String(context.revision),
            }
          : {}),
        ...(file
          ? { 'idempotency-key': randomUUID(), 'x-file-name': file }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: file ? body : JSON.stringify(body) }),
    });
    if (!response.ok)
      throw Error('Synthetic caregiver setup failed: ' + response.status);
    return response;
  }
  async function login(account) {
    const response = await call('/api/auth/sign-in/email', account);
    return response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
  }
  if (!saved) {
    await call('/api/auth/sign-up/email', {
      ...owner,
      name: 'Synthetic Caregiver Owner',
    });
    let link;
    for (const file of await fs.readdir('.local/auth-mailbox')) {
      if (!file.endsWith('.json')) continue;
      const item = JSON.parse(
        await fs.readFile(path.join('.local/auth-mailbox', file), 'utf8'),
      );
      if (item.kind === 'verification' && item.recipient === owner.email)
        link = item.url;
    }
    if (!link || new URL(link).origin !== origin)
      throw Error('Local synthetic verification required');
    await fetch(link, { redirect: 'manual' });
    saved = { kind: 'synthetic caregiver rehearsal only', owner };
    await fs.writeFile(cache, JSON.stringify(saved), {
      mode: 0o600,
      flag: 'wx',
    });
  }
  if (saved.kind !== 'synthetic caregiver rehearsal only')
    throw Error('Synthetic fixture cache required');
  const ownerCookie = await login(owner);
  if (process.argv.includes('--revoke')) {
    await call(
      `/v1/profiles/${saved.profileId}/sharing/${saved.grantId}/revoke`,
      {},
      ownerCookie,
    );
    saved.revoked = true;
    await fs.writeFile(cache, JSON.stringify(saved));
    console.log(
      JSON.stringify({ event: 'android.synthetic_caregiver_revoked' }),
    );
    return;
  }
  if (saved.grantId && !saved.revoked) {
    console.log(JSON.stringify({ event: 'android.synthetic_caregiver_ready' }));
    return;
  }
  const profiles = (
    await (await call('/v1/profiles', undefined, ownerCookie)).json()
  ).profiles;
  const profile =
    profiles.find((p) => p.displayName === 'Caregiver Shared Synthetic') ??
    (
      await (
        await call(
          '/v1/profiles',
          { displayName: 'Caregiver Shared Synthetic', kind: 'family' },
          ownerCookie,
        )
      ).json()
    ).profile;
  const current = await (
    await call('/v1/profile-context', undefined, ownerCookie)
  ).json();
  const selected = await (
    await call(
      '/v1/profile-context',
      { profileId: profile.id, expectedRevision: current.revision },
      ownerCookie,
    )
  ).json();
  const context = { profileId: profile.id, revision: selected.revision };
  let report = (
    await (
      await call('/v1/health/reports', undefined, ownerCookie, context)
    ).json()
  ).reports.find((r) => r.fileName === 'SharedCaregiverSynthetic.png');
  if (!report) {
    const bytes = await sharp(
      Buffer.from(
        '<svg width="1200" height="400"><rect width="1200" height="400" fill="white"/><text x="40" y="80" font-family="Arial" font-size="36">Patient: Synthetic Subject</text><text x="40" y="170" font-family="Arial" font-size="36">Caregiver Marker 2.10 mg/L</text></svg>',
      ),
    )
      .png()
      .toBuffer();
    report = (
      await (
        await call(
          '/v1/health/reports/upload',
          bytes,
          ownerCookie,
          context,
          'SharedCaregiverSynthetic.png',
        )
      ).json()
    ).report;
  }
  let detail;
  for (let attempt = 0; attempt < 180; attempt++) {
    detail = await (
      await call(
        '/v1/health/reports/' + report.id,
        undefined,
        ownerCookie,
        context,
      )
    ).json();
    if (!['queued', 'processing'].includes(detail.report.state)) break;
    await delay(1000);
  }
  if (!['review_needed', 'verified'].includes(detail.report.state))
    throw Error('Synthetic caregiver extraction unavailable');
  if (detail.report.state !== 'verified') {
    if (detail.candidates.length !== 1)
      throw Error('Unexpected synthetic caregiver extraction');
    if (detail.identity?.state !== 'matched')
      await call(
        `/v1/health/reports/${report.id}/identity`,
        {
          context,
          expectedRevision: detail.report.revision,
          state: 'matched',
          confirmedSubject: true,
          reason:
            'Controlled synthetic subject checked against generated fixture',
        },
        ownerCookie,
      );
    detail = await (
      await call(
        '/v1/health/reports/' + report.id,
        undefined,
        ownerCookie,
        context,
      )
    ).json();
    await call(
      `/v1/health/reports/${report.id}/verify`,
      {
        context,
        expectedRevision: detail.report.revision,
        candidateId: detail.candidates[0].id,
        originalName: 'Caregiver Marker',
        value: { kind: 'quantity', amount: '2.10', comparator: '=' },
        unit: 'mg/L',
        reason:
          'Controlled source row verified for synthetic permission rehearsal',
      },
      ownerCookie,
    );
  }
  await call(
    `/v1/profiles/${profile.id}/consents`,
    { purpose: 'family_sharing', noticeVersion: 'pilot-v1', granted: true },
    ownerCookie,
  );
  const invitation = await (
    await call(
      `/v1/profiles/${profile.id}/invitations`,
      {
        email: member.email,
        role: 'caregiver',
        scopes: [
          { category: 'profile', action: 'read', purpose: 'care' },
          { category: 'health', action: 'read', purpose: 'care' },
          { category: 'health', action: 'write', purpose: 'care' },
        ],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      ownerCookie,
    )
  ).json();
  let token;
  for (const file of await fs.readdir('.local/auth-mailbox/invitations')) {
    const item = JSON.parse(
      await fs.readFile(
        path.join('.local/auth-mailbox/invitations', file),
        'utf8',
      ),
    );
    if (
      item.invitationId === invitation.invitationId &&
      item.recipient === member.email
    )
      token = item.token;
  }
  if (!token) throw Error('Synthetic local invitation capture unavailable');
  const memberCookie = await login({
    email: member.email,
    password: member.password,
  });
  const accepted = await (
    await call('/v1/profile-invitations/accept', { token }, memberCookie)
  ).json();
  const comparison = JSON.parse(
    await fs.readFile('.local/android-tools/comparison-fixtures.json', 'utf8'),
  );
  const memberProfiles = (
    await (await call('/v1/profiles', undefined, memberCookie)).json()
  ).profiles;
  saved = {
    ...saved,
    profileId: profile.id,
    grantId: accepted.grantId,
    revoked: false,
    restoreProfileName: memberProfiles.find(
      (p) => p.id === comparison.profileId,
    ).displayName,
  };
  await fs.writeFile(cache, JSON.stringify(saved), { mode: 0o600 });
  console.log(JSON.stringify({ event: 'android.synthetic_caregiver_ready' }));
}
await main();
