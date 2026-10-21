import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const required = new Map([
  ['navigation', 'BV-001'],
  ['architecture', 'BV-002'],
  ['dataHandling', 'BV-003'],
  ['clinicalReviewer', 'BV-004'],
  ['gateway', 'BV-006'],
  ['launchScope', 'BV-007'],
]);

// Artifact presence is checked separately from the pure register evaluator.
// An existing file still does not authenticate a human signoff.
export function validateP0Evidence(
  root,
  register,
  { forDevelopment = false } = {},
) {
  const errors = [];
  const references = (register.approvals ?? [])
    .filter((approval) => approval.status === 'Approved')
    .map((approval) => approval.evidence);
  if (forDevelopment) {
    for (const entry of [
      register.developmentAcceptance,
      register.developmentDeferrals,
    ])
      if (entry) references.push(entry.evidence);
  }
  const actualRoot = fs.realpathSync(root);
  for (const reference of new Set(references)) {
    try {
      if (
        typeof reference !== 'string' ||
        !reference ||
        path.isAbsolute(reference)
      )
        throw new Error('INVALID_REFERENCE');
      const actual = fs.realpathSync(path.resolve(root, reference));
      const relative = path.relative(actualRoot, actual);
      if (
        !relative ||
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        !fs.statSync(actual).isFile()
      )
        throw new Error('INVALID_REFERENCE');
    } catch {
      errors.push(
        'P0 evidence must reference an existing file inside the repository',
      );
    }
  }
  return errors;
}

// This checks recorded evidence, not whether a human actually approved it.
// Approval authenticity remains a reviewer responsibility.
export function evaluateP0(tasks, register, { forDevelopment = false } = {}) {
  const pending = [];
  const errors = [];
  const approvals = register?.approvals;
  const deferrals = register?.developmentDeferrals;
  const deferredApprovals = new Set(
    forDevelopment ? (deferrals?.approvalIds ?? []) : [],
  );
  const deferredTasks = new Set(
    forDevelopment ? (deferrals?.taskIds ?? []) : [],
  );
  const acceptance = register?.developmentAcceptance;
  const acceptedTasks = new Set(
    forDevelopment ? (acceptance?.taskIds ?? []) : [],
  );
  if (
    forDevelopment &&
    acceptance &&
    (acceptance.evidence !== 'docs/p0/DEVELOPMENT-ACCEPTANCE.md' ||
      [...acceptedTasks].some(
        (id) =>
          ![
            'BV-001',
            'BV-002',
            'BV-003',
            'BV-005',
            'BV-006',
            'BV-007',
          ].includes(id),
      ))
  )
    errors.push('Invalid local engineering acceptance');
  if (forDevelopment && deferrals) {
    if (
      deferrals.evidence !== 'docs/p0/REVIEW-DEFERRAL.md' ||
      [...deferredApprovals].some(
        (id) =>
          ![
            'dataHandling',
            'clinicalReviewer',
            'gateway',
            'launchScope',
          ].includes(id),
      ) ||
      [...deferredTasks].some((id) => id !== 'BV-004')
    )
      errors.push('Invalid development review deferral');
  }
  if (register?.schemaVersion !== 1 || !Array.isArray(approvals)) {
    return { open: false, pending, errors: ['Invalid approval register'] };
  }
  if (
    approvals.length !== required.size ||
    new Set(approvals.map((a) => a.id)).size !== required.size
  )
    errors.push('Approval IDs must be unique and match the required set');
  for (const [id, taskId] of required) {
    const approval = approvals.find((a) => a.id === id);
    if (!approval || approval.taskId !== taskId) {
      errors.push(`Missing or mismatched approval: ${id}`);
      continue;
    }
    if (!['Pending', 'Approved', 'Rejected'].includes(approval.status))
      errors.push(`Invalid approval status: ${id}`);
    if (approval.status !== 'Approved' && !deferredApprovals.has(id))
      pending.push(`${taskId}: ${id} approval pending`);
    if (approval.status === 'Approved') {
      for (const field of [
        'reviewer',
        'artifactVersion',
        'evidence',
        'requiredRole',
      ]) {
        if (typeof approval[field] !== 'string' || !approval[field].trim())
          errors.push(`${id}: missing ${field}`);
      }
      if (
        typeof approval.reviewedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(approval.reviewedAt) ||
        !Number.isFinite(Date.parse(approval.reviewedAt))
      )
        errors.push(`${id}: invalid review timestamp`);
    }
    if (
      approval.status !== 'Approved' &&
      !deferredApprovals.has(id) &&
      tasks.some((task) => task.ID === taskId && task.Status === 'Done')
    )
      errors.push(`${taskId}: cannot be Done without its recorded approval`);
  }
  for (let n = 1; n <= 7; n++) {
    const id = `BV-${String(n).padStart(3, '0')}`;
    const matches = tasks.filter((task) => task.ID === id);
    if (matches.length !== 1 || matches[0].Phase !== 'P0')
      errors.push(`Missing or duplicate P0 task: ${id}`);
    else if (
      matches[0].Status !== 'Done' &&
      !deferredTasks.has(id) &&
      !(acceptedTasks.has(id) && matches[0].Status === 'In Review')
    )
      pending.push(`${id}: task is ${matches[0].Status}`);
  }
  const open = !pending.length && !errors.length;
  const advanced = tasks.filter(
    (task) =>
      task.Phase !== 'P0' && !['Backlog', 'Blocked'].includes(task.Status),
  );
  if (!open && advanced.length)
    errors.push(
      `P0 incomplete; later tasks advanced: ${advanced.map((t) => t.ID).join(', ')}`,
    );
  return { open, pending, errors };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tasks = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        'documentation/BiovitAI-Documentation-v2.1/project-management/BiovitAI_v2_1_Development_Tracker.json',
      ),
      'utf8',
    ),
  );
  const register = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/p0/approvals.json'), 'utf8'),
  );
  const forDevelopment = !process.argv.includes('--full-review');
  const gate = evaluateP0(tasks, register, { forDevelopment });
  gate.errors.push(...validateP0Evidence(root, register, { forDevelopment }));
  if (gate.errors.length) gate.open = false;
  console.log(
    `P0 ${forDevelopment ? 'development' : 'full review'} gate: ${gate.open ? 'OPEN' : 'CLOSED'}`,
  );
  if (process.argv.includes('--require-open'))
    console.log([...gate.pending, ...gate.errors].join('\n'));
  else if (gate.errors.length) console.error(gate.errors.join('\n'));
  else console.log('PASS: tracker respects P0 prerequisite gate');
  if (
    gate.errors.length ||
    (process.argv.includes('--require-open') && !gate.open)
  )
    process.exitCode = 1;
}
