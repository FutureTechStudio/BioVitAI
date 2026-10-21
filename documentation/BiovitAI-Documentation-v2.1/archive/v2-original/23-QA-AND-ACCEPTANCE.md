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
