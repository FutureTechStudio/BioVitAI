# Delivery, evaluation and acceptance plan

Workstream for [the connected health blueprint](README.md), 22 October 2026. Health Story 1 (CJ-001–CJ-004) is implemented; [engineering evidence](../../docs/engineering/HEALTH-STORY-1.md) and the [connected-journey tracker](../BiovitAI-Documentation-v2.1/project-management/Connected_Journey_Tracker.json) record actual progress. The remaining CJ designs below are proposed and are not implied complete by their dependency links. Original BV task IDs/statuses and review records remain unchanged.

## 1. Delivery strategy

Deliver complete journeys that connect source, explanation and next step. Do not implement every new backend table first or build seven independent page redesigns. Each slice includes contracts, permission tests, migrations if needed, web/native presentation, synthetic examples, failure states and a recorded demonstration.

Keep the current BioFlow tokens/components, family avatar controls, floating assistant, web URLs and three native tabs. Extend presentation where a task needs it. No speculative graph database, microservice split, autonomous agents, paid medical dataset or new hosting purchase is assumed.

The previous 31-week roadmap was illustrative. Staffing, review availability and content sourcing are unknown; this blueprint makes no new calendar commitment. Estimate after contracts and the first slice expose the actual migration/content effort. Backend, web/native, QA and clinical/content responsibilities can be shared by a small team, but clinical-rule review must not be fictionalized as an engineering check.

## 2. Recommended sequence and visible increments

| Slice | User-visible increment | Dependencies and exit demonstration |
| --- | --- | --- |
| J1 — My health story | Source-qualified context capture; dated/undated timeline; source-linked factual summary; Dashboard change digest and record-task queue. | Reuse existing reports/context guards. Demonstrate historical backfill, correction and caregiver switching without any new clinical interpretation. |
| J2 — Connected evidence | Maintained knowledge workflow; reviewed focus mappings; explainable focus details and limitations. | J1 plus real review/activation for any active clinical meaning. Synthetic definitions can validate plumbing while reviewer appointment remains deferred. |
| J3 — Contextual explanations | “Ask about this,” wider typed citations, timeline/focus explanation through current services. | J1/J2 contracts as applicable; versioned AI schemas and consent notice, citation/currentness tests. No-provider fallback remains functional. |
| J4 — Chosen goal and tracking | User-defined goal, prospective opportunities, voluntary check-ins, pause/history and explicit progress denominator. | User-controlled tracking can be built independently of personalized suggestions. Do not present user-authored content as reviewed medical advice. |
| J5 — Reviewed actions and impact | Small action catalogue, targets/constraints, deterministic eligibility, explicit acceptance and three variants. | Knowledge operations and required health-to-wellness consent. No live personalized catalogue activation until actual content/eligibility review. |
| J6 — Follow-up and recovery | Weekly reflection, user-confirmed adaptation, retained achievements and noncausal evidence-over-time view. | J4/J5, revision invalidation and context change handling. Show both behavior missingness and later measurement context. |
| J7 — Reliable learning | Curated read-only education with sources, dates, review state and private question-saving. | Content operations and Community trust-boundary checks. Personalized public-feed inference is excluded. |
| J8 — Operational pilot increment | Full journey rehearsals, restore/rebuild drills, accessibility/comprehension work and staged flags. | Required per-slice evidence plus actual participant/reviewer input only when supplied. This is not a substitute for jurisdiction or clinical signoff. |

Reviewed clinical content work should start early because its lead time affects J2/J5. Meanwhile J1 and the non-prescriptive tracking mechanics of J4 remain useful engineering work. Community posting, device connections and delivered reminders are separate expansions, not prerequisites for the first meaningful health journey.

## 3. Proposed epics and acceptance evidence

| ID | Work package | Depends on | Original work linkage | Required result |
| --- | --- | --- | --- | --- |
| CJ-001 | Experience/domain contracts: record authority, date precision, source types, permission/consent matrix, route ownership and fact/claim language. | Current source baseline | BV-009–BV-013; BV-019–BV-028 | Versioned schemas and a source-to-screen trace; no ambiguous global `verified` flag or silent scope widening. |
| CJ-002 | Typed conditions/medication/allergy/context assertions and documented instructions; confirmation/conflict workflow. | CJ-001 | Health scope extension; BV-010 | Manual/source-qualified records with reporter/authority, unknown dates and immutable revisions; no diagnosis/prescription engine. |
| CJ-003 | Journey projection, existing-report backfill, timeline filters, source drilldown and undated lane. | CJ-001; CJ-002 for new context kinds | BV-010; BV-019–BV-023 | Rebuildable chronological view preserving original IDs and effective/upload/revision times. |
| CJ-004 | Change digest, actor review checkpoint, workflow/user priority queue and Dashboard simplification. | CJ-003 | BV-012; BV-020 | Historical backfill not misrepresented as new illness; ranked tasks expose reasons; read state does not change evidence. |
| CJ-005 | Knowledge definitions, review/activation/withdrawal ledger, privileged administration and version fixtures. | CJ-001 | BV-019–BV-023; BV-034 | Actual authority separates review from activation; unapproved/expired definitions cannot drive decisions. |
| CJ-006 | Focus taxonomy/mapping and evidence membership, including user collections and visible non-assessment. | CJ-003; CJ-005 | BV-019–BV-023 | Explainable typed membership, supporting/conflicting inputs and no diagnosis/organ score. |
| CJ-007 | Connected insights, factual change detail, knowledge applicability and constrained next-step presentation. | CJ-002; CJ-005; CJ-006 | BV-019–BV-023 | No false compatible trend, unsupported relationship or invented freshness/testing requirement in controlled fixtures. |
| CJ-008 | Contextual read tools and versioned AI citation/answer schemas for timeline, context and focus evidence. | CJ-003; CJ-007 for focus tools | BV-024–BV-028 | Current authorized citations and claim-support evaluation; stale/injected/mixed-profile answers rejected. |
| CJ-009 | Wellness baseline, user goals, prospective opportunities, manual check-ins and pause/history. | CJ-001 | BV-033; BV-036; BV-040 | Voluntary user-controlled tracking, source/actor labels, clear missingness and no endorsed personalized advice. |
| CJ-010 | Reviewed action catalogue and impact detail: targets, evidence, variants, restrictions and licensing. | CJ-005 | BV-034 | Small maintainable reviewed set; no invented individual benefit, review or interaction coverage. |
| CJ-011 | Deterministic eligibility, consented health summary, burden-aware selection and accepted plan versioning. | CJ-002; CJ-009; CJ-010 | BV-034; BV-035 | Required unknown context never returns an all-clear; blocked candidates cannot be ranked/recommended; explicit acceptance. |
| CJ-012 | Reflection, recovery, user-confirmed adaptation and behavior/outcome view. | CJ-009; CJ-011 for recommended plans | BV-036; BV-040; BV-041 | Preserved history, prospective changes, no silence-as-lapse and no causal laboratory claims. |
| CJ-013 | Wellness assistant read tools and later explicit draft-to-confirmed-write proposals. | CJ-008; CJ-011; CJ-012 as applicable | BV-037 | Separate wellness consent and write checks; model output alone cannot accept a plan or edit clinical treatment. |
| CJ-014 | Reviewed education and private question-saving with independent Community identity/trust boundary. | CJ-005; CJ-002 for private question records | BV-042; BV-043; BV-045 | Source/review/expiry labels, no private feed leakage and no promotion of community opinion into knowledge. |
| CJ-015 | Cross-module generation/invalidation, data lifecycle, privacy-aware search, restore/rebuild and operational metrics. | CJ-001 onward, incrementally | BV-011; BV-029–BV-031; BV-047–BV-048 | Correction/withdrawal/grant/rule changes invalidate every relevant dependent surface; restored permissions and lineage match. |
| CJ-016 | Web/native journey QA, accessibility, comprehension study plan, content/claims review and staged rollout evidence. | Each slice; final integrated run | BV-029–BV-032; BV-041; BV-049–BV-051 | Engineering and human results recorded separately; no automatic human signoff or untested platform claim. |
| CJ-017 | Optional manual-vital expansion, device connectors and preference-driven delivered reminders. | CJ-003; CJ-009; separate consent/operations design | BV-038; BV-039 | Genuine measurement provenance, explicit connector consent, quiet hours and cancellation; no implied emergency monitoring. |
| CJ-018 | Optional professional submissions and moderated community participation. | CJ-014; staffed moderation and policy | BV-044–BV-046 | Review/report/block/appeal controls and human escalation before posting activation. |

Security, accessibility and invalidation are built with each package; CJ-015/016 do not defer them until the end. Original backlog links identify overlap, not a claim that these added requirements were already included in earlier engineering completion.

## 4. First implementation package: Health Story 1

This first build is implemented with recorded engineering evidence. The scope below remains its acceptance definition. It produces value without waiting for personalized clinical rules.

**In scope:**

- Finalize source-authority/date/context contracts and their migrations.
- Build the timeline over existing effective verified observations/reports, with unknown dates and historical upload handling.
- Add manual reported-context and documented-guidance entry, first with medicines, conditions/concerns and instructions; retain unknown and conflict states.
- Build a deterministic “What is recorded” summary and source drilldown; keep it descriptive.
- Replace the Dashboard's primary metric strip with a change digest and record/user tasks; retain counts in supporting detail/library.
- Preserve the existing source/verification workbench and improve navigation from timeline back to the exact source.
- Support the same journey on web and native, including email-less family selection, pending requests and access loss.

**Intentionally later:** automatic diagnosis, relationship interpretation without reviewed mappings, personalized clinical prioritization, medication interaction clearance, system-selected wellness prescriptions, device feeds and delivered notifications.

**Concrete acceptance session:** use a synthetic profile with four reports across 18 months, one later correction, an uncertain-date medication statement and two potentially conflicting recorded instructions. A user can reconstruct the history, identify each source/authority and prepare a question. Adding an old report is shown as historical evidence added. Switching profile during a pending read clears it. No screen calls the person healthy, ill, improving or safe for an action merely because the record is sparse.

Exit with a working vertical slice, migrations preserving existing IDs, automated evidence, screenshots, accessibility checks and clearly recorded unavailable future capabilities. Clinical reviewers are not required to invent or approve nonexistent interpretation rules for this factual slice.

## 5. Experience and interface acceptance

For every new module, produce the following before considering its implementation complete:

1. A task-based content hierarchy and responsive states, including empty, loading, partial, unknown, disputed, stale, blocked, unavailable and access-lost where relevant.
2. A visible selected-subject label and explicit actor/source authority where data is created or interpreted.
3. Keyboard and screen-reader labels, dialog focus/back behavior, large text, text alternatives for charts/body visualizations, reduced motion and RTL layout readiness.
4. A provenance route from each displayed fact/claim/decision to its current inputs. A graph edge without a reason/source is not a usable explanation.
5. A correction, cancellation and revocation path. Profile switching clears editors and attached AI context, not only visible cards.
6. A completion measure tied to user understanding/action, with missingness represented accurately.

Extend the BioFlow coverage inventory when actual routes/components/states are implemented. Do not add proposed screens as completed surfaces now. Preserve expanded web navigation and native back behavior; register any new proposed routes in the first contract/design increment.

## 6. Automated evidence and failure scenarios

Retain existing contract, permission, PostgreSQL, report-processing and browser tests. Add focused tests for meaningful new decisions rather than assertions that mirror CSS/component implementation.

| Area | Required synthetic cases |
| --- | --- |
| Timeline/time | Historical backfill; unknown/partial dates; issue versus observation time; tied results; timezone transitions; reported medication exposure period uncertain; correction to a historical event. |
| Source authority | OCR candidate versus confirmed transcription; caregiver versus clinician source; user-entered concern versus diagnosis; explicit none versus unknown; unsupported document type. |
| Comparability/connections | Same-name different specimen/method/unit; censored/qualitative data; valid pair versus multi-point sequence; wrong/missing mapping; contrary evidence; relationship outside the applicable period. |
| Knowledge | Draft never activates; unauthorized reviewer action denied; activation not implied by approval; expired/retired version invalidates decisions; replay/rollback reproduces expected output. |
| Priorities | Old report not ranked as new clinical deterioration; record task distinct from clinical attention; snooze/read state not medical resolution; future safety notices not hidden by three-card limit. |
| Eligibility/actions | Unknown medicine/restriction state; conflicting guidance; retired action; minimum/fallback with separate checks; duplicate action across goals; changed context after preview but before acceptance. |
| Progress/recovery | Unreported versus skipped; paused/excused opportunities; prospective schedule edit; partial completion; alternate variant; no false lapse from app silence; achievements survive recovery. |
| AI | Forged valid-looking citation; truthful ID with unsupported sentence; stale context; prompt injection in reports/guidance/content; mixed profiles; health-only versus wellness-only access; consent revoked before dispatch/delivery; budget exhausted concurrently. |
| Isolation | Switch away and back during pending reads/writes; revoke caregiver while source/chat/plan open; family email linking without automatic access; no private-data existence leaks in search/digest counts. |
| Operations | Worker failure/replay; stale projection read before rebuild; backfill interruption; knowledge rollback; backup restore and key recovery; subject-erasure design including derived data and backup retention. |

## 7. Proposed gates and measurement

These are proposed evaluation targets, not achieved results or validated clinical-performance claims. Freeze the test definitions before evaluation and retain failed cases. Define clinically meaningful acceptance with actual qualified review before activating those capabilities.

### Engineering gates

- Exact expected source fields, comparators, units and date precision on the controlled fixture set; zero known false identity merges and incompatible comparisons in those fixtures.
- Every published derived claim and decision resolves to a complete current dependency manifest in the tested cases.
- Every private endpoint/tool checks subject, authorization, purpose and revision; no stale/private publication after a tested context change.
- Every required unknown/blocked eligibility fixture prevents recommendation/acceptance as designed; no silent default to eligible.
- Every controlled invalidation event blocks stale decision reuse before asynchronous rebuild completion.
- All generated citation references resolve correctly; reference validity and substantive claim support are scored separately. A fabricated citation or material unsupported personalized claim is a blocking defect.
- Existing AI budget bound remains atomic under concurrency; deterministic functionality passes provider-unavailable and budget-exhausted journeys.
- Automated accessibility audits show no unresolved serious/critical violations in the exercised surfaces; full manual accessibility acceptance remains separate.

### Human evaluation plan

Propose an initial small, explicitly recruited adult/caregiver usability cohort after scope/consent arrangements are settled. A planning range is 8–12 participants, chosen to include older adults, caregivers and people with little medical knowledge; confirm feasibility before recruitment. This is exploratory research, not evidence of population-level benefit. No invitations are sent by this plan.

Ask participants to locate a source, reconstruct a sequence, distinguish reported context from a clinician-documented fact, explain why two values were excluded, choose a feasible task, pause/restart and explain the progress denominator. Record assistance needed, errors, perceived burden and misunderstanding. An illustrative product target is at least 80% unaided completion on each core task and no unresolved critical wrong-person/meaning misunderstanding; finalize thresholds and sample interpretation before running the study.

Manual keyboard/screen-reader/TalkBack, large-text, RTL and real-device checks need named evidence. Chromium/WebKit tests do not count as Firefox, iOS or participant validation. The current Firefox runtime limitation and lack of Apple environment remain until resolved and actually retested.

### Longitudinal value

Measure user-reported understanding, ability to prepare for a visit, chosen opportunities completed/unreported/paused, burden, voluntary recovery and sustained behavior at agreed intervals. Track source corrections and safety/negative experiences. Use consented context for equity analysis only; do not infer sensitive groups.

Do not interpret lower report-upload frequency, missing telemetry or no follow-up lab as a worse health outcome. Laboratory changes are observations with multiple possible explanations; attributing benefit to the app needs a separate study design and review.

## 8. Activation gates that remain distinct

| Capability | What can progress during the reviewer deferral | What must be true before activation for real participants |
| --- | --- | --- |
| Factual history/context | Schemas, source-qualified capture, synthetic UI/testing and engineering rehearsals. | Appropriate data-use/consent/access/operational arrangements for the actual pilot. |
| Clinical relationships/attention | Registry, disabled rules, synthetic scenarios and currentness tests. | Real clinical review, intended-use/applicability definition and evaluation of the active version. |
| Personalized wellness suggestions | Goal mechanics, synthetic action catalogue, eligibility and tracking. | Reviewed content/constraints, health-to-wellness consent, relevant context, safety evaluation and monitoring process. |
| Medication interactions | Reported medication capture, terminology design and a Not evaluated state. | Maintained licensed/authorized knowledge, reconciliation and independently evaluated coverage/action policy. |
| Live AI | Tool/schema tests, deterministic fallback and budget failure drills. | Configured key/model/pricing, reviewed processing arrangement, appropriate consent and supported-answer evaluation. |
| Community education/posting | Content workflow and read-only/paused interfaces. | Actual reviewed/licensed content; for posting, moderation staffing/policy/escalation/appeals and separate launch decision. |
| Market launch | Technical preparation and synthetic local testing. | India/UAE intended-use/claims, data processing, retention and jurisdiction assessment; security/operational release evidence. |

This honors the existing reviewer deferral without treating user consent as clinical validation. It does not introduce a new stop before factual product design or engineering can continue.

## 9. Decisions to settle during refinement

These questions do not block creation of this blueprint. Recommended starting positions are provided; they are not recorded as owner approvals.

| Decision | Recommended starting position | Why it matters |
| --- | --- | --- |
| First participant journey | Older-adult health history with a family caregiver, plus self-management through the same model. | Gives the core journey a concrete comprehension and continuity test. |
| First clinically mapped focus | One small, reviewable focus supported by the synthetic dataset; cardiometabolic context is a candidate, not an approved medical taxonomy. | Limits content/knowledge burden before expanding across the whole body. |
| First wellness scope | User-led goal tracking first; a small reviewed movement/sleep/routine catalogue only when applicability can be evaluated. | Builds daily value without promising comprehensive medical personalization. |
| Medicines in the first increment | Accurate attributed record and clarification workflow; no interaction all-clear. | Useful context can arrive before a maintained interaction service. |
| Manual context versus document extraction | Confirmed manual entry with source attachment first; specialized non-lab extraction later. | Avoids presenting the current lab parser as a universal clinical-document parser. |
| Reminders/devices | Optional later increments; in-app task/check-in loop works without them. | Avoids infrastructure and consent dependencies on the first slice. |
| Community | Reviewed learning after core journey; posting later. | Concentrates effort on the differentiation described in the notes. |
| Age/guardian policy | Resolve before actual participant enrollment or guardian features. | Current owner decisions leave minors unresolved. |
| Knowledge maintenance | Assign actual review/content ownership and choose authorized sources before live rule/content activation. | A rule is a maintained product dependency, not a one-time prompt. |
| Schedule and team | Estimate after CJ-001 and a source-to-timeline prototype; no fixed launch date yet. | Review, content and operational lead times are currently unknown. |

## 10. Planning validation performed

This package was checked against the supplied vision notes, the current web/native presentation record, Health evidence/comparability source, AI tools/answer contract, identity consent/scope contract, migrations, v2.1 Wellness/Community requirements and original task titles. External reference links are recorded in [the blueprint](README.md).

Only planning Markdown and discovery links are added in this task. No application behavior, schema migration, clinical rule, feature flag, product-task status or approval record is changed.

Executed planning checks: all 15 relative links across the four blueprint files resolve; Markdown code fences are balanced; all nine M00–M08 modules and 18 CJ epics are present; the root README passes Prettier; tracked Markdown diffs pass `git diff --check`. These are document-integrity checks. Application regressions were not rerun for this planning-only edit, and proposed acceptance scenarios are not represented as executed product tests.
