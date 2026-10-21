import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIRequestSchema,
  ToolDefinitionSchema,
} from '../dist/shared/contracts/src/index.js';

const profileId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const request = {
  schemaVersion: '1.0.0',
  traceId: otherId,
  locale: 'en',
  promptTemplateId: 'comparison',
  promptVersion: '1.0.0',
  policyVersion: '1.0.0',
  budget: {
    maxInputTokens: 1000,
    maxOutputTokens: 200,
    timeoutMs: 5000,
    maxCostMicrounits: 100,
  },
  actorId: otherId,
  profileId,
  authorizationVersion: '1',
  consentVersion: '1',
  task: 'explain_health_comparison',
  safetyClass: 'health_explanation',
  evidence: [
    {
      profileId,
      sourceId: otherId,
      revision: 1,
      verification: 'verified',
      observedAt: null,
    },
  ],
};

test('accepts versioned verified evidence without inventing an observation date', () => {
  assert.equal(AIRequestSchema.parse(request).evidence[0].observedAt, null);
});
test('rejects mixed profiles and pending evidence', () => {
  for (const change of [{ profileId: otherId }, { verification: 'pending' }]) {
    assert.equal(
      AIRequestSchema.safeParse({
        ...request,
        evidence: [{ ...request.evidence[0], ...change }],
      }).success,
      false,
    );
  }
});
test('rejects unknown fields, task/safety mismatch and invalid budgets', () => {
  for (const change of [
    { apiKey: 'forbidden' },
    { safetyClass: 'moderation' },
    { budget: { ...request.budget, timeoutMs: -1 } },
  ]) {
    assert.equal(
      AIRequestSchema.safeParse({ ...request, ...change }).success,
      false,
    );
  }
});
test('community moderation rejects personal clinical context', () => {
  const {
    actorId: _actor,
    profileId: _profile,
    authorizationVersion: _auth,
    consentVersion: _consent,
    evidence: _evidence,
    ...common
  } = request;
  const moderation = {
    ...common,
    task: 'triage_community',
    safetyClass: 'moderation',
    postId: otherId,
    contentTrust: 'untrusted',
  };
  assert.equal(AIRequestSchema.safeParse(moderation).success, true);
  assert.equal(
    AIRequestSchema.safeParse({ ...moderation, profileId }).success,
    false,
  );
});
test('tool definitions reject unconfirmed writes and public caching of health data', () => {
  const tool = {
    name: 'find_reports',
    version: '1.0.0',
    owner: 'health',
    authorizationPolicyId: 'reports.read',
    profileScoped: true,
    sensitivity: 'health',
    cachePolicy: 'none',
    maxRows: 20,
    timeoutMs: 1000,
    fixtureId: 'synthetic-reports',
    telemetrySchemaVersion: '1.0.0',
    inputSchemaId: 'reports.input.v1',
    outputSchemaId: 'reports.output.v1',
    errorSchemaId: 'errors.v1',
    operation: 'read',
    requiresConfirmation: false,
  };
  assert.equal(ToolDefinitionSchema.safeParse(tool).success, true);
  for (const change of [
    { operation: 'write' },
    { cachePolicy: 'public' },
    { profileScoped: false },
    { owner: 'community' },
  ]) {
    assert.equal(
      ToolDefinitionSchema.safeParse({ ...tool, ...change }).success,
      false,
    );
  }
});
