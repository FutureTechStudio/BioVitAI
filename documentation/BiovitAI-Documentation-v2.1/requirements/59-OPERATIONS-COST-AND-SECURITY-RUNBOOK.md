# 59 — Deployment, observability, cost and incident readiness
Status: Platform baseline · Owner: Platform/Security

## Environment strategy
Separate dev/staging/prod accounts, managed secrets, region-controlled data storage, IaC, audit log centralization, staged rollout flags. Use synthetic/de-identified data outside production. Never assume healthcare-system integration or deployment in UAE without partner/security approval.

## Reliability
Upload workflow states `queued→extracting→review_needed→verified` with safe retry and dead-letter handling. All jobs carry version, profile context, idempotency key, cancellation semantics and trace ID. Keep original uploaded document immutable and separately encrypt derivative artifacts. Backups encrypted and restore tested.

## Cost & model routing
Track cost per upload, per verification, per AI chat request and per activated Wellness user; model-router chooses cheapest evaluated safe model, not arbitrary dynamic downgrade. Cache deterministic normalized clinical facts with versioned invalidation; only cache personal outputs under profile-specific permission key. Set spending limits per feature, account and environment.

## Runbooks
Provider outage → deterministic UI fallback; OCR stuck → retry/dead-letter/user visibility; profile access leak → isolate/revoke tokens/incident response; unsafe AI content → disable template/model feature flag and review; moderation surge → freeze posting and expose safety banner if needed; bad clinical rule → rollback rule version and invalidate derivatives.

## Observability dashboards
Queue age and failure rate, storage errors, model provider latency, tokens/cost, rule version, source provenance completeness, privacy denials, unsafe-content rates, consent withdrawal propagation, 3-month wellness follow-up completeness and opt-out/burden.

## Gate
Production launch requires signed legal/clinical/security review, tested backup restore, on-call/incident roles, model and data residency review, privacy notice, accessibility signoff and controlled rollback plan.
