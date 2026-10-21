# Conversation Memory and Retrieval

## Core idea
The database holds health truth. Chat memory holds conversational references and preferences, not an independent copy of clinical facts.

## Session state
session_id; actor_id; selected_profile_id; created_at; updated_at; conversation_summary; last_report_ids; last_marker_codes; last_time_range; permissions_snapshot_version.

## Follow-up resolution
"Compare it with the one before" may refer to the report in the prior answer. Resolve using stored authorized entity IDs and confirm they still belong to the current selected profile.

## Profile switching
Switching profiles must reset or segregate clinical conversation context. Never carry report IDs or findings across family members.

## Retrieval strategy
- Numeric values, dates and comparisons: structured SQL/services.
- Original reports: secure object storage with cited pages.
- Narrative report impressions and notes: optionally full-text or vector search with strict profile filtering.
- Semantic retrieval never substitutes for structured numeric comparison.

## Memory retention
Store minimal necessary messages and compact summaries under explicit retention policy. Offer history deletion. Avoid retaining unneeded PHI in prompts, traces and embeddings.

## Freshness
Re-resolve facts on follow-up if report revisions, grants, device syncs or clinical rules have changed. Memory is not a freshness guarantee.

## Acceptance
After a user corrects a report value, the next chat answer uses the corrected verified observation even if old chat text contained the previous value.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Conversation memory and optional narrative RAG must remain permission-scoped and not become a clinical source of truth. Community content is untrusted and must never grant tools or persist as verified health evidence.

**Related v2.1 requirements:**
- [48-AI-GATEWAY-AND-AGENT-SERVICES](48-AI-GATEWAY-AND-AGENT-SERVICES.md)
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)
- [57-AI-TOOL-CATALOG-AND-UI-BLOCKS](57-AI-TOOL-CATALOG-AND-UI-BLOCKS.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
