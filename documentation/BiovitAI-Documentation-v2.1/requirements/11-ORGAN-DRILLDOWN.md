# Organ Drill-Down

## Initial views
Heart/cardiovascular, kidneys, liver, pancreas/metabolic, thyroid, brain/neurologic evidence and lungs/respiratory evidence where data exists.

## Each organ page
Title; evidence status; data coverage; relevant verified markers; source-linked trends; tracked conditions; explanatory limitations; related report links; "Ask BiovitAI" shortcut.

## Important distinctions
A kidney page may show creatinine and eGFR trends, but it cannot conclude overall kidney health without adequate context. A brain or lung page should remain "Not assessed" when no appropriate evidence exists.

## Model
organ_evidence(profile_id, organ_code, status, coverage, observation_ids, rule_version, generated_at, limitations).

## Acceptance
Every organ conclusion links to observations or an explicit absence-of-evidence statement. Users can inspect exactly which measurements caused a status.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Organ drill-down is an evidence navigator, not a deterministic wellness prescription engine. Link measured observations, clinical context, data limitations and source reports; Wellness recommendations require approved eligibility rules.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
