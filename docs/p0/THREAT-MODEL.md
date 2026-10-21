# Profile and consent threat model

Status: Engineering threat model, BV-003; specialist review deferred under REVIEW-DEFERRAL.md. Updated: 21 October 2026. Requirements 03, 04, 18, 36, 47, 49, 52, 56, 59. Specialist approval is not claimed; current mitigation evidence is distinguished from planned controls below.

## Current implementation evidence

Verified-email sessions, session-derived actors, exact-origin writes and fresh database session reads are implemented. Managed family profiles need no member email; the authenticated manager and record subject remain distinct. A verified manager can administer profiles they own; access to another manager's profiles requires accepted grants with the exact category/action/purpose and active sharing consent. Contact email alone grants no account access.

| Control                                 | Implemented evidence                                                                                                                       | Remaining boundary                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Profile/consent isolation and audit     | PROFILE-IMPLEMENTATION.md and PROFILE-CONTEXT.md under docs/engineering; real viewer/outsider/revocation tests                             | Future clinical, AI, export and device endpoints must reuse the application policy                     |
| Browser context and shared-device reset | Visible picker, immediate clearing, cancellation, rejected-switch empty state and separate-session Chromium checks                         | Future report/chat caches must use the same guarded context                                            |
| Private files and queued work           | Encrypted local files, authenticated 60-second tickets, transaction-bound audit/outbox, fenced retry/replay and fresh worker authorization | Upload scanning, cloud keys/roles, backup/retention/deletion and provider processing remain later work |
| Source fidelity and correction          | Immutable source evidence, verified identity binding, correction history, sealed derived lineage and restricted-role RLS                   | No clinical comparability rule or interpretation is enabled                                            |
| AI and Community trust separation       | Strict request/tool contracts, no direct provider SDK/network access outside reviewed adapters, moderation rejects private evidence        | The AI Gateway and live Community services are not implemented by P0                                   |

Detailed regression evidence is in [the contract and permission gate](../engineering/CONTRACT-PERMISSION-GATE.md). The following matrix/register defines the continuing design obligations, including future services.

## Data flow and trust boundaries

Untrusted browser/mobile → API session verification → application authorization/consent → module repository → private DB/object storage. Upload bytes → scanning/identity quarantine → extraction candidates → human verification → immutable observations → reviewed deterministic analytics. All transitions carry server-bound actor/profile context, revision and trace metadata. Outbox jobs carry opaque IDs and idempotency keys; workers re-authorize before data fetch and side effects. Signed download URLs are short-lived and scope checked before issuance.

Authorized domain tools → orchestrator → Gateway minimization/policy → approved processor → schema/grounding validation → client allowlisted renderer. Reports/posts are data, never instructions. Separate Community public identity/store → moderation → curated/public display; there is no public-to-clinical trust promotion. General events/logs contain no medical payloads.

## Proposed access matrix

Every permission also requires authenticated actor, selected profile, action/category, purpose, expiry, active consent and live revocation checks. Role is only a UI preset.

| Actor            | Own record                                       | Relative record                                | Export/write                           | Community                            |
| ---------------- | ------------------------------------------------ | ---------------------------------------------- | -------------------------------------- | ------------------------------------ |
| Verified owner   | Explicit scopes                                  | Active accepted grant only                     | Explicit scope and confirmation        | Separate public identity             |
| Caregiver/viewer | Own scopes                                       | Only granted categories/actions                | Never inferred from role               | No inherited health context          |
| Invitee          | Own scopes                                       | Denied until verified acceptance/owner consent | Denied without grant                   | Independent                          |
| Support/admin    | No routine clinical access                       | Denied                                         | Reviewed break-glass policy unresolved | Moderation role only                 |
| AI tool          | Service rechecks actor/profile/consent each call | Never selected by model text                   | Read-only Health MVP                   | Moderation receives no clinical data |
| Worker           | Scoped job context, current permission           | No broad family access                         | Recheck before effect                  | Isolated Community jobs              |

Separate consent: Health processing, Health-to-Wellness use, AI third-party processing, family sharing, devices, notifications and Community participation. Family consent alone does not permit AI processing. Invitations are not grants. Profile switches clear caches, embeddings/context references and view state before new fetches.

## Threat register and required evidence

| Threat                        | Proposed mitigation                                                       | Required negative test / evidence                                                         |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| IDOR or forged profile        | Session-derived actor; profile/action checks in services and row policies | A cannot query B by API, tool, export, storage URL or job                                 |
| Revoked grant/consent replay  | Permission versions in cache keys; invalidate contexts; live checks       | Revoke mid-chat/job/download and deny future fetches; define signed-URL residual lifetime |
| Wrong patient upload          | Identity quarantine before publication                                    | Mixed names never attach automatically                                                    |
| Malicious PDF/post            | Fixed tool schemas, inert content, gateway isolation                      | Injection cannot alter tools or retrieve another profile                                  |
| Worker replay/confused deputy | Idempotency, scoped job owner, cancellation, current auth                 | Replayed event causes no duplicate effect; revocation blocks queued effect                |
| PHI in logs/errors/vendor     | Allowlisted telemetry; minimized prompts; approved retention/residency    | Log capture and outbound payload inspection on synthetic fixtures                         |
| Cache or shared-device leak   | Actor/profile/grant/data/rule versions; logout clear; no public cache     | Switch/logout removes prior rendered and cached personal content                          |
| Community deanonymization     | Distinct public identity; no automatic sharing                            | Public endpoints cannot resolve clinical/family context                                   |
| Untrusted derived facts       | Immutable sources and reviewed versioned rules                            | Correction invalidates derived trends/AI context and preserves lineage                    |

## Residual risks and approval questions

Define retention/deletion of immutable evidence, backups and legal holds; exact revocation propagation/URL expiry; break-glass scope; provider retention/transfers; jurisdiction/age assurance and guardianship; encryption/key ownership; audit access/retention and incident contacts. Community posting stays OFF. Real patient data and external processors remain unavailable until policy and security gates pass. Security/Privacy must approve the matrix, data flow, residual risks and test plan with named/date evidence after BV-001.
