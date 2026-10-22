// Extend only the dedicated, existing local synthetic demo; never seed real profiles.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const file = '.local/demo-account.json',
  demo = JSON.parse(await fs.readFile(file, 'utf8'));
if (demo.purpose !== 'local synthetic demo only' || demo.profiles?.length !== 2)
  throw Error('Run the dedicated synthetic demo seeder first');
const origin = 'http://127.0.0.1:3001';
let cookie = '',
  context;
async function call(route, body) {
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
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw Error(`Synthetic story setup failed (${response.status})`);
  return response;
}
const login = await call('/api/auth/sign-in/email', demo.account);
cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const json = async (route, body) => (await call(route, body)).json();
const date = (value) => ({
  precision: !value
    ? 'unknown'
    : value.length === 4
      ? 'year'
      : value.length === 7
        ? 'month'
        : 'day',
  value: value || null,
});
demo.storySeeds ??= {};
for (const person of demo.profiles) {
  const me = await json('/v1/me'),
    profiles = (await json('/v1/profiles')).profiles;
  if (!profiles.some((p) => p.id === person.id && p.ownerId === me.actor.id))
    throw Error('Expected demo-owned profile');
  const old = await json('/v1/profile-context'),
    selected = await json('/v1/profile-context', {
      profileId: person.id,
      expectedRevision: old.revision,
    });
  context = { profileId: person.id, revision: selected.revision };
  const seed = (demo.storySeeds[person.id] ??= Object.fromEntries(
    [
      'medicine',
      'concern',
      'guidanceA',
      'guidanceB',
      'allergy',
      'sourceNote',
      'backfill',
    ].map((k) => [k, randomUUID()]),
  ));
  await fs.writeFile(file, JSON.stringify(demo, null, 2), { mode: 0o600 });
  let snapshot = await json('/v1/health/journey');
  const common = {
    start: date(''),
    end: date(''),
    state: 'uncertain',
    source: { kind: 'reported' },
    conflictsWith: [],
  };
  async function add(key, content) {
    if (snapshot.records.some((r) => r.id === seed[key])) return;
    await json('/v1/health/journey/records', {
      context,
      requestKey: randomUUID(),
      recordId: seed[key],
      expectedRevision: 0,
      reason: 'Controlled synthetic story demonstration',
      confirmed: true,
      content: { ...common, ...content },
    });
    snapshot = await json('/v1/health/journey');
  }
  await add('medicine', {
    information: {
      kind: 'medication',
      label: 'SYNTHETIC Medicine A',
      details:
        'Fictional reported medicine for testing. No real treatment or dosage is implied.',
      strength: null,
      dose: null,
      route: null,
      schedule: null,
    },
  });
  await add('concern', {
    start: date('2025'),
    information: {
      kind: 'condition',
      assertion: 'concern',
      label: 'SYNTHETIC question for next visit',
      details:
        'How should I organize the questions raised by these fictional reports? This is a recorded concern, not a diagnosis.',
    },
  });
  await add('guidanceA', {
    start: date('2026-09'),
    state: 'current',
    information: {
      kind: 'care_guidance',
      label: 'SYNTHETIC guidance A',
      details:
        'Fictional instruction recorded by the demo user: prepare a source-linked question list.',
      clinician: 'Fictional clinician',
      followUp: date('2026-11-15'),
    },
  });
  await add('guidanceB', {
    state: 'disputed',
    conflictsWith: [seed.guidanceA],
    information: {
      kind: 'care_guidance',
      label: 'SYNTHETIC guidance B — clarify',
      details:
        'An alternative fictional instruction is recorded here. Both records are retained for clarification; the app does not select treatment.',
      clinician: null,
      followUp: date(''),
    },
  });
  await add('allergy', {
    information: {
      kind: 'allergy',
      label: 'SYNTHETIC allergy placeholder',
      details:
        'Fictional reported allergy for interface testing; not a real allergy record.',
      reaction: null,
    },
  });
  const verified = person.reports.find((r) => r.state === 'verified');
  if (verified) {
    const source = await json('/v1/health/reports/' + verified.id);
    const excerpt = source.rawFields?.find((f) => f.pageNumber === 1)?.text;
    if (excerpt)
      await add('sourceNote', {
        source: {
          kind: 'document',
          reportId: verified.id,
          pageNumber: 1,
          excerpt,
        },
        information: {
          kind: 'condition',
          assertion: 'concern',
          label: 'SYNTHETIC source-linked note',
          details:
            'This note links to a fictional report page to demonstrate provenance. No diagnosis is inferred.',
        },
      });
  }
  if (snapshot.firstReview) {
    await json('/v1/health/journey/review', {
      context,
      requestKey: randomUUID(),
      snapshot: snapshot.snapshot,
    });
  }
  await add('backfill', {
    start: date('2023'),
    state: 'historical',
    information: {
      kind: 'condition',
      assertion: 'concern',
      label: 'SYNTHETIC older context added later',
      details:
        'A historical fictional concern added after the review point. This is not a newly occurring illness.',
    },
  });
  const medicine = snapshot.records.find((r) => r.id === seed.medicine);
  if (medicine?.revision === 1 && medicine.content) {
    await json('/v1/health/journey/records', {
      context,
      requestKey: randomUUID(),
      recordId: medicine.id,
      expectedRevision: 1,
      reason: 'Synthetic correction demonstration; original retained',
      confirmed: true,
      content: {
        ...medicine.content,
        information: {
          ...medicine.content.information,
          details:
            'Fictional reported medicine, corrected for the revision-history demonstration. No real treatment is implied.',
        },
      },
    });
  }
  console.log(
    JSON.stringify({
      event: 'demo.story.ready',
      records: (await json('/v1/health/journey')).records.length,
    }),
  );
}
