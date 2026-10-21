# AI Chat UX and Structured Response Blocks

## Goal
Render useful results as reusable native web/mobile components, not just long paragraphs.

## Response envelope

    {
      "message": "I compared the two verified reports.",
      "ui_blocks": [
        {
          "type": "report_comparison",
          "latest_report_id": "r_21",
          "previous_report_id": "r_17"
        },
        {
          "type": "biomarker_chart",
          "marker_codes": ["hba1c"],
          "date_range": "6_months"
        },
        {
          "type": "source_report",
          "report_id": "r_21",
          "page": 2
        }
      ],
      "source_ids": ["obs_101", "obs_205"],
      "limitations": ["Two observations do not establish a long-term trend."]
    }

## Supported block types
text_summary; report_card; report_comparison; biomarker_chart; biomarker_table; organ_evidence; condition_summary; source_report; missing_data; clarification; consent_required; navigation_suggestion; safety_notice.

## Rendering architecture
The model may suggest block types and authorized IDs, but server validates all IDs and fetches the actual display data. Clients render only an allowlisted block schema. No arbitrary model-generated HTML, JavaScript or untrusted deep links.

## UI interactions
Open source report at page; expand full marker list; change chart range; view organ evidence; ask follow-up; copy summary; export when authorized.

## States
Tool running, partial results, verification pending, no data, stale data, permission denied, incompatible measurements, retryable error.

## Accessibility
Charts need data tables; cards need semantic headings; source actions need accessible labels; status is never conveyed by color alone.

## Mobile specifics
Stack blocks vertically, use bottom-sheet source detail, preserve scroll position, minimize dense tables via expandable rows.

## Acceptance
The same response payload produces functionally equivalent cards on web and mobile, and all numeric displays come from validated backend data.
