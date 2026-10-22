import fs from 'node:fs/promises';
const base =
  'documentation/BiovitAI-Documentation-v2.1/project-management/Connected_Journey_Tracker';
const rows = JSON.parse(await fs.readFile(base + '.json', 'utf8'));
const columns = [
  'ID',
  'Workstream',
  'Status',
  'Dependencies',
  'Related Tasks',
  'Evidence',
  'Notes',
];
if (rows.length !== 18)
  throw Error('Connected journey requires 18 distinct epics');
for (let index = 0; index < rows.length; index++) {
  const r = rows[index];
  if (
    r.ID !== 'CJ-' + String(index + 1).padStart(3, '0') ||
    ![
      'Backlog',
      'Ready',
      'In Progress',
      'In Review',
      'Done',
      'Blocked',
    ].includes(r.Status) ||
    columns.some((c) => typeof r[c] !== 'string' || !r[c].trim())
  )
    throw Error('Invalid connected journey record');
}
const csv =
  [columns, ...rows.map((r) => columns.map((c) => r[c]))]
    .map((row) => row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(','))
    .join('\n') + '\n';
if (process.argv.includes('--check')) {
  if ((await fs.readFile(base + '.csv', 'utf8')) !== csv)
    throw Error('Connected journey CSV differs from JSON');
  console.log('PASS: 18 connected journey epics reconcile across CSV/JSON');
} else await fs.writeFile(base + '.csv', csv);
