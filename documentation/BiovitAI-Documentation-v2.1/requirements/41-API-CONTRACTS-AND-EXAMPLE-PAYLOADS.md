# API Contracts and Example Payloads

All examples use synthetic identifiers and measurements. Use OpenAPI and generated types in implementation.

## POST /v1/chat/sessions

Request:

    {
      "selected_profile_id": "p_demo",
      "client": "web"
    }

Response:

    {
      "session_id": "s_123",
      "selected_profile_id": "p_demo",
      "allowed_capabilities": [
        "reports.read",
        "observations.read",
        "analytics.read"
      ]
    }

Actor identity is derived from authentication, not request body.

## POST /v1/chat/sessions/{session_id}/messages

Request:

    {
      "message": "Compare my latest report with my previous report",
      "client_context": {
        "screen": "my_profile",
        "report_id": null
      }
    }

Response:

    {
      "message_id": "m_456",
      "status": "complete",
      "text": "I compared your two verified blood reports.",
      "ui_blocks": [
        {
          "type": "report_comparison",
          "latest_report_id": "r_21",
          "previous_report_id": "r_17"
        }
      ],
      "source_ids": ["r_21", "r_17"],
      "limitations": [],
      "request_id": "req_789"
    }

## GET /v1/profiles/{id}/health-context

Response:

    {
      "profile_id": "p_demo",
      "reports": {
        "verified_count": 8,
        "latest_observed_at": "2026-10-14"
      },
      "available_domains": ["glucose", "lipids", "kidney"],
      "device_types": ["blood_pressure"],
      "data_version": 104
    }

## POST /v1/reports/compare

Request:

    {
      "latest_report_id": "r_21",
      "previous_report_id": "r_17",
      "mode": "comparable_markers"
    }

Response:

    {
      "matched": [
        {
          "marker_code": "hba1c",
          "previous_value": 7.1,
          "latest_value": 6.7,
          "unit": "%",
          "absolute_change": -0.4,
          "source_ids": ["obs_101", "obs_205"]
        }
      ],
      "latest_only": [],
      "previous_only": [],
      "excluded": [],
      "selection_reason": "comparable verified blood panel"
    }

## Standard errors

    {
      "error": {
        "code": "NO_VERIFIED_DATA",
        "message": "No verified report is available for that period.",
        "retryable": false
      },
      "request_id": "req_789"
    }

## Contract requirements
Validate all inputs; paginate large collections; enforce profile scope; use idempotency for writes; version tool schemas; validate UI block types; return source IDs for every personalized numeric statement.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** All contracts must carry version, authorization context, provenance, verification/source quality and structured errors as applicable; add AI Gateway request/response and Wellness action decision schemas.

**Related v2.1 requirements:**
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
