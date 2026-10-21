# Quality Assurance and Acceptance

## Test layers
Unit: normalization, date parsing, permissions, clinical rules.
Integration: upload to verified analysis; event invalidation; AI tool execution.
End-to-end: web/mobile journeys, report comparisons, family invitations.
Security: IDOR/cross-profile leakage, prompt injection, access revocation, file handling.
Clinical: clinician-reviewed golden fixtures, false reassurance, overstatement and urgent-symptom behavior.
Accessibility: screen reader, keyboard, zoom and touch.

## Release criteria
- No known critical cross-profile access vulnerability.
- Extraction quality measured on representative reports.
- Every AI numeric claim traceable to verified source values.
- No unsupported diagnostic conclusions in golden test set.
- Permission revocation enforced in tool calls and retrieval.
- Clear no-data and low-confidence behavior.
- Recovery and monitoring runbooks tested.

## Detailed AI evaluation
See 37-AI-EVALUATION-AND-TEST-FIXTURES.md and 42-AI-EDGE-CASES-AND-ACCEPTANCE.md.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Add phase-level gates for clinical source fidelity, cross-profile isolation, AI tool injection prevention, deterministic rule reproducibility, harm/error handling, inclusive usability and longitudinal Wellness outcomes. QA completion is necessary but not sufficient for public release.

**Related v2.1 requirements:**
- [53-TESTING-EVALUATION-AND-OUTCOMES](53-TESTING-EVALUATION-AND-OUTCOMES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
