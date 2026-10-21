# 47 — Modular architecture and service boundaries
Status: Architecture decision proposed · ADR-001 · Owner: Tech Lead

## Recommended topology: modular monolith first
One deployable backend to start, internally divided into strict modules. Extract network services only after independent scale, ownership or reliability requirements justify overhead. Avoid distributed transactions and premature queues between modules where a local transaction is sufficient.

```text
Web / Mobile Apps
      │ HTTPS / OIDC
BFF / API controllers ── authn, rate limits, request schemas
      │
Application service layer ── per-tab use cases, policy + consent
      │
┌─────────────────── Domain modules ───────────────────┐
│ Identity/Profiles  Health  Wellness  Community       │
│ Clinical Analytics   Notification  Audit            │
│ AI Orchestrator → permission-checked typed tool API  │
└──────────────────────────────────────────────────────┘
      │                         │
Persistence ports         AI Gateway (shared infrastructure)
      │                         ├─ preprocess / redact / minimize
PostgreSQL + object store       ├─ provider adapters / budget / retry
      │                         ├─ prompts / structured validation
Transactional outbox             └─ model providers (external)
      └─ background workers / queues for upload, analytics, notification
```

## Dependency policy (enforce via import/lint tests)
- `apps/*` → public API only; never provider keys, direct DB or third-party LLM endpoints.
- `api/controllers` → application services; **no business logic** in controllers.
- `modules/*/application` → domain policies and own repository ports; cross-module use through explicit interface or contract events.
- `modules/*/domain` → pure logic, no HTTP, ORM, provider SDK, queue client or prompt template.
- `ai/orchestration` → authorized tools + Gateway interface; agents **never directly access persistence or model SDKs**.
- `infrastructure/ai-gateway` is the sole place for provider SDKs/keys and network calls; secret management delegated to runtime.
- Clinical analytics is deterministic and evidence-versioned. LLMs explain validated results, not invent diagnoses or numerically aggregate observations.

## Data ownership
Identity owns users/profile access grants; Health owns source reports, individual observations, provenance, aggregates, trends; Wellness owns goals, actions, check-ins and decision logs; Community owns posts/moderation. Shared IDs are opaque, not copied clinical rows. Separate health and community schemas and access policies; tenant/profile IDs on every sensitive row; object-store links are signed and short-lived.

## Transaction and event guidance
Use module transaction + transactional outbox. Consumers idempotent; version events and retain event IDs. Example: `health.report.verified.v1` may invalidate only relevant cached trend/assistant context; Wellness listens and updates *eligibility candidates*, not user goals without approval. Use async queues for OCR, long-running analysis, messaging and moderation; record cancellation and retries.

## Engineering decisions to record
ADR-001 modular monolith, ADR-002 shared AI Gateway, ADR-003 source-observation immutability, ADR-004 consent/profile scope, ADR-005 wellness action review, ADR-006 Community trust boundary, ADR-007 worker/outbox reliability.

## Suggested repository shape
```text
/apps/{web,mobile,api,worker}
/modules/{identity,health,wellness,community,ai,notifications,audit}/
  src/{domain,application,contracts,infrastructure}
/shared/{contracts,authz,errors,telemetry,design-system}
/infrastructure/{ai-gateway,db,storage,queue,feature-flags}
/tests/{unit,integration,contract,e2e,security,clinical-golden}
/docs/requirements
```
Module CI rule: no import of another module's `infrastructure/` and no direct model SDK outside `infrastructure/ai-gateway`.
