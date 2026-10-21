import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { evaluateP0, validateP0Evidence } from '../tools/check-p0-gate.mjs';

const register = JSON.parse(
  fs.readFileSync(
    new URL('../docs/p0/approvals.json', import.meta.url),
    'utf8',
  ),
);
// Keep approval fixtures independent from changes to the live owner decisions.
for (const approval of register.approvals) approval.status = 'Pending';
delete register.developmentAcceptance;
const tasks = Array.from({ length: 7 }, (_, i) => ({
  ID: `BV-00${i + 1}`,
  Phase: 'P0',
  Status: 'Done',
}));

test('gate evidence resolves to real repository files, not missing, external or directory references', () => {
  const current = JSON.parse(
    fs.readFileSync(
      new URL('../docs/p0/approvals.json', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(
    validateP0Evidence(process.cwd(), current, { forDevelopment: true }),
    [],
  );
  for (const evidence of [
    'missing-approval.md',
    '../outside-approval.md',
    path.resolve('README.md'),
    'docs/p0',
  ]) {
    const invalid = structuredClone(current);
    invalid.approvals[0].evidence = evidence;
    assert.ok(
      validateP0Evidence(process.cwd(), invalid, { forDevelopment: true })
        .length,
    );
  }
});

test('a missing development acceptance artifact cannot be waived by the reviewer deferral', () => {
  const root = path.resolve('.local/tests', `p0-evidence-${randomUUID()}`);
  const parent = path.resolve('.local/tests');
  assert.equal(path.dirname(root), parent);
  fs.mkdirSync(root, { recursive: true });
  try {
    fs.writeFileSync(
      path.join(root, 'acceptance.md'),
      'Synthetic acceptance evidence',
    );
    const fixture = {
      approvals: [],
      developmentAcceptance: { evidence: 'acceptance.md' },
    };
    assert.deepEqual(
      validateP0Evidence(root, fixture, { forDevelopment: true }),
      [],
    );
    fs.unlinkSync(path.join(root, 'acceptance.md'));
    assert.equal(
      validateP0Evidence(root, fixture, { forDevelopment: true }).length,
      1,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('completed tasks alone cannot open P0', () => {
  const result = evaluateP0(tasks, register);
  assert.equal(result.open, false);
  assert.equal(result.pending.length, 6);
});
test('rejects incomplete, duplicate and missing approval evidence', () => {
  const missingEvidence = structuredClone(register);
  for (const approval of missingEvidence.approvals)
    approval.status = 'Approved';
  assert.ok(evaluateP0(tasks, missingEvidence).errors.length);
  const duplicate = structuredClone(register);
  duplicate.approvals[1] = duplicate.approvals[0];
  assert.ok(evaluateP0(tasks, duplicate).errors.length);
  assert.equal(evaluateP0(tasks, {}).open, false);
});
test('blocks later-phase progress while P0 remains closed', () => {
  for (const Status of ['Ready', 'In Progress', 'In Review', 'Done']) {
    assert.ok(
      evaluateP0(
        [...tasks, { ID: 'BV-008', Phase: 'P1', Status }],
        register,
      ).errors.some((error) => error.includes('later tasks advanced')),
    );
  }
});
test('opens only with all task completions and populated review records', () => {
  const approved = structuredClone(register);
  for (const approval of approved.approvals)
    Object.assign(approval, {
      status: 'Approved',
      reviewer: 'Synthetic test reviewer',
      reviewedAt: '2026-10-20T10:00:00Z',
      artifactVersion: 'test-version',
      evidence: 'synthetic-fixture-reference',
    });
  assert.equal(evaluateP0(tasks, approved).open, true);
  assert.equal(evaluateP0(tasks.slice(1), approved).open, false);
  assert.equal(
    evaluateP0(
      tasks.map((task) => ({ ...task, Status: 'In Review' })),
      approved,
    ).open,
    false,
  );
});

test('owner-authorized deferral permits development without claiming specialist approval', () => {
  const development = structuredClone(register);
  for (const approval of development.approvals.filter((a) =>
    ['navigation', 'architecture'].includes(a.id),
  )) {
    Object.assign(approval, {
      status: 'Approved',
      reviewer: 'Synthetic owner',
      reviewedAt: '2026-10-20T10:00:00Z',
      artifactVersion: 'fixture',
      evidence: 'synthetic-owner-decision',
    });
  }
  const engineeringTasks = tasks.map((task) =>
    task.ID === 'BV-004' ? { ...task, Status: 'Backlog' } : task,
  );
  assert.equal(
    evaluateP0(engineeringTasks, development, { forDevelopment: true }).open,
    true,
  );
  assert.equal(evaluateP0(engineeringTasks, development).open, false);
  assert.equal(
    development.approvals.find((a) => a.id === 'clinicalReviewer').status,
    'Pending',
  );
  engineeringTasks[4].Status = 'In Review';
  assert.equal(
    evaluateP0(engineeringTasks, development, { forDevelopment: true }).open,
    false,
  );
});

test('review deferral cannot exempt unrelated engineering tasks', () => {
  const invalid = structuredClone(register);
  invalid.developmentDeferrals.taskIds.push('BV-005');
  assert.ok(
    evaluateP0(tasks, invalid, { forDevelopment: true }).errors.includes(
      'Invalid development review deferral',
    ),
  );
});

test('local engineering acceptance permits only evidenced P0 tasks in review', () => {
  const current = JSON.parse(
    fs.readFileSync(
      new URL('../docs/p0/approvals.json', import.meta.url),
      'utf8',
    ),
  );
  const localTasks = tasks.map((task) => ({
    ...task,
    Status: task.ID === 'BV-004' ? 'Backlog' : 'In Review',
  }));
  assert.equal(
    evaluateP0(localTasks, current, { forDevelopment: true }).open,
    true,
  );
  assert.equal(evaluateP0(localTasks, current).open, false);
  localTasks[4].Status = 'Backlog';
  assert.equal(
    evaluateP0(localTasks, current, { forDevelopment: true }).open,
    false,
  );
});
