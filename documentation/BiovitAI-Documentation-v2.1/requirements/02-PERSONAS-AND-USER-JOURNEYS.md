# Personas and User Journeys

## Personas
1. Independent adult: uploads reports and monitors trends.
2. Older adult: needs large type, simple language, minimal steps, and voice-friendly interaction.
3. Family caregiver: views only consented profiles, compares historical reports, helps with routine tracking.
4. Clinician or reviewer: receives an accurate, source-backed export; not assumed to be an in-app treating clinician.
5. Support/admin: handles technical problems without broad access to clinical content.

## Critical journeys
- New user signs up, verifies email, creates profile and uploads first report.
- User corrects an extraction error before measurements enter verified analytics.
- User asks "How was my last month's report?" and sees the matching report, explanation and sources.
- User asks "Compare my latest report with the previous one" and sees all comparable markers and missing ones.
- User selects an organ on the body map and sees only available evidence.
- Parent receives an invitation, verifies identity, consents to scoped sharing, and can revoke it.
- User connects a supported device and reviews freshness and sync status.
- User sees an accessible lifestyle check-in and chooses to track or skip it.

## Journey acceptance
Every journey has a clear loading state, no-data state, error state, permission-denied state, and source verification state. No silent cross-profile switching.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Extend persona coverage to Abu Dhabi/UAE shift workers, Arabic/English users, adults with varied digital literacy and mobility needs, family caregivers, and users returning after an interrupted routine. Opt-in fasting/seasonal modes are never inferred from identity.

**Related v2.1 requirements:**
- [45-WELLNESS-BEHAVIOR-CHANGE-ENGINE](45-WELLNESS-BEHAVIOR-CHANGE-ENGINE.md)
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
