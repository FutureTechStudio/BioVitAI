# AI Observability, Latency and Cost

## Objectives
Fast common questions, predictable spend, safe degradation and measurable grounding.

## Efficiency
- Context manifest instead of all historical PDFs.
- Precompute analysis after verification.
- SQL for numeric history; semantic search only for narrative text.
- Cache report analyses by report revision and rule version.
- Cache context manifests by actor/profile/grant/data version.
- Parallelize independent read tools.
- Limit tool rounds, tokens and retrieved rows.
- Summarize older chat turns.
- Route simple navigation/data discovery to lightweight orchestration where safe.

## Example budgets (initial engineering targets, not guarantees)
Manifest retrieval: aim for low hundreds of milliseconds.
Precomputed comparison retrieval: aim for sub-second service time under normal load.
Total conversational response: measure p50 and p95; set service-level objectives after pilot load testing.
Tool rounds: default maximum 4, configurable per intent.

## Privacy-safe telemetry
request_id, tool name, status, latency, token counts, model version, rule version, cache hit, citation count, profile-scoped opaque IDs and error code. Do not log raw PDFs, full prompts, names, emails or medical values by default.

## Operational dashboards
Daily requests, successful grounded answers, p95 latency, tool failures, extraction backlog, cache invalidation failures, costs by intent, unsafe-response review queue.

## Fallback
If LLM unavailable, offer deterministic report list, charts and comparisons. If analytics unavailable, never substitute invented calculations.

## Cost model
Monthly AI spend = input tokens + output tokens + tool execution + OCR/extraction + embeddings if used + storage/compute. Track separately by workflow and optimize based on measured data.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Centralize latency, cost, cache and tracing in the AI Gateway with no full PHI prompts/responses in generic logs. Set cost budgets per task, operation and provider, and define fallback when providers fail.

**Related v2.1 requirements:**
- [59-OPERATIONS-COST-AND-SECURITY-RUNBOOK](59-OPERATIONS-COST-AND-SECURITY-RUNBOOK.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
