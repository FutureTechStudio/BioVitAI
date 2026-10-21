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
