# 50 — Engineering standards and development practices
Status: Proposed Definition of Done · Owner: Tech Lead + QA + Security

## Build principles
- Single source of truth for schemas; generated API clients where possible; typed validation at boundaries; explicit domain errors, no swallowing exceptions.
- Ports/adapters dependency inversion; testability without live LLM/cloud. No cross-module imports into repositories/ORM models.
- Prefer feature flags, small PRs, code reviews and trunk-compatible short-lived branches; architectural decisions recorded in ADRs.
- Never hardcode medical thresholds into prompts. Reviewed versioned rule sets with changelog, test fixtures and clinical signoff.
- No real patient health data in source control, telemetry, screenshots, demo seeds or AI test fixtures.

## Test pyramid
**Unit:** domain rules, eligibility, plan adaptation, unit conversions, authorization predicates, device data quality. **Integration:** DB, object storage, queue/outbox, API permission checks, OCR job lifecycle. **Contract:** front/back schemas and tool contracts. **E2E:** upload→verify→trend→ask AI; onboarding→goal→missed week→recovery; profile switch; RTL. **Safety:** cross-profile isolation, prompt injection, hallucination citation controls, dangerous clinical advice, moderation escalations. **Performance:** uploads, retries, latency/cost quotas and noisy neighbor.

## Definition of Done for each tracker item
Requirement linked to task ID; acceptance checks runnable and passed; API/schema reviewed; unit+integration tests; authorization and data-minimization checks; error/empty/loading UX; accessibility and English/Arabic as applicable; telemetry with no sensitive payload; feature flag/rollback; docs and migration notes; reviewer signoff; evidence attached to PR/issue.

## CI/CD baseline
Lint/format/types → unit tests → contract tests → dependency/license/vulnerability scan → integration tests → build and deploy to isolated staging → smoke/E2E tests; DB migrations are expand/contract and rollback-reviewed. Block merge on high-severity safety, auth or clinical regression. Protected secrets, ephemeral preview environments without production PHI, staged rollout/canary, backup/restore drill.

## Observability
Trace IDs across API, workers and AI Gateway; measure availability, 95th-percentile latency, queue age, extraction verification rate, hallucinated-citation failures, tool authorization denials, safety review backlog, opt-out rate and unit cost. Do not emit PHI, chat text or raw reports by default.

## Change management
Use semantic versioning for API/tool/event schemas and action catalogue versions; never silently replace verified observations; migrations checked on anonymized fixtures; zero-downtime deployment tested. Establish post-incident review and user-facing correction pathway.
