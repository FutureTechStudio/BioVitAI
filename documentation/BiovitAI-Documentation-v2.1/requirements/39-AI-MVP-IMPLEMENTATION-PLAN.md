# AI MVP — Engineering Implementation Plan

## Sprint 0: Contracts and fixtures
- Finalize selected-profile security model.
- Create synthetic reports and golden comparison fixtures.
- Define normalized marker catalog and tool JSON schemas.
- Set up shared TypeScript contracts and CI tests.

## Sprint 1: Health data APIs
- Implement find_reports and get_report_analysis.
- Ensure observation-date sorting and verification filters.
- Add source IDs/page provenance and permission checks.
- Build analytics-backed compare_reports.

## Sprint 2: Context and trends
- Implement get_health_context and get_biomarker_trends.
- Add manifest invalidation on report verification and grant change.
- Build deterministic comparable-marker matching and exclusions.
- Add cache keyed by data/rule versions.

## Sprint 3: Orchestrator
- Implement authenticated chat session endpoint.
- Integrate model tool calling with strict schemas.
- Add allowlist, max steps, timeouts, error envelopes and tool audit.
- Implement source grounding and response schema validation.

## Sprint 4: Web/mobile chat
- Create text summary, report card, comparison and chart blocks.
- Add report source deep links and follow-up state.
- Add empty/error/loading states and accessibility.
- Ensure explicit profile identity.

## Sprint 5: Safety and quality
- Run golden suite, prompt injection tests and authorization tests.
- Clinician review of representative responses.
- Add privacy-safe telemetry and operational alerts.
- Test revocation, report corrections and stale cache handling.

## Sprint 6: Pilot
- Use synthetic data first.
- Limited consented pilot after security and clinical review.
- Measure answer correctness, usability and cost.
- Prioritize fixes before family expansion.

## Definition of MVP
Five read-only tools, at least twenty validated questions, complete report comparison, source-backed answers, responsive web/mobile cards, no known critical permission leaks, and documented clinical limitations.

## Explicitly defer
Unrestricted agent actions, autonomous clinical decisions, medication management, emergency monitoring and arbitrary database access.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** This is the historical AI MVP build subset. Use the consolidated P0–P8 program in 51; do not count specification authoring as work implementation. Preserve independent clinical, security, accessibility and pilot signoffs.

**Related v2.1 requirements:**
- [51-PHASED-ROADMAP-AND-GATES](51-PHASED-ROADMAP-AND-GATES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
