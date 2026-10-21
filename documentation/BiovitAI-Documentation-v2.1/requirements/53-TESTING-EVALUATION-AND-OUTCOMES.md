# 53 — QA, AI evaluation, clinical goldens and wellness outcomes
Status: Test strategy proposal · Owner: QA + Clinical + Product

## Golden fixtures
- **Health:** multi-page table extraction, same analyte with different specimen/time/method, preliminary vs corrected, censored `<5`, duplicate print, wrong profile identity, unsupported range and units.
- **AI:** missing records, stale reports, cross-profile requests, prompt injection in uploaded report/post, fake citations, prompt budget overflow, mixed dates, model offline, tool timeout.
- **Wellness:** low readiness, shift work, heat, mobility constraint, illness, lost device, skipped check-in, lapse after travel, withdrawal, language switch, no clinical measurements.
- **Community:** unverifiable claims, misleading headlines, personal data, advertising, harassment, unsafe advice, false credential, multilingual moderation.

## Quantitative quality gates
Before pilot, define pass/fail with clinical reviewer: source-fidelity and identity isolation must be exact on controlled fixtures; no known clinically meaningful false merge in goldens; every derived value has full lineage; every agent tool call authorized; all untrusted content sanitized; results explain uncertainty. Record extraction field exact-match (with raw comparator/unit), coverage, false merge rate and unresolved-review rate instead of one misleading 'AI accuracy' score.

## Wellness impact measurement
Track opt-in enrollment, chosen baseline, action opportunity, action completion, median user burden, recovery time after disruptions, retention of **behavior** over 3/6/12 months, proportion of goal episodes requiring downsizing, notification opt-out and negative experience reports. Distinguish absent telemetry from true negative behavior; define data completeness denominators.

## Fairness/equity evaluation
Pre-register subgroup analysis by consented language, accessibility need, shift-work status and relevant contextual factors only where lawful; do not infer sensitive demographic classes. Monitor whether the same performance/comfort is available to under-connected users and those without wearables. Evaluate Arabic localization/RTL and non-technical literacy.

## Experiments
Start with observational pilot and usability/safety evaluation. Later randomized interventions may evaluate prompt timing or fallback selection with informed consent, guardrails and ethical review where required; no experimentation on unreviewed clinical advice. Avoid optimizing DAU, prompt counts or total notifications as primary objectives.

## Example acceptance cases
`CASE-HEALTH-001`: correction to source observation invalidates all derived aggregates; no silently outdated trend. `CASE-SEC-001`: profile A tool token cannot access profile B data. `CASE-WELL-001`: 7 missed app days alone does not label a lapse. `CASE-WELL-002`: restart keeps achieved history. `CASE-COMM-001`: harmful post stays unpublished pending review.
