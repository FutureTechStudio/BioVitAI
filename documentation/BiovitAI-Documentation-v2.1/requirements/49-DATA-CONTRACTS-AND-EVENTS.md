# 49 — Data model, APIs, contracts and event versioning
Status: Design baseline; detailed DDL/API generation in P1 · Owner: Backend + Data

## Core tables (minimum)
**Identity:** `users`, `profiles`, `profile_memberships`, `consent_grants`, `session_audit`.
**Health:** `source_documents`, `diagnostic_reports`, `specimens`, `observation_groups`, `source_observations`, `extraction_candidates`, `verification_actions`, `aggregation_decisions`, `aggregated_observations`, `comparability_cohorts`, `biomarker_trends`.
**Wellness:** `wellness_profiles`, `behavior_baselines`, `barriers`, `goals`, `action_catalogue_versions`, `action_eligibility_rules`, `plans`, `plan_actions`, `checkins`, `recovery_events`, `intervention_decisions`, `notification_preferences`.
**Community:** `public_identities`, `content_sources`, `posts`, `post_versions`, `moderation_cases`, `content_reports`, `appeals`, `content_labels`.
**AI/Infra:** `conversation_sessions`, `tool_audit_events`, `ai_usage_metrics`, `outbox_events`, `idempotency_keys`, `jobs`, `consent_audit`.

## Medical observation model
Preserve raw text, value, comparator (`<`, `<=`, `>`, `>=`), raw unit, normalized unit, specimen/system, method, time, lab range, report ID, page/box, extraction provenance, version and human verification. Use **Source Observation → Observation Group → Aggregated Observation**. Do not average duplicate-looking lab measurements by default. Group freely; combine only by clinically reviewed rule. Derived outputs include source IDs, decision/version and reason. If source corrected/revoked, invalidate dependent derivatives.

## Example REST routes
```text
POST /v1/reports/uploads          POST /v1/reports/{id}/verification
GET  /v1/profiles/{id}/health-context
GET  /v1/profiles/{id}/biomarker-trends?conceptId=...
GET  /v1/profiles/{id}/report-comparisons?left=...&right=...
GET  /v1/profiles/{id}/wellness/goals
POST /v1/profiles/{id}/wellness/goals
POST /v1/profiles/{id}/wellness/checkins
POST /v1/profiles/{id}/wellness/plans/{id}/adapt
POST /v1/ai/chat
GET  /v1/community/feed
POST /v1/community/posts  # disabled by feature flag until moderation gate
```
All profile-scoped routes resolve a server-authorized profile principal. API paths are examples, not an instruction to accept arbitrary profile ID from clients.

## Events and jobs
- `health.document.uploaded.v1` → ingestion worker.
- `health.report.verified.v1` → immutable version, trend recompute and cache invalidation.
- `health.observation.corrected.v1` → invalidate aggregation lineage.
- `wellness.plan.accepted.v1`, `wellness.checkin.recorded.v1`, `wellness.recovery.started.v1` → update state and evaluated metrics.
- `community.post.submitted.v1`, `community.post.moderated.v1` → moderation and publishing.
Required event metadata: `eventId`, `schemaVersion`, `occurredAt`, `traceId`, `subject/profileId` only where permitted, `causationId`, idempotency key. Avoid health payloads in general event bus; carry opaque references and fetch via authorization.

## Contract quality
Versioned OpenAPI/JSON Schema; migrations backwards-compatible; consumer contract tests; schema snapshot review; opaque IDs, pagination, concurrency/ETags, idempotency keys for writes; job state endpoints for async. Use least privilege, profile-aware row policies/filters, retention and deletion semantics from day one.
