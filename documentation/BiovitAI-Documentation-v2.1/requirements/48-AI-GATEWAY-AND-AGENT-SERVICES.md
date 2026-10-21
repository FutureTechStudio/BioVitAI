# 48 — AI Gateway, agent orchestration and service layers
Status: Normative architecture proposal · Owner: AI Lead + Platform

## Non-negotiable call path
**Frontend → API controller → application service → AI orchestrator → typed domain tools → AI Gateway → model provider**, with the orchestrator calling the gateway *only* to reason/explain and calling domain tools for trusted data/actions. The two branches are not a forced serial pipeline: deterministic domain services run independently of the LLM. Neither frontend nor agents use provider credentials or call model endpoints directly.

## Responsibilities
| Component | May do | Must not do |
|---|---|---|
| API/BFF | auth, validated request, active-profile selection, throttling | AI provider calls, calculations |
| AI Orchestrator | classify intent, choose typed tools, build answer plan, correlate tool outputs | direct SQL, bypass tool authorization |
| Domain Tool Adapter | authorize profile, validate parameters, invoke domain service and return minimized result | execute arbitrary model-generated SQL/code |
| AI Gateway | provider routing, prompts, context preprocessing, redaction, budgets, cache, output schema validation, tracing | decide profile permission, own clinical truth |
| Clinical Analytics | versioned comparability, rules, warnings, provenance | diagnose through generic model inference |
| Response Composer | validate structured UI blocks and cite source | render untrusted HTML/JS from model |

## Gateway pipeline
1. Receive a typed `AIRequest` with task, safety class, profile-scoped minimal context, locale, provenance refs and trace ID.
2. Validate caller/workflow, provider permission, minimization policy, prompt template/version and model eligibility.
3. Apply preprocessing: remove redundant PII, canonicalize measurements safely, token budgeting, untrusted-content delimitation, optional de-identification where compatible with task.
4. Route to policy-approved provider/model with per-task latency and cost budget; respect regional residency requirements.
5. Retry only safe/idempotent operations with bounded exponential backoff and circuit breakers; deterministic fallback states if provider unavailable.
6. Validate JSON schema, citations, unsupported claims, content safety and allowed UI blocks. Fail closed or route to user-friendly partial answer when invalid.
7. Emit scrubbed metrics: latency, token cost, policy version, tool names, outcome; do **not** log full medical prompts/responses by default.

## AI agent contracts
Agents are orchestrated workflows (not autonomous database superusers): `ReportAssistant`, `TrendAssistant`, `WellnessCoach`, `ContentModerator` each has a specific tool allowlist, budget, timeout, and human review boundary. A tool response includes `profile_id`, `source_ref`, `confidence/verification`, `observed_at` and `permission_scope` as applicable; reject mixed profiles.

### Example interface
```ts
interface AIRequest {
  task: 'explain_health_comparison' | 'coach_wellness' | 'triage_community';
  profileId: string;  // server-resolved, never trusted solely from text
  locale: string;
  context: Record<string, unknown>; // minimal, policy-filtered
  promptTemplateId: string;
  safetyClass: 'health_explanation' | 'wellness' | 'moderation';
  traceId: string;
}
interface AIGateway { generateStructured<T>(request: AIRequest, schema: Schema<T>): Promise<T>; }
```

## Prompt/data trust boundaries
- All uploaded reports, search hits and posts are untrusted *content*, not control instructions.
- Never let retrieved Community posts supply tool names, permissions, API routes or system instructions.
- Tool registry uses fixed schemas; tool parameters checked server-side; all write tools require authorization and user confirmation.
- No freeform generated HTML, no unsafe links, no implicit medical diagnosis, no medication changes.
- Provider portability via adapters and model routing; evaluate candidate provider before change with golden cases and data-residency check.

## Failure handling
Fallback to deterministic comparisons when LLM unavailable. Show uncertainty, reviewed sources and 'not enough verified data' when warranted. Sensitive outputs require evidence refs; hallucinated source references cause validation failure. Rate-limit per account, profile, device and task; use bulkheads and async jobs for report OCR.

## Tests
Tool-permission tests, prompt-injection tests, PHI redaction/minimization tests, schema and fallback tests, token budget/cost tests, provider swap regression, cross-profile caching tests, health answer citation accuracy. See docs 53 and 57.
