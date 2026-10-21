# 57 — AI tool registry and renderable components
Status: API/UX proposal · Owner: AI + Web/Mobile

## Existing v2 read tools
`get_health_context`, `find_reports`, `get_report_analysis`, `compare_reports`, `get_biomarker_trends`, `get_organ_evidence`, `get_condition_overview`, `get_lifestyle_plan`, `navigate_to_screen`.

## Tab 2 proposed tools
`get_wellness_profile`, `get_active_goals`, `list_approved_actions`, `get_adaptive_plan`, `get_wellness_progress`, `get_barrier_context`, `get_recovery_options`, `preview_plan_change`, `save_user_approved_plan_change`.

## Tab 3 proposed tools
`search_reviewed_articles`, `get_article_source_details`, `search_community_posts` (untrusted label), `report_community_post` (confirmation required). No tool to publish medical records or update clinical rules from Community data.

## Tool definition requirements
Every tool has: typed inputs and outputs; domain-service owner; authz policy; profile scope; data sensitivity; caching policy; max rows; timeout; write confirmation; error type; telemetry schema; version and evaluation fixture. Tool outputs carry source and evidence status. The model cannot register tools or select arbitrary URLs/SQL.

## Structured response blocks
`text`, `source_citation`, `report_summary`, `biomarker_trend`, `comparison_table`, `organ_evidence`, `wellness_action_card`, `recovery_choice`, `checkin_prompt`, `goal_progress`, `reviewed_article`, `navigation_suggestion`, `safety_notice`. Render blocks with allowlisted schemas; never render arbitrary model-generated HTML/JS. Ensure accessibility, RTL mirroring and non-color-only status semantics.

## Example flow: 'What should I do this week?'
1. Chat API selects authorized profile; orchestrator obtains approved goals/plan and relevant verified trends through typed services.
2. Wellness Plan Engine returns **eligible** reviewed actions and user-selectable variants.
3. Gateway writes a grounded explanation and JSON UI block referencing action IDs; server validates provenance and safety policy.
4. User accepts or edits action; explicit write request executes through Wellness service; confirmation and audit returned.

## Acceptance tests
Reject out-of-profile tool call, nonexistent action ID, stale evidence, invented source link, unauthorized write, untrusted post instruction, model-supplied HTML, and actions with expired approval.
