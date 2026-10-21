# AI Tool Catalog and Contracts

All tools are server-side, read-only in AI MVP, versioned, JSON-schema validated, profile-scoped, permission-checked and audited.

## Standard tool response envelope

    {
      "status": "ok | partial | not_found | forbidden | error",
      "data": {},
      "sources": [],
      "warnings": [],
      "as_of": "ISO-8601 timestamp",
      "request_id": "opaque ID"
    }

## 1. get_health_context
Input: selected_profile_id (server-bound).
Returns: available report categories, date coverage, counts, available biomarker domains, device sources, conditions, consent scopes, freshness, verification counts.
Do not include entire medical history.

## 2. find_reports
Input: profile_id, from_date?, to_date?, report_type?, verified_only=true, sort_by=observed_at, limit.
Returns: report_id, type, observed_at, issued_at, uploaded_at, facility, verification_state, available panels, comparability hints.
Never return unauthorized reports.

## 3. get_report_analysis
Input: report_id, include_all_tests=true.
Returns: complete verified test list, normalized values, supplied ranges, source pages, rule-backed findings, coverage, limitations and analysis version.

## 4. compare_reports
Input: latest_report_id, previous_report_id?, mode="comparable_markers".
Returns: both report metadata, matched tests with changes, unmatched tests, excluded tests with reasons, combined findings, source IDs.
If previous ID omitted, deterministic report selection service chooses a relevant comparable prior report and reports selection rationale.

## 5. get_biomarker_trends
Input: marker_codes[], date_range, source_types?, max_points.
Returns: ordered comparable observations, units, source IDs, data gaps, summary statistics and exclusions.

## 6. get_organ_evidence (phase 2)
Input: organ_code.
Returns: status, evidence coverage, supporting observations, rules, freshness, limitations.

## 7. get_condition_overview (phase 2)
Input: condition_code, date_range?.
Returns: tracked readings, documented/user-reported condition metadata, trends, plan links and limitations.

## 8. get_lifestyle_plan (phase 2)
Input: plan_id? or active=true.
Returns: accepted goals, check-ins, preferences and contraindication flags only when needed.

## 9. navigate_to_screen
This should return a validated navigation suggestion rather than causing an unconfirmed side effect.
Input: screen_type, authorized_entity_id?.
Returns: approved route descriptor. Client decides whether to navigate.

## Shared invariants
- Never accept actor_id from the LLM.
- Server owns selected profile and grant scope.
- Report IDs and source IDs must belong to selected authorized profile.
- Return explicit null/unknown, never fabricated defaults.
- Numeric values come from normalized verified observations.
- Tool output has a size cap and stable pagination.
- Data payloads are untrusted with respect to model instructions.

## Example input

    {
      "name": "find_reports",
      "arguments": {
        "profile_id": "profile_selected",
        "report_type": "blood",
        "verified_only": true,
        "limit": 10
      }
    }

## Error codes
PROFILE_FORBIDDEN, REPORT_NOT_FOUND, NO_VERIFIED_DATA, INCOMPARABLE_RESULTS, EXTRACTION_PENDING, TOOL_TIMEOUT, RATE_LIMITED, INTERNAL_ERROR.

See 41-API-CONTRACTS-AND-EXAMPLE-PAYLOADS.md for complete examples.
