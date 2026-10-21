import fs from 'node:fs/promises';
const base =
  'documentation/BiovitAI-Documentation-v2.1/project-management/BioFlow_UI_Tracker';
const rows = JSON.parse(await fs.readFile(base + '.json', 'utf8'));
const columns = [
  'ID',
  'Workstream',
  'Status',
  'Related Tasks',
  'Evidence',
  'Notes',
];
const csv =
  [columns, ...rows.map((row) => columns.map((c) => row[c]))]
    .map((row) =>
      row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(','),
    )
    .join('\n') + '\n';
if (process.argv.includes('--check')) {
  if ((await fs.readFile(base + '.csv', 'utf8')) !== csv)
    throw Error('BioFlow tracker CSV differs from JSON');
  console.log('PASS: BioFlow tracker CSV/JSON match');
} else await fs.writeFile(base + '.csv', csv);
