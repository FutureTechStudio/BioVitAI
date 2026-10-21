# My Profile and Whole-Body Map

## Layout
Profile header → current evidence snapshot → stylized full-body human figure → organ list → recent reports → biomarker trends → tracked conditions → chat entry.

## Status vocabulary
Within supplied reference interval; review suggested; not assessed; awaiting verification; stale data. Avoid "organ health percentage" or green = guaranteed healthy.

## Body map behavior
- Click/tap keyboard-accessible organ regions.
- Display evidence coverage and last verified measurement date.
- Use consistent colors with text labels and patterns.
- When no data exists, show "Not assessed" and what measurements could be relevant.
- Update only after verified data and analytics refresh.
- Show provenance and rule version behind each displayed assessment.

## Profile switching
Visible selected profile identity at all times. Switching clears cached personal views and chat context. Permissions apply before any content is loaded.

## Acceptance
A report with no liver tests does not turn the liver green. A newly verified report triggers a fresh evidence snapshot without overwriting prior history.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Present distinct Health Evidence and Wellness Factors layers on the body/profile experience. Absence of evidence must display as not assessed rather than healthy, and the user must be able to inspect the source for every evidence item.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
