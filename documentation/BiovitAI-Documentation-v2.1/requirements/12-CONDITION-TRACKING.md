# Condition Tracking

## MVP condition pages
Glucose/diabetes tracking and blood pressure tracking, with architecture for future conditions.

## Contents
Verified measurements, timeline, device readings, manual entries, user-reported diagnosis where provided, habits, questions for clinician, and report links.

## Data distinctions
Separate user-reported diagnosis, clinician-documented diagnosis, risk indicators and AI explanations. Never silently promote a high value into a diagnosis.

## AI integration
"Show my BP trend" invokes condition overview or biomarker trend tools. "Am I cured?" receives a cautious evidence-based explanation with no definitive unsupported claim.

## Acceptance
Condition pages remain useful without an existing diagnosis and explicitly display data gaps and freshness.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Condition and vitals tracking may inform Wellness only with explicit consent and clinically approved eligibility logic. Self-report and device measurements carry source, timestamp and quality/provenance metadata.

**Related v2.1 requirements:**
- [45-WELLNESS-BEHAVIOR-CHANGE-ENGINE](45-WELLNESS-BEHAVIOR-CHANGE-ENGINE.md)
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
