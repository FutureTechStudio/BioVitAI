# 44 — Product architecture and navigation | BiovitAI v2.1
Status: Proposed for review · Owner: Product + Tech Lead · Depends on: 00–43 (v2)

## North star
BiovitAI is a **wellness-first personal health intelligence platform**: understand verified evidence, choose feasible actions, adapt to life circumstances, recover from lapses, and sustain behavior. It is not a doctor, diagnosis engine, or generalized organ-health score.

## Top-level navigation
| Tab | Purpose | Core experiences | Data ownership |
|---|---|---|---|
| **Tab 1 — My Health (existing v2)** | Understand health evidence | Reports, verification, longitudinal biomarkers, clinically comparable trends, whole-body evidence, condition/vitals tracking, family profile management | Health module |
| **Tab 2 — My Wellness** | Translate context into sustainable behaviors | Goals, readiness/barriers, reviewed micro-actions, daily/weekly check-ins, adaptive plan, lapse recovery, wellness AI coach, activity/sleep/nutrition | Wellness module |
| **Tab 3 — Community & Trends** | Learn and connect safely | Evidence-labeled health posts/blogs, recent trends, optional discussion, creator verification, moderation | Community module |

Global surfaces: active profile picker, notifications, settings/privacy, unified AI assistant, accessible search. The active profile must always be visible on sensitive views.

## Boundaries and cross-tab rules
1. Health evidence can inform Wellness through authorized typed services; do not copy raw records into wellness tables. Every explanation links back to evidence and its age/date.
2. Community content is **untrusted**. Never feed user-generated health advice directly into clinical calculations, recommendation eligibility, or clinical RAG. Source-backed educational content remains separate from user's measurements.
3. No health-to-community sharing by default. Explicit, granular share flow required even for anonymized user stories; warn about re-identification risks.
4. AI chat can navigate tabs via typed `navigate_to_screen`, but tool permissions always use server-side identity + profile scopes, not chat text.
5. Wellness suggestions distinguish user-entered goals, observed behavior and laboratory evidence. Temporal correlation does not establish causation.

## Core journeys
A. Upload report → verify extracted evidence → compare trends → optionally choose a relevant, reviewed wellness action → check in → adapt.
B. Start without a report → readiness and barriers → select action → track manual/wearable progress → recover after interruption.
C. Read Community article → inspect author/source label → save to private reading list → optionally start a wellness goal through approved action catalogue (never direct medical advice).
D. Switch family profile → recalculate allowed content and clear cache/chat context; community identity remains separate.

## Acceptance criteria
- Three tabs exist with independent loading, error, and accessibility states; direct links are deep-linkable.
- Health and Wellness work even if Community service is disabled.
- Data for profile A cannot be returned under profile B in any tab, chat tool, async job or cache.
- Unverified Community content never appears as clinical evidence.
- All core navigation and empty states work in both English and Arabic for the Abu Dhabi target; RTL checks are release gates.

## Existing v2 documents to reconcile
`00-README.md`, `01-PRODUCT-VISION-AND-SCOPE.md`, `02-PERSONAS-AND-USER-JOURNEYS.md`, `18-PRIVACY-SECURITY-AND-CONSENT.md`, `21-WEB-AND-MOBILE-UI-SPEC.md`, `25-SCREEN-INVENTORY-AND-UX-FLOWS.md`.
