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
