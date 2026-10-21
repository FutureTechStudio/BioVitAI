# Architecture and Infrastructure

## Suggested reference stack
Web: React/Next.js.
Mobile: React Native or Flutter.
API and AI orchestration: TypeScript backend.
Database: PostgreSQL.
Original reports: encrypted object storage.
Background work: queue + workers.
Cache: Redis or equivalent, strictly scoped.
Search: relational queries first; vector search only for narrative text when useful.
Observability: privacy-preserving traces and metrics.

These are suggestions, not hard dependencies.

## Services
Identity/permissions; profile service; report ingestion; observation store; clinical analytics; device ingestion; context manifest; AI orchestrator; response renderer; notifications; audit.

## Core boundary
LLM cannot directly query databases or storage. It requests versioned, schema-validated backend tools. Backend derives actor from authenticated session, validates profile authorization and logs access.

## Event flow
report.verified → normalize/reconcile → analytics.recompute → context.invalidate → organ_evidence.refresh → report_analysis.ready.

## Reliability
Idempotent event handlers, retry with backoff, dead-letter queue, structured failures, versioned data contracts, no PHI in generic caches.

## Deployment
Separate staging/production and synthetic test data. Define backup, restore, incident response and disaster recovery objectives before real patient launch.
