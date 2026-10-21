# ADR-001: Modular monolith and repository topology

Status: Owner-accepted direction for local development; engineering acceptance evidence tracked separately. Date: 2026-10-20.
Tasks: BV-002, BV-005. Requirements: 19, 44, 47, 49, 50, 55.

Adopt one backend deployable with Identity, Health, Wellness, Community, AI orchestration, Notification and Audit modules. API controllers delegate to application services. Each module owns its repositories; other modules use public contracts. Domain logic has no HTTP, ORM or model dependencies. AI orchestration has neither persistence nor provider access. Provider SDKs belong only to the Gateway infrastructure adapter.

Use the topology in the root README, with one npm workspace for shared contracts initially. Add workspaces only when real module implementations exist. Local tooling uses strict TypeScript and runtime Zod schemas, ESLint, Prettier and Node tests. The owner accepted Next.js web, React Native mobile, TypeScript backend and PostgreSQL; Next.js/React and the local PostgreSQL runtime are now implemented. React Native remains later work. Local identity uses Better Auth, private files use the encrypted filesystem adapter, and jobs use PostgreSQL; production infrastructure vendors and region remain unresolved. Alternatives are Flutter (different UI language), separate microservices (unjustified operational cost), or untyped JavaScript (weaker compile-time contracts).

The [foundation closeout](../p0/FOUNDATION-CLOSEOUT.md) records current engineering evidence and the owner's separate development authorization. Automated boundary enforcement now covers actual API/web/modules and the reviewed browser transport. It must expand with new aliases and adapters. This ADR does not claim a reviewed PR, independent specialist signoff or production readiness.

Acceptance record: The project owner explicitly accepted the proposed stack/topology in chat; recorded in docs/p0/OWNER-DECISIONS.md and approvals.json. This is owner approval, not an invented independent specialist review. Engineering task completion and repository/PR evidence remain separate. Revisit service extraction only for demonstrated scale, ownership or availability needs.
