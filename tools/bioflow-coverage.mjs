import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const base = 'documentation/design-system';
const target = base + '/UI-MIGRATION-COVERAGE.json';
const old = await fs
  .readFile(target, 'utf8')
  .then(JSON.parse)
  .catch(() => []);
const found = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(tsx|jsx|ts|js)$/.test(file) && !file.endsWith('.d.ts')) {
      const platform = file.startsWith('apps/web') ? 'Web' : 'Android';
      const source = ts.createSourceFile(
        file,
        await fs.readFile(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      if (file.includes('/app/'))
        register(platform, 'Route/layout', file, 'Existing route or layout');
      const candidates = source.statements.flatMap((statement) =>
        ts.isFunctionDeclaration(statement)
          ? [{ node: statement, name: statement.name?.text ?? 'default' }]
          : ts.isVariableStatement(statement)
            ? statement.declarationList.declarations.map((declaration) => ({
                node: declaration,
                name: declaration.name.getText(source),
              }))
            : [],
      );
      for (const { node, name } of candidates) {
        let jsx = false;
        const visit = (n) => {
          if (
            ts.isJsxElement(n) ||
            ts.isJsxSelfClosingElement(n) ||
            ts.isJsxFragment(n)
          )
            jsx = true;
          ts.forEachChild(n, visit);
        };
        visit(node);
        if (jsx)
          register(
            platform,
            'Component',
            `${file}#${name}`,
            'Rendered interface',
          );
      }
    }
  }
}
function register(platform, module, surface, current) {
  const previous = old.find((r) => r.surface === surface);
  found.push(
    previous ?? {
      id:
        'UI-' + createHash('sha256').update(surface).digest('hex').slice(0, 8),
      platform,
      module,
      surface,
      current,
      changes:
        'BioFlow tokens, shared patterns, interaction states and responsive/accessibility review',
      status: 'Pending',
      functional: 'Not Tested',
      visual: 'Not Reviewed',
      responsive: 'Not Tested',
      accessibility: 'Not Tested',
      issues: '',
      evidence: '',
      disposition: 'Applicable',
    },
  );
}
await walk('apps/web/app');
await walk('apps/web/src');
await walk('apps/mobile/src');
for (const [platform, module, surface, reason] of [
  [
    'Android',
    'Inactive template',
    'apps/mobile/App.tsx#App',
    'Unused Expo starter template. package.json selects expo-router/entry; the template is not a reachable screen.',
  ],
  [
    'Android',
    'Inactive template',
    'apps/mobile/index.ts',
    'Unused starter registration; Expo Router is the configured entry point.',
  ],
  [
    'Android',
    'System UI',
    'Android document picker',
    'OS-provided picker styling is outside application control. Upload entry/return behavior is tested.',
  ],
]) {
  register(platform, module, surface, reason);
  const row = found.at(-1);
  row.disposition = 'Not Applicable';
  row.issues = reason;
}
register(
  'Both',
  'Brand assets',
  'Launcher, splash and favicon assets',
  'Shared BioFlow leaf mark rendered into platform-sized assets.',
);
for (const [name, states] of Object.entries({
  Authentication:
    'Sign in, signup, verification resend, forgot/reset password, validation and expired link',
  Profiles:
    'No profile, email-less family creation, contact update, selection pending/failure, expired session and permission loss',
  Reports:
    'Upload pending/error/limits, queued/processing, failed/retry, infected, quarantined, cancelled/withdrawn',
  Verification:
    'Identity confirmation, quantity/comparator, qualitative, missing, reference text, metadata, manual candidate, correction and relationships',
  Evidence:
    'Loading, empty, incompatible/excluded, tied dates, source pages, failed preview, chart alternatives and organ not-assessed',
  'Health story':
    'Dated/approximate/undated timeline, reported context, document source withheld, read-only access, append correction/conflict, history, checkpoint/digest, stale pagination and profile reset',
  Assistant:
    'Consent required/withdrawn, history, sending, citations, stale evidence, unavailable/provider/budget failure',
  Wellness:
    'Unavailable service; planned goals and check-ins are not implemented',
  Community:
    'Read-only empty and feature-paused; publishing is not implemented',
}))
  for (const platform of ['Web', 'Android'])
    register(platform, 'Workflow states', `${platform}:${name}`, states);
for (const previous of old)
  if (!found.some((r) => r.surface === previous.surface))
    found.push({
      ...previous,
      issues:
        previous.issues || 'Consolidated; record replacement before completing',
      disposition: 'Retained historical record',
    });
const unregistered = found.filter(
  (r) => !old.some((o) => o.surface === r.surface),
);
if (process.argv.includes('--check')) {
  if (unregistered.length)
    throw Error(
      'Unregistered UI surfaces: ' +
        unregistered.map((r) => r.surface).join(', '),
    );
  console.log('PASS: BioFlow coverage registers ' + found.length + ' surfaces');
} else {
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(target, JSON.stringify(found, null, 2) + '\n');
  const columns = [
    'id',
    'platform',
    'area',
    'module',
    'surface',
    'current',
    'changes',
    'status',
    'functional',
    'visual',
    'responsive',
    'accessibility',
    'issues',
    'evidence',
    'disposition',
  ];
  const md =
    '# BioFlow UI migration coverage\n\nGenerated from the route/component inventory and individually maintained workflow records. `area` identifies the functional module; `module` identifies the inventory entry kind. `Completed` means the source presentation migration is implemented and accounted for, not that every state or browser has passed acceptance. Validation columns refer to the recorded automated scope; issues qualify partial coverage. Formal approval, manual accessibility and participant signoff are separate. Planned services are not counted as migrated features.\n\n' +
    found.length +
    ' registered surfaces; ' +
    found.filter((r) => r.disposition === 'Applicable').length +
    ' applicable and ' +
    found.filter((r) => r.disposition === 'Not Applicable').length +
    ' excluded template/system surfaces.\n\n' +
    '| Validation dimension | Pass | Fail | Not tested/reviewed |\n| --- | --- | --- | --- |\n' +
    ['functional', 'visual', 'responsive', 'accessibility']
      .map((dimension) => {
        const applicable = found.filter((r) => r.disposition === 'Applicable');
        const pass = applicable.filter((r) => r[dimension] === 'Pass').length;
        const fail = applicable.filter((r) => r[dimension] === 'Fail').length;
        return `| ${dimension} | ${pass} | ${fail} | ${applicable.length - pass - fail} |`;
      })
      .join('\n') +
    '\n\n' +
    '| ' +
    columns.join(' | ') +
    ' |\n|' +
    columns.map(() => '---').join('|') +
    '|\n' +
    found
      .map(
        (r) =>
          '| ' +
          columns
            .map((c) =>
              String(r[c] ?? '')
                .replaceAll('|', '/')
                .replaceAll('\n', ' '),
            )
            .join(' | ') +
          ' |',
      )
      .join('\n') +
    '\n';
  await fs.writeFile(base + '/UI-MIGRATION-COVERAGE.md', md);
  console.log('Registered ' + found.length + ' UI surfaces');
}
