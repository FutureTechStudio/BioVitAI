# Health Story 1 — implementation and evidence

Implemented 22 October 2026, on `codex/bioflow-ui`, as the first connected-journey increment (CJ-001–CJ-004). This is local engineering evidence with synthetic data. Original BV task statuses, deferred specialist review, participant signoff and hosted release acceptance are unchanged.

## Delivered experience

- **Dashboard:** a profile-specific record digest, changes since that actor's review point, and a short queue of record tasks or user-recorded questions. Supporting report/result counts remain available. Reviewing a snapshot changes the actor's checkpoint, never a medical record.
- **My Health:** a dated, approximately dated and undated timeline over existing reports/results and new context records. Event-date and recorded-date order remain distinct. Filters support event type and date interval; approximate periods use interval overlap. Unknown dates remain visible. Results retain distinct source IDs and correction lineage.
- **Personal context:** reported conditions or concerns, medicines, allergies and recorded care guidance. Entry distinguishes personal/caregiver reporting from a user-confirmed transcription of an existing verified document. Optional medicine details, guidance follow-up dates, uncertainty, historical states and possible conflicting records remain explicit.
- **Corrections:** append a new immutable revision with a reason. A stale editor retains its draft, shows the newer revision and requires an explicit rebase before resubmission. Original versions remain inspectable. The app does not decide which potentially conflicting instruction is clinically correct.
- **Sources:** timeline results open the exact report page and extracted field region. Context transcriptions open the cited page/excerpt. If a cited report is withdrawn or stops being eligible, its associated context content and correction reason are withheld from current and historical views; lineage is retained.
- **Source readability:** outside outlines preserve the original text. Android adds 100–400% zoom, horizontal panning and reset; resetting also clears the pan offset so the complete page returns.
- **Android:** the same digest and a focused `/story` screen reached from My Health, with context editor, revision history and source-page navigation. The three existing bottom tabs remain.

The factual summary does not diagnose, rank clinical urgency, check medicine interactions or endorse treatment. The existing assistant continues to retrieve verified laboratory evidence only: the new context records are **not sent to AI** in this increment. Wider citations and contextual AI retrieval belong to CJ-008.

## Contracts and persistence

The strict, versioned schemas are in `shared/contracts/src/journey.ts`; shared editor presentation models are in the `@biovitai/journey` workspace. Dates distinguish unknown/year/month/day precision and validate real calendar values. Observation time, recording time and context exposure periods remain separate. Reporter authority is derived on the server, not accepted from client claims.

Migration `0012_health_story.sql` adds append-only context versions and actor-specific review checkpoints. It preserves existing accounts, family IDs, reports, observations, grants and encrypted objects. Forced row-level security requires subject binding. Immutable triggers prevent update/delete/truncate. AES-256-GCM encrypts context payloads and checkpoint manifests with purpose-derived keys and profile/version authenticated data. Idempotency fingerprints and snapshot revisions use keyed hashes.

| Endpoint                                   | Behavior                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `GET /v1/health/journey`                   | Current selected profile snapshot and actor checkpoint.                                                           |
| `POST /v1/health/journey/query`            | Filtered/paged timeline; expected snapshot prevents mixing generations.                                           |
| `POST /v1/health/journey/records`          | Confirmed creation or append correction; expected revision and idempotency key required.                          |
| `GET /v1/health/journey/records/:recordId` | Authorized immutable revision history.                                                                            |
| `POST /v1/health/journey/review`           | Save the exact current snapshot as this actor's review point; idempotent replay cannot acknowledge later changes. |

Every private operation checks active subject/revision and current health-care permissions. Read-only caregivers can inspect records and keep their own review point but cannot edit context. Revoked access fails closed. Browser CSRF/origin checks and native session rules are retained. Payloads, excerpts, dates, labels and encryption material are not added to trace logs.

The current projection reads authoritative records on demand rather than maintaining a second medical database. Corrected observations resolve through their original lineage; withdrawn evidence disappears from the effective projection. The manifest identifies semantic source/version changes, including withdrawal, without depending on mutable display copy. Source-qualified historical additions are labeled as backfill rather than new illness. Task order reflects record-workflow states and explicit user context, not inferred medical risk.

Explicit bounds: 500 context heads, 10,000 snapshot items, 40 timeline events per page and 1,000 history revisions. Exceeding a bound produces an explicit limit response. No silent truncation or clinical aggregation is introduced. This local-pilot implementation has no new materialized cache or clinical-rule engine to rebuild.

Web/native requests use existing cancellation and publication guards. Profile switches reset editors, dialogs, filters, histories and source previews. The story revalidates every 15 seconds as well as after edits; stale pagination and review requests return a conflict instead of acknowledging newer evidence accidentally.

Native editor/history panels use the device's safe-area insets rather than fixed top padding. Android's system status bar had intercepted controls in the initial rehearsal. The editor also offers an explicit keyboard dismissal control, with native Android modal resizing and iOS padding behavior. Implementation follows the installed [Expo 55 safe-area integration](https://docs.expo.dev/versions/v55.0.0/sdk/safe-area-context/) and [React Native 0.83 keyboard API](https://reactnative.dev/docs/0.83/keyboard); iOS behavior is source-configured, not device-validated. The debug rehearsal driver spaces injected R keys beyond React Native's double-R reload window and re-reads control positions after keyboard transitions.

## Rehearsal and demo

`tools/seed-story-demo.mjs` extends only the dedicated local synthetic demo account, including its email-less family profile. It creates medicine/context examples, unknown and approximate dates, reported conflicting instructions, a source-qualified note, correction history and historical backfill. It preserves existing reports, user edits and review points on replay. Credentials and record identifiers stay in the ignored local cache.

Use **My Health → My health story → Add health context**, inspect the existing synthetic timeline, then return to Dashboard to review the digest. `tools/android-story-rehearsal.mjs` drives the dedicated synthetic account on the local emulator, logs control-level steps without credentials/payloads and captures evidence.

## Executed verification

| Gate                                          | Result and scope                                                                                                                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core, lint, boundaries, format and TypeScript | `npm run check`: 55 core tests; API, web and native type checks.                                                                                                                                                                                               |
| PostgreSQL integration                        | 70 passing tests, including concurrency, replay, immutable encrypted history, row-level security, stale snapshots, caregiver access/revocation and encrypted backup/restore. Wrong restored keys fail closed.                                                  |
| Production Chromium, real report tools        | 6 passing journeys with local ClamAV/OCR, accounts, isolation, BioFlow, assistant and the new story journey.                                                                                                                                                   |
| Community disabled                            | 5 passing, 1 intentionally skipped report-tool journey. Existing unavailable/paused states remain usable.                                                                                                                                                      |
| Populated presentation audit                  | Ten synthetic captures; no Axe WCAG 2/2.1/2.2 A/AA violations or page overflow in the exercised desktop, tablet, 390px, 320px and 200% RTL views. Includes history/editor, Dashboard and exact source navigation.                                              |
| Android bundle                                | Expo Android export succeeded; shared editor is a registered workspace package so Metro resolves it.                                                                                                                                                           |
| Android emulator                              | Fresh sign-in → create an attributed medicine with an approximate date → append correction → inspect history → exact source page → family switch → 150% text passed on API 36. A separate source recheck passed 200% zoom, horizontal pan and full-page reset. |

WebKit passed the new story and existing assistant journeys. Its broader route audit passed the isolated rerun after one navigation interruption.

The story browser journey exercises concurrent correction/draft preservation/rebase, revision history, a recorded guidance conflict, unknown dates, actor review/backfill and switching profiles during a delayed save. Integration uses controlled scanner/extractor fixtures where appropriate; the separate production report journey uses the real installed tools. Automated audit coverage is limited to the exercised views and does not establish complete manual screen-reader conformance.

Current screenshot/audit files are in [the evidence directory](../../documentation/design-system/evidence/health-story-2026-10-22/). The [coverage inventory](../../documentation/design-system/UI-MIGRATION-COVERAGE.md) records implementation and each validation dimension separately. The [connected journey tracker](../../documentation/BiovitAI-Documentation-v2.1/project-management/Connected_Journey_Tracker.json) tracks this increment independently from the original 51 product tasks.

The workbook adds a Journey sheet while preserving all six existing worksheet parts byte-for-byte. Import validation exposed a missing namespace in the previous BioFlow sheet registration; the workbook metadata was repaired and full package XML parsing was added to the tracker validator. Original task/decision records and native sheet features are retained. CSV/JSON/XLSX reconciliation covers the new 18-epic workstream independently.

## Change map

| Area                      | Main changes                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts and data        | `shared/contracts/src/journey.ts`, `shared/journey/`, migration `0012_health_story.sql`, purpose-bound encrypted JSON.                                   |
| API and projection        | Journey controller/bootstrap and the health module's journey contracts, domain, application and PostgreSQL adapter.                                      |
| Web                       | New health-story views, Dashboard digest, My Health integration, exact source links, accessible upload icon and responsive BioFlow styles.               |
| Android                   | Story route/editor/history, overview digest, safe areas, source-page linking, readable outlines and zoom/pan/reset.                                      |
| Verification and evidence | Core/DB/browser story tests, native rehearsal, synthetic demo extension, coverage inventory, connected-journey CSV/JSON/XLSX and package-XML validation. |

The inventory now registers 132 surfaces (129 applicable). Its validation dimensions remain independent: 112 functional, 103 visual, 72 responsive and 57 automated accessibility passes across the entire accumulated inventory; remaining entries are explicitly untested/unreviewed rather than implied accepted. J1 adds 14 source surfaces. See [the resolved rehearsal findings](../../documentation/design-system/evidence/health-story-2026-10-22/FINDINGS.md).

## Remaining work

J2 connected evidence/knowledge operations is the next planned slice; J3 expands contextual explanations and citations. Clinical interpretation/mapping activation still requires actual approved definitions. Document classification/extraction beyond the existing laboratory-report workflow, goals/check-ins, reviewed wellness actions, education, notifications, device feeds and community participation remain later increments. Live AI configuration, physical-device/iOS testing, Firefox validation, full manual TalkBack/screen-reader testing, participant research and human signoff remain separate acceptance items.
