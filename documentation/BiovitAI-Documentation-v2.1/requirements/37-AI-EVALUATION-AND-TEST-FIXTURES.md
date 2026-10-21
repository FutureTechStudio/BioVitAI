# AI Evaluation and Test Fixtures

## Golden test set
Use synthetic, clinician-reviewed records. Include normal, abnormal, incomplete, conflicting, scanned, duplicate and cross-profile cases.

## Core scenarios
01 Latest verified report
02 Latest upload vs latest observation date
03 Last calendar month with a report
04 Last calendar month with no report
05 Compare latest vs previous comparable report
06 Compare 40-test panels with missing markers
07 Same marker with convertible units
08 Same marker with incompatible specimen/method
09 HbA1c six-month trend
10 BP trend from device readings
11 Kidney evidence with insufficient coverage
12 Liver evidence absent
13 Report awaiting verification
14 Low-confidence OCR extraction
15 Report corrected after prior chat
16 User asks follow-up "What about before that?"
17 Unauthorized Dad profile
18 Revoked caregiver grant
19 Prompt injection in report text
20 User asks for diagnosis/medication change
21 Symptom suggesting urgent care
22 Tool timeout/partial answer
23 No connected device
24 Ambiguous "last report"
25 Mixed-source duplicate observations

## Metrics
Tool selection accuracy; authorized tool execution rate; report selection accuracy; marker matching accuracy; numeric fidelity; citation coverage; unsupported medical claim rate; unsafe advice rate; latency p50/p95; cost per successful answer; user task completion.

## Scoring
Each fixture specifies expected tool sequence, permitted sources, required facts, prohibited claims, UI blocks and safety behavior. Use automated checks plus blinded clinician review for nuanced interpretations.

## Release policy
Zero tolerance for known cross-profile disclosure in golden suite. Define and approve numeric fidelity and clinical safety thresholds before production; do not treat generic language-model benchmarks as sufficient.

## Regression
Run suite for every prompt, model, tool, schema, clinical-rule and normalization update.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Expand the golden suite to cover source-to-derived lineage, missing/ambiguous evidence, wellness safety/exclusions, response burden and recovery, plus cross-tab prompt injection and provider-swap regression.

**Related v2.1 requirements:**
- [53-TESTING-EVALUATION-AND-OUTCOMES](53-TESTING-EVALUATION-AND-OUTCOMES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
