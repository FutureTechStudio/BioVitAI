# ADR-002: Central AI Gateway and bounded agents

Status: P0 contract design implemented for local engineering; AI Lead and Security review deferred by the owner. Updated: 2026-10-21.
Task: BV-006; local prerequisite acceptance is recorded in docs/p0/DEVELOPMENT-ACCEPTANCE.md. Formal signoff remains separate.
Requirements: 28–38, 48, 49, 52, 53, 57, 59.

All model calls go through AIGateway. Domain tools fetch trusted facts through application services with live server-side authorization. The Gateway validates workflow/provider eligibility, residency, minimal context, prompt/policy versions, budgets, deadlines and structured output. Agents never query persistence. Deterministic Health and Wellness services own calculations and action eligibility. Community moderation receives untrusted post context without private profile evidence.

Draft executable interfaces and runtime schemas are in shared/contracts/src/index.ts. ProviderAdapter accepts a gateway-built minimized prompt, never the entire authenticated request. It returns unknown output for validation by the Gateway. No adapter, provider SDK, prompt pipeline or real AI workflow is implemented in P0. No provider is selected (DEC-005 stays Open).

ReportAssistant and TrendAssistant may request authorized Health reads; WellnessCoach may read approved goals/actions/plans and propose a preview; ContentModerator only triages Community content. Writes require separate user confirmation and live service authorization. Specify exact allowlists and evaluations before BV-025, with all MVP Health tools read-only. Tool descriptors include schema IDs, owner, permissions, sensitivity, caching, row/time limits, confirmation, error schema, telemetry version and fixture reference.

Before approval: agree model residency/retention policy, server principal source, consent version/revocation handling, actual input/output schemas, citation/action-ID grounding, safe fallback and budget units. Before P4 release: prove these through authorization, injection, timeout, grounding, redaction and provider regression tests. Current schema tests establish shape constraints only.
