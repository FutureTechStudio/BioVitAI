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


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** The default deployment is a modular monolith with clear domain ownership, not separate microservices by default. Frontends and agents never call model providers or databases directly; all model traffic passes through the central AI Gateway via authorized application workflows.

**Related v2.1 requirements:**
- [47-MODULAR-ARCHITECTURE-AND-BOUNDARIES](47-MODULAR-ARCHITECTURE-AND-BOUNDARIES.md)
- [48-AI-GATEWAY-AND-AGENT-SERVICES](48-AI-GATEWAY-AND-AGENT-SERVICES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
