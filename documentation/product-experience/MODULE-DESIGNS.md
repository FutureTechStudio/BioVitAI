# Module experience designs

Target detail for [the connected health blueprint](README.md), 22 October 2026. [Health Story 1](../../docs/engineering/HEALTH-STORY-1.md) implements the factual timeline, context and digest increment. Other screen names and routes below remain proposed unless listed as current. Clinical examples are synthetic interaction scenarios, not instructions for care.

## M00 — Getting started, profiles and family care

### Outcome and ownership

The user knows whose information they are entering, what the app can do with it and how to reach a first useful health story. Identity owns accounts, subjects, grants and consent. Health owns health context; Wellness owns preferences and goals. A long account-profile form must not become the storage model for everything.

### First-run journey

1. Authenticate and verify the account using the existing flow.
2. Choose “For me” or “I help someone else.” Family creation still needs only a name; optional email can be linked later through the existing explicit invitation flow.
3. Show the selected subject clearly. Explain that switching selects their records without signing in as them.
4. Offer three entry paths: Add reports; Record what I know; Explore how it works with clearly separate synthetic examples. A demo must never silently mix with a real profile.
5. Ask only enough context for the immediate task. Uploading a report should not require completing a medication or lifestyle questionnaire.
6. After the first verified report, produce a factual story preview, show gaps and offer one relevant next action. Personalization questions appear when an action actually needs the answer.

### Ongoing profile controls

Keep the delivered avatar menu: My Profile, Switch Profile, Manage Profiles. My Profile concerns the account/self record. Manage Profiles owns family names, contact metadata and grants; health context is reached from the selected person's My Health page. Switching clears every private editor, drawer, search, citation, image, chart and chat before loading the next subject.

The selected person's context form records who supplied each item. A caregiver can say “I don't know.” An account email, relationship label or surname cannot establish patient identity or a clinical family-history fact. Ownership transfer and guardian/minor handling need separate policies; adding contact email does neither.

### States and acceptance

- First account/no profile: obvious creation and selection choices.
- Profile with no records: specific actions to add a report or personal context, without empty health conclusions.
- Restricted caregiver: readable permitted sections; unavailable data is not described as absent.
- Revoked grant during an edit: clear private content, reject stale saves and explain access loss.
- Interrupted onboarding: resume authorized completed steps without restoring a private draft into another profile.

**Acceptance demonstration:** create an email-less family profile, add its first source and reported medication, switch away during a pending request, return, then add contact details without changing its stable subject ID or granting access automatically.

**Measure:** completion of the first useful task and wrong-subject correction incidents. Do not equate answering sensitive questions with successful onboarding.

## M01 — Dashboard: what matters now

### Outcome and content hierarchy

The Dashboard is an orientation surface. It should help someone choose their next useful action in under a minute, without reading every report. Its content order is:

```text
Selected person · Last refreshed · Evidence scope
What changed since your last review
Your next steps — usually no more than three
Continue your current goal or care-follow-up task
Health story / evidence coverage preview
Recent records and source-review status
```

“Since your last review” uses a saved, per-actor/per-profile checkpoint. It is different from the last login, last upload and latest observation date. Let the user choose another comparison period. A report uploaded today about a measurement from years ago is “Older evidence added,” not “Your health changed today.”

### Change digest

Show record additions/corrections, newly comparable measurements and accepted plan changes as distinct event types. For an exact comparable pair, name the two observation dates and source values. “Increased” describes a numeric direction; “worsened” requires an applicable approved interpretation. Tied dates or incompatible groups remain separate. Acknowledging an item changes the actor's read state, not the medical record.

Without enough evidence, say what could not be compared and link to the reason. Avoid filling space with “Everything looks good” or an invented wellness percentage.

### Next-step queue

Each item answers **why it is here, what it is based on, who can act and what completing it means**. Categories are explicit:

- Record task: confirm identity, verify an extracted field, resolve a context conflict.
- User task: an accepted goal, question to prepare or follow-up date the user entered.
- Documented care task: an instruction captured from a source, with its date/status.
- Clinical attention: only a separately approved policy can produce this category.

Use a deterministic, explainable ordering within categories. Do not infer clinical urgency from abnormal-value count, missing data, AI confidence or engagement. The usual three-item display is a burden limit, not a limit on any future safety notice; an approved safety notice must not be hidden behind a carousel.

### Composition and interactions

Keep a light mint-to-blue greeting. Replace large administrative metric cards with a prominent change summary and a small task stack as the story services arrive. The neutral body becomes a compact preview here; the full navigator belongs in My Health. Each card opens its owned destination rather than duplicating its editor in the Dashboard.

Returning users can “Continue reviewing this report” or “Check in on this action.” A person with no active plan sees an invitation to explore goals, not an unearned progress chart. Caregiver copy uses the selected person's name.

### States, acceptance and measure

States include first visit, no change, historical backfill, new correction, pending verification, stale projection, unavailable analysis, no access and paused goal. A stale digest displays its timestamp and offers refresh; it cannot offer a recommendation based on an invalidated decision.

**Acceptance demonstration:** add an old report, correct a source, then add a newer comparable report. The digest distinguishes all three, links to exact evidence, and does not call old data a new deterioration.

**Measure:** whether a user can state the relevant change and choose a justified next step. Counts of cards clicked are diagnostic only.

## M02 — My Health: the complete health story

### Outcome and ownership

My Health is the longitudinal record, not a second analytical dashboard. It owns the navigable history and recorded context from which Insights and Wellness work. Its header says what time span and kinds of evidence are available and what the user has chosen to share.

Use an internal section navigation: **Story, Measurements, Conditions & history, Medicines & allergies, Care guidance, Context**. Keep the canonical body navigator in Story and permit anatomy filters. Mobile uses focused stack screens and summaries, not a dense desktop table squeezed into a phone.

### Story and timeline

Organize the main timeline by clinically relevant event time where known, preserving its precision. An event can be a verified test, reported measurement, documented encounter/guidance, reported medication change, accepted goal, check-in summary or correction. Color identifies event kind, never diagnostic severity without an approved policy.

Every event exposes: what happened, effective date or range, source, reporter/authority, revision and “Why is this here?” Expand to exact values and original page where available. Filters select event kind, date range and focus area; the default is a coherent chronology rather than every raw OCR action.

Uncertain dates stay visibly uncertain. Undated events have a separate lane. The user can switch to “Added to BiovitAI” order when looking for recently uploaded records. Superseded facts remain discoverable in history but do not masquerade as independent current measurements. A correction can change the earlier event while also appearing as a later record-change event.

The “Story summary” initially uses deterministic templates over current facts. Later AI may rewrite for readability with validated citations. It must retain gaps, conflicts and dates, and be regenerable after evidence changes. A person can flag a summary error without editing its underlying sources accidentally.

### Measurements

Provide a directory of lab results and, later, manual/device measurements. Lab, manual and device sources remain visually distinct. A home measurement records method/device context, unit, observation time and who entered it. Raw repeated readings remain separate; no automatic average is added through the manual-entry feature.

A measurement detail owns exact source records and links to the Insights analysis for comparable change. It does not invent a standard target. A documented personal target is a separate attributed care instruction, not a replacement for the source laboratory reference interval.

### Conditions and history

Let users record “A clinician told me…,” “This document says…” or “A concern I want to discuss.” The UI preserves assertion type, source, approximate onset/resolution dates and the person's confirmation. It never upgrades a user-confirmed transcription into a clinician-confirmed diagnosis.

Active, historical, uncertain, disputed and entered-in-error records are distinguishable. “Not provided,” “Unknown” and an explicit “None known” answer differ. Duplicate-looking statements can be linked for reconciliation; they cannot be merged solely by name or the model's confidence. Family medical history requires an explicit reported relationship and event, not access to a managed relative's private record.

### Medicines, allergies and supplements

Capture the name as written; ingredient/product mapping only when confirmed through an appropriate terminology workflow. Store strength, dose, route, schedule, effective dates and prescriber/source only when known. Separate a prescription document, a report of taking a medicine and a record of actual administration. Supplements and allergies need their own qualifiers and sources.

Display last confirmation date and offer “Is this still accurate?” A reported stop is a record of what the user says occurred, never advice to stop. The app cannot interpret a blank medication list as proof of no medications or “no interaction risk.” If interaction checking has not been evaluated, say **Not checked**, not “No conflicts.”

### Care guidance and visit preparation

Capture a clinician's instruction with verbatim source excerpt, author as documented, date, scope, any follow-up date and status. Extracted text stays a draft until confirmed. A generic article is not an instruction for this person.

Conflicting guidance appears side by side with dates and sources. Do not choose a winner merely because one is newer or generated by a different model. Ask the user to clarify with the treating clinician; only an explicit documented replacement can establish a supersedes relationship.

A **Prepare for my appointment** workspace assembles user-selected facts, unresolved questions and relevant instructions. It first exists as an in-app, source-linked view. Any later export/sharing is an explicit, permission-checked feature with preview, minimum necessary content and revocation/retention design; nothing is sent to a clinician automatically.

### Context and anatomy

Personal context includes relevant history, limitations, preferences and circumstances, each optional and purpose-explained. Keep behavioral preferences in Wellness and medical-context assertions in Health. An unanswered safety-relevant question can limit action eligibility without blocking the record library.

The body has two explicitly separated modes:

| Mode | Meaning | Display |
| --- | --- | --- |
| Health evidence | What source-linked evidence is mapped to a region? | Neutral anatomy; counts, dates, mapping basis, available/unknown evidence and separately labeled interpretation status. |
| Wellness progress | How much of a named accepted plan is reported complete? | Optional green fill with the named period, completed/planned opportunities and unreported/paused counts. Never an organ-health percentage. |

Evidence-to-anatomy mapping requires approved metadata or an explicitly user-created organizational link. No mapping means “Not mapped,” not “No evidence exists.” A marker can relate to more than one system without becoming multiple medical results.

### States, acceptance and measure

Handle a single report, many years of history, no context, uncertain dates, conflicting assertions, amended reports, missing mappings, partial access and source revocation. Search must distinguish no match from inaccessible records and never leak their titles or counts.

**Acceptance demonstration:** a caregiver adds three dated reports, one uncertain-date medication statement and two conflicting instructions. The timeline preserves all sources, never invents ordering for the uncertain date and supplies a clear appointment question without changing treatment.

**Measure:** time to reconstruct an accurate sequence and identify source/uncertainty. Include older-adult and caregiver comprehension tasks rather than relying only on usability clicks.

## M03 — Labs & Reports: the evidence workspace

### Outcome and hierarchy

The user can trust what entered the record and fix an error at its origin. This remains the home for scanning/OCR, identity, review and corrections. The primary layout is **review queue → library → selected source and verification workspace**, with upload always available. Counts support workflow decisions here rather than dominating every page.

Library groups should be task-oriented: Needs my review, Processing, Ready, Unavailable/failed, Withdrawn/history. Offer file/report-date search, facility/type filters where metadata exists and transparent duplicate/amendment relationships. Upload date and report date remain distinct columns.

### Upload and document routing

Retain the actual-content checks, immutable encrypted original, checksum, profile-bound idempotency, 20 MiB/50-page limits, scanner gate and honest failure states. Before submission name the selected subject. Cancellation of a job is separate from withdrawing a published source.

Lab reports stay on the current parser. A later intake classifier can propose lab report, prescription, clinician letter, discharge note or unknown. The user confirms the type. Supporting a file format is not equivalent to supporting the clinical content: an unsupported letter stays a stored source/manual-entry path, never a successfully extracted lab.

Bulk intake is a later usability extension over the same per-file lifecycle. Show individual progress, patient identity and duplicate decisions. Do not combine all PDFs into one patient or encounter automatically.

### Verification workspace

Show source page and extracted fields side by side on desktop; source/result tabs on mobile preserve the active field. Highlight the relevant page region and keep text alternatives for image-only sources.

Review value, comparator, unit, reference text and relevant date/specimen/method/concept independently. A person can confirm a result while leaving unknown comparison metadata unknown. Qualitative, missing and censored results remain first-class records, even when excluded from numeric trend charts.

The review queue distinguishes identity confirmation, extraction correction and contextual uncertainty. Missing patient identity requires explicit confirmation; a mismatch stays quarantined. A visual match to a name/email is never a patient-identity decision.

### Correction and propagation

Save a correction as a new revision with reason and actor. Preview affected timeline/analysis items when cheaply available, but never make a slow preview block a necessary correction. Expected revisions prevent concurrent overwrite. A conflict screen shows the refreshed value and the user's intended edit before reapplication.

After publication, report what was updated and which derived views are recomputing. Withdrawn or amended source material remains in authorized history; dependent insights and assistant claims cannot remain current. An amendment relationship does not automatically prove that every field in the old report is replaced.

### States, acceptance and measure

Keep scanner unavailable, malware denial, unsupported extraction, mixed identities, manual candidate entry, interrupted jobs, bounded retry, duplicates, expired access and concurrent edits distinguishable. No optimistic success while a scanner or verification step is unavailable.

**Acceptance demonstration:** upload a scanned lab report; resolve missing identity; correct one field; leave an unknown method empty; inspect its exact source; amend it later and observe downstream invalidation.

**Measure:** field fidelity, false-merge incidents, correction burden, review abandonment and successful recovery from processing failures. “Upload succeeded” is not the end-to-end success measure.

## M04 — Insights: evidence, connections and uncertainty

### Outcome and hierarchy

The user understands an actual change or supported relationship and can inspect the basis. Use four sections: **Changes, Focus areas, Comparisons, Questions & gaps**. Open the relevant section from a Dashboard item or visible result rather than forcing the user to rediscover the evidence.

### A reusable insight detail

Every insight uses the same reading order:

1. **What the records show:** exact values, dates, source types and a short factual statement.
2. **Why these records are considered together:** a named/versioned mapping or rule, and its applicability.
3. **What this does and does not establish:** incompatible results, timing limitations, missing context and alternative explanations.
4. **What to do with this information:** inspect sources, clarify a record, prepare a clinician question, or explore an eligible reviewed action.

Use phrases such as “measured higher in this comparable pair” before any interpretation of benefit/harm. A two-point difference is not a validated persistent trend. Three or more points can show an observed sequence; statistical significance or clinical significance needs its own evaluated method. Do not collapse a range/censored value to a midpoint or connect incompatible series across a gap.

### Focus areas

A focus area organizes a meaningful question, such as “Records relevant to metabolic wellbeing,” with evidence membership and limitations. It is neither a disease label nor a disease probability. Initial candidate areas are a **proposed clinical taxonomy**: cardiometabolic context, kidney-related context, liver-related context, thyroid-related context and nutrition-related evidence. Activation is limited to mappings actually reviewed; the names alone are not approval.

A focus detail combines:

- Supporting measurements, their independent comparable cohorts and dates.
- Relevant recorded conditions, medicines and care guidance with attribution.
- An explanation of each approved relationship rather than an unexplained network diagram.
- Known limitations and unknowns that actually affect a proposed interpretation/action.
- One or two user-selected questions or next steps, with a route to the original record.

User-created collections can work before medical mappings are reviewed, labeled “Your collection.” They cannot generate medically meaningful relationships or eligibility decisions on their own. Relationship count and evidence volume never become a severity score.

### Gaps, freshness and constraints

Say “No measurement recorded in this app” when appropriate. Only a documented instruction or approved applicable policy can call a test/follow-up overdue. Use exact age/date labels before a clinical “out of date” classification; freshness windows must be rule-specific.

Show action-relevant constraints separately from the insight itself. For example, a recorded restriction can make a particular candidate action unevaluable or blocked; it does not invalidate an otherwise comparable laboratory history. A partial record never permits a “safe for you” assertion.

### Interactions and presentation

Desktop pairs an evidence chart/table with explanation and sources. Mobile begins with the plain-language finding and an expandable exact-value table. Every chart has a meaningful text alternative. “Ask about this” passes typed IDs/revisions after explicit confirmation to the assistant; it does not send a screenshot or automatically dispatch AI.

Comparison selection keeps separate same-date/rerun results visible. The user can explore why a result was excluded. A constrained result can still appear as evidence in a focus area while remaining excluded from numeric comparison; those are different decisions.

### States, acceptance and measure

States include insufficient evidence, incompatible metadata, disabled mapping, missing personal context, disputed context, retired rule, outdated derivation and provider unavailable. Existing deterministic comparisons remain usable when AI is offline.

**Acceptance demonstration:** assemble synthetic glucose-related, lipid and home-measurement records with one incompatible laboratory method and unknown medication status. Only reviewed relationships appear; the incompatible result is inspectable but excluded from its trend; no personalized action claims safety from missing context.

**Measure:** whether a user can explain the finding, uncertainty and source. Evaluate false connections and omitted material limitations separately from extraction accuracy.

## M05 — My Wellness: choose, act, reflect, adapt

### Outcome and hierarchy

Wellness turns a chosen priority into feasible behavior and supports recovery after disruption. It owns the goal and plan lifecycle, not diagnosis or treatment. Its home is **My current focus → today's chosen opportunities → quick check-in → weekly reflection → goal/action history**. The goal count is small by default and user-adjustable, not an automatically generated list of ten recommendations.

### Baseline and choice

Ask what matters to the person, what they already do, available time, preferred cues, ability/accessibility needs and barriers. Separate “I don't know” from “No restriction.” Explain why sensitive clinical context is requested and allow skipping. A skipped input may leave a particular action unavailable; it should not prevent manual goal notes or viewing existing records.

Offer user-led goal creation separately from system-suggested actions. User-authored plans are labeled as user-authored and are not presented as clinically reviewed or endorsed. The system still must not turn unsupported instructions into recommended activity, dietary restriction or medication advice.

### Action-to-health impact detail

Each catalogue action has a detail page that answers:

| Question | Required content |
| --- | --- |
| What am I choosing? | Plain-language reviewed action and minimum/normal/fallback variants. |
| Why might I consider it? | User goal and supported potential targets; general evidence separated from this person's results. |
| What else might it affect? | Reviewed possible benefits/monitoring considerations, with no promised individual outcome. |
| What could make it unsuitable? | Known exclusions, unresolved context, relevant documented restrictions and the limits of checks performed. |
| How much does it ask of me? | Chosen frequency, cue, practical burden, optional accessibility alternative. |
| How will we revisit it? | Behavior measure, reflection date, any documented follow-up and relevant later measurements. |
| Who decided? | Action/content version, eligibility result, user acceptance and actor. |

The impact map can be a simple target-and-constraint list; a graph visualization is optional. One accepted action may support several goals, but its daily burden is counted once. Potential benefit is not an estimate of how many points a biomarker will change.

### Eligibility and acceptance

Run deterministic checks before presenting a personalized candidate: approved active content, relevant context, explicit known exclusions, compatible documented instructions, language/accessibility and burden. Results are **Eligible within the evaluated scope, Blocked, Needs clarification, Not evaluated**. State which checks were performed. “Eligible” is not a guarantee of safety in circumstances the app does not know.

Unknown medications/constraints cannot produce an all-clear. Potentially conflicting care guidance creates a clarification task instead of a model-selected compromise. Until reviewed catalogue/rules are available, keep personalized suggestions unavailable and build the workflow using synthetic content. User consent is not a substitute for rule validity.

The user previews and accepts an action, selects a variant/cue, and chooses reminder settings only where a reminder service exists. A suggestion is not a scheduled task until accepted. The assistant cannot silently accept, prescribe, increase intensity or alter a medicine.

### Daily and weekly loops

An opportunity has low-burden outcomes: Done, Partly, Chose fallback, Skip, Pause, Not recorded. Allow optional difficulty, energy and “What got in the way?” context; avoid implying that check-in itself was a health intervention. Device evidence can supplement later, with consent and provenance; no phone activity is not evidence of no real activity.

Keep the existing proposed behavioral stages—Explore, Start, Stabilize, Maintain, At-risk, Lapse, Recover, Sustain—as internal support states based on explicit signals. User copy should say “Want a smaller step?” rather than label someone “at risk” because they missed an app session. Never infer lapse from silence alone.

Weekly reflection reviews burden, user-reported feasibility, what they want to change and new relevant evidence. Offer smaller size, different cue, fallback, pause or continuation. Apply material changes only after user confirmation. Safety-driven suspension applies to **app suggestions/coaching**, not a patient's prescribed care. Show the reason and a route to discuss uncertainty.

### Progress and outcomes

Define progress as named behavior in a stated interval. Example: “3 of 4 planned opportunities reported complete; 1 unreported.” The optional body fill is 75% completion for that named plan/week, never 75% health. A completed minimum/fallback variant can count as an accepted completion; display which variant. Partly is separate rather than an invented fractional completion unless the goal explicitly defines measurable units.

Paused/excused opportunities are displayed separately. Schedule revisions apply prospectively; historical denominators are not silently rewritten to improve the percentage. Unknown check-ins remain unknown rather than failed. Explain the denominator and retain previous achievements after pauses/lapses.

Display later laboratory changes alongside behavior and other recorded events, with observation windows and missingness. Use “measured after you began this plan,” not “improved because of this plan.” A goal can be successful by feasibility/consistency even when there is no new medical test.

### States, acceptance and measure

Handle no catalogue, no eligible action, declined context, unclear restrictions, accepted plan, illness/disruption, missing check-ins, changed knowledge, withdrawn consent and lost caregiver access. Preserve history when an action is retired, but suspend new recommendation use and re-evaluate active coaching.

**Acceptance demonstration:** choose a reviewed synthetic action with three variants, use its fallback, miss check-ins without being labeled a failure, pause, recover with preserved history, and show subsequent evidence without a causal claim. A newly recorded restriction invalidates its current eligibility decision and requests clarification without changing a prescription.

**Measure:** user-chosen opportunity completion with explicit missingness, burden, voluntary pause/recovery, understanding of action rationale and sustained behavior at agreed intervals. Do not optimize streak length or notification volume.

## M06 — Assistant: explain the same journey in conversation

### Outcome and entry points

Keep the delivered bottom-right compact window, current-session resume, New chat and full-screen history. Add contextual entry points: Explain this result, Explain this comparison, Summarize this period, Help prepare questions, Explain why this action is unavailable. Context attachment is visible and can be removed before an explicit send.

The assistant reads the same authorized facts, timeline, focus/rule decisions and plan state as the pages. It must not reconstruct a competing patient graph from raw chat history or arbitrary retrieved text.

### Answer structure

For a substantive health question, present:

1. A direct, accessible explanation of the authorized facts.
2. What supports it, with observation/context/knowledge citations and dates.
3. What remains uncertain and what was not evaluated.
4. Useful next options: inspect evidence, clarify a fact, prepare a question, review an existing action.

General education uses reviewed knowledge citations; claims about the person use their actual records. A clinical relationship requires both applicable knowledge and personal evidence. The current observation-only answer schema cannot truthfully represent all of these; introduce a versioned extension, not fabricated observation citations for general claims.

### Memory, tools and writes

Saved conversations are a record of interaction. Statements become durable health context only through a proposed structured entry that the user reviews and confirms. The user can distinguish “mentioned in chat” from “saved to my record.” Summaries of old chats cannot override new source revisions or fresh consent checks.

Initially keep the expanded assistant read-only. Later allow a typed draft such as “Create a question for my next visit” or “Propose a goal.” Show selected subject, exact fields, source links and consequences before confirmation. The normal application service performs the write with current authorization, idempotency and expected revisions. No arbitrary SQL, network, code execution, self-issued grants or implicit treatment edits.

For a question involving a family member, require explicit profile selection and current permission. Do not compare relatives' records in one context or turn managed-profile access into a family risk inference.

### Availability and safety

Use the existing provider-neutral Gateway and US$5/day budget. Prefer deterministic summaries and on-demand explanation; do not generate every profile's story on a schedule using the paid model. Provider failure/budget exhaustion leaves the record, source comparisons, timeline and accepted tracking usable.

Symptom/emergency and clinical-advice handling requires a separately reviewed response policy and evaluation. The assistant must not market itself as emergency monitoring or guarantee detection. Avoid open-ended disease/medication interaction assertions unsupported by the knowledge service.

### States, acceptance and measure

Handle absent consent, no evidence, incomplete evidence, stale context, source correction, provider unavailable, budget exhausted, tool timeout, unsupported question and invalid citations. Profile switches clear content immediately; stale responses cannot publish after switching away and back.

**Acceptance demonstration:** ask about a focus area from Insights, follow citations, correct its supporting source while generation is delayed, and confirm that the stale answer is withheld. Start a fresh session and see a new chat while authorized historical conversations remain accessible.

**Measure:** citation validity, claim support, material uncertainty coverage and useful task completion. Treat fluent unsupported answers as failures, not engagement.

## M07 — Community & Trends: education before participation

### Outcome and hierarchy

Help people learn without making public content a hidden medical authority. Start with **Reviewed guides, Topic search, Saved reading, Medical news with context**. Add peer participation only as a separate staffed product milestone.

A content detail shows classification, author/editor, original sources, publication and review dates, applicability limits and commercial interests. Distinguish established guidance, preliminary research and personal experience. Popularity must not determine clinical credibility.

### Personal relevance and privacy

Initially let people choose topics manually. Do not send a selected family member's diagnoses, reports or medication list into a public recommendation/feed system. A private, explicit “Save this as a question for my appointment” action can copy a title/source into a personal question record after preview; it does not turn the article into care guidance.

Public identity is independent from managed health profiles. A caregiver cannot publish “as” the selected family member. Later story-sharing needs explicit disclosure preview, consent/authority checks and removal rules. Community opinions never update Health facts, clinical rules or the wellness catalogue.

### Stages and states

Stage 1 is manually curated and read-only, requiring actual content review operations. Stage 2 may add verified professional contributions with credential lifecycle and editorial review. Stage 3 may add moderated discussion, reporting/blocking, appeals, disclosure controls and human escalation. Automated moderation only supports the process; it is not a substitute for staffing.

Before those operations exist, preserve the current unavailable/read-only/paused presentation. Stale or withdrawn articles display their status rather than remaining silently authoritative in saved items.

**Acceptance demonstration:** read a reviewed educational item, inspect its source/review date, save a private question explicitly and prove that no health data is sent through Community endpoints. Inject instructions into an article/post fixture and verify that no private tool or health write runs.

**Measure:** comprehension, source trust, correction response and moderation quality where enabled. Avoid feed time as the primary outcome.

## M08 — Supporting platform, privacy and operations

Keep settings/help organized around concrete controls: account, managed profiles/access, AI consent, wellness participation, reminders, language/accessibility, data lifecycle and service status. Do not mix account settings with the selected subject's clinical context.

Notification delivery remains a later explicit feature. Model the source task independently from delivery, with user opt-in, quiet hours, timezone, deduplication and generic lock-screen text. A scheduled reminder is not clinical monitoring. Cancellation, profile access loss and source withdrawal must cancel relevant unsent deliveries.

For sensitive writes and future export/delete, show the selected subject and permission requirements. Design retention, deletion, backup expiry and audit together; append-only history does not authorize keeping identifiable medical data forever. Consent withdrawal stops its specified processing without automatically asserting that all medical records must be deleted; deletion is a separately scoped workflow.

Operations must expose queue age/failures, projection lag, invalidations, rule/content activation status, provider usage and access denials without logging medical payloads. Support staff access needs a separately authorized role and audit trail, not a universal profile picker.

**Acceptance demonstration:** revoke caregiver access while a source, action draft and chat are open, then verify clearing and denial across all three. Expire a knowledge version and inspect the visible stale/review state without using it in new recommendations.

## One complete scenario across the modules

Use a fictional adult profile with four lab reports over 18 months, a reported medication list, two pieces of documented guidance and mobility preferences. No actual family records are used in engineering fixtures.

1. **Reports:** upload, scan, confirm subject, verify results and preserve one unknown method.
2. **My Health:** build a date-qualified timeline and label the medication list as reported; retain both guidance sources.
3. **Insights:** display comparable pairs and the excluded result. Show a connected focus only if its mapping and rule are approved in the synthetic test configuration.
4. **Dashboard:** explain what is newly known, what needs clarification and one user-selected next task.
5. **Assistant:** answer a question with personal-evidence and knowledge citations; acknowledge the incomplete context.
6. **Wellness:** evaluate a reviewed synthetic action, reveal targets/constraints, obtain acceptance and track its actual opportunities.
7. **Return visit:** add new evidence, show its place on the timeline, re-evaluate eligibility and discuss observed changes without attributing causation.
8. **Correction/access drill:** amend a supporting record or revoke caregiver access. Every dependent surface clears or visibly refreshes, including the assistant and any recommendation state.

The scenario is complete only when each step uses the same subject, source versions and decisions. Separately polished pages do not satisfy this journey.
