# Foundation P0 engineering closeout

Date: 21 October 2026. Scope confirmed by the owner: **phase P0, BV-001–BV-007**, not every P0-priority task across the roadmap. This record supersedes initial reports about an empty repository or a blocked local development gate.

The six non-deferred foundation engineering deliverables are implemented. The local development gate is open. BV-004 remains in the backlog under the owner's existing reviewer deferral. The tracker retains In Review for the other six tasks because its original Done criteria require formal review/PR evidence; no remote repository or reviewed PR exists yet. The full review gate remains separate from engineering completion.

## Acceptance evidence

| Task   | Engineering deliverable                                                                             | Evidence and disposition                                                                                                                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BV-001 | Three-tab navigation, shared assistant/profile context, read-only Community scope and user journeys | OWNER-DECISIONS.md, REVIEW-PACKET.md journeys, implemented Next.js routes/picker and Chromium Community on/off checks. Owner scope approval is recorded. Future domain screens follow the same shell; P0 does not promise report processing or AI chat.                                                                                        |
| BV-002 | Modular-monolith architecture and dependency rules                                                  | ADR-001, actual API/web/module/shared/infrastructure topology, AST import enforcement and negative tests. Owner technology direction is accepted. Separate browser transport uses public contracts and a fixed loopback host.                                                                                                                  |
| BV-003 | Profile/consent threat model, trust boundaries, failure cases and residual decisions                | THREAT-MODEL.md now distinguishes implemented controls from planned services. Session identity, per-profile scopes, independent consents, audit, revocation, signed access and queued-job checks have real PostgreSQL/HTTP regression evidence. Specialist review remains deferred.                                                            |
| BV-004 | Reviewer and golden-set governance charter                                                          | REVIEW-PACKET.md defines independence, backup/escalation, versioned synthetic fixtures, source fidelity, correction/reapproval and promotion criteria. Actual reviewer appointment stays Backlog as explicitly requested; no person or signoff is invented. The 50-case extraction corpus belongs to BV-018.                                   |
| BV-005 | Reproducible local tooling, build/types/lint, configuration, tests and CI configuration             | Pinned lockfile, strict TypeScript, ESLint/Prettier, local PostgreSQL runtime and migration tooling, isolated regression harness, Windows/Linux CI configuration and baseline-preservation validators. Clean-install validation is recorded below. Hosted CI and a reviewed PR remain outside the local evidence.                              |
| BV-006 | AI Gateway/provider/tool boundary contracts                                                         | ADR-002 and shared/contracts/src/index.ts provide versioned request/result ports, bounded budgets, selected-profile verified-evidence validation, moderation separation and tool policy descriptors. Negative contracts/import tests pass. Live Gateway/provider implementation is P4; specialist review is deferred.                          |
| BV-007 | Recorded development scope and remaining launch decisions                                           | UAE/India markets, local PostgreSQL, synthetic local development, English first and accepted stack are recorded in OWNER-DECISIONS.md and the decision log. Production hosting/region and minors/guardian policy remain explicit open decisions; no minors workflow or real-data environment is enabled. Specialist launch review is deferred. |

Paths above are relative to this directory unless they name a repository directory. The [current application README](../../README.md), [engineering guides](../engineering/LOCAL-DEVELOPMENT.md) and [contract/permission gate](../engineering/CONTRACT-PERMISSION-GATE.md) describe the implemented P1 platform separately. Original requirements, task definitions, dependencies and historical evidence remain preserved.

## Validation and repeatability

Run on Node 22:

```sh
npm ci
npm run check
npm run build:web
npm run gate:p0
python tools/validate-tracker.py
python documentation/BiovitAI-Documentation-v2.1/tools/validate_package.py
```

For a live native PostgreSQL development process, stop it before replacing its installed binaries with `npm ci`; alternatively validate the clean install in an isolated workspace copy. The closeout uses the latter so the development data and preview remain available.

The gate now verifies that recorded approval/development evidence resolves to an existing file inside the repository. Missing files, directory references, absolute paths and outside-repository references cannot open it. This verifies artifact presence, not the authenticity of human approval. Negative gate tests preserve the distinction between owner-authorized local development, reviewer deferral and full review.

Current result: 41 core/contract/client checks pass on Node 22, including the two new evidence-presence regressions. An isolated clean lockfile installation (`npm ci`, 167 installed packages / 169 audited, zero vulnerabilities), its checks and optimized web build pass. The existing platform regression evidence also includes 48 PostgreSQL/HTTP tests and two Chromium journeys in each Community state; those belong to the delivered P1 slices rather than additional P0 scope. `npm run gate:p0` reports OPEN; `npm run gate:p0:full` remains CLOSED as expected for the explicitly deferred reviews and absent formal completion evidence. Source/tracker reconciliation is recorded in project-management/P0-Engineering-Closeout.json.

## Scope of completion

No additional foundation implementation is outstanding for the approved synthetic local-development scope. The deferred reviewer appointment, formal reviews/PR and remaining production/minors decisions stay visible in their existing records. Later phases—including report upload, OCR, clinical analytics, live AI, wellness and Community services—remain separate work. This closeout neither changes their priorities nor advances them.
