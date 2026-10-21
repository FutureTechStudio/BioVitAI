# AI Chat — Product Requirements

Priority: P0 for AI MVP
Dependencies: verified observations, report search, analytics, profile permissions.

## Purpose
BiovitAI Chat is a natural-language control surface for authorized health data and existing app capabilities. The user should not need to know which feature, report, organ page or chart to open.

## Supported intents
1. Report discovery: "Show my latest blood report."
2. Period discovery: "How was my report last month?"
3. Comparison: "Compare my latest report with the previous one."
4. Marker history: "How has HbA1c changed over six months?"
5. Multi-marker explanation: "What stands out in this blood test?"
6. Organ evidence: "How are my kidneys doing?"
7. Condition tracking: "Show my blood pressure trend."
8. Lifestyle context: "What goals have I been following?"
9. Family queries: "Show Dad's latest report" only if authorized.
10. App navigation: "Open the report with high LDL."

## Chat must
- Know what data types and periods exist through a compact context manifest.
- Resolve relative time expressions using the user's timezone.
- Distinguish latest by observation date vs upload date.
- Select appropriate approved tools and retrieve minimal required information.
- Use verified data by default and identify missing/incomparable values.
- Compare all applicable tests, not just abnormal markers.
- Explain supported multi-marker patterns without diagnosing.
- Present structured UI blocks: comparison, trend chart, organ evidence, source report.
- Support follow-up references such as "What about the one before that?"
- Ask a clarification when profile, report or time interpretation materially changes the answer.
- Never invent a report, test, value, date, condition or tool result.

## Chat must not
- Directly access SQL, object storage or unrestricted patient files.
- Infer access to family data from an email address.
- Modify health records, grants or plans without a separate confirmed write flow.
- Claim continuous monitoring, emergency detection or medical diagnosis.

## Nonfunctional targets (initial, adjustable)
- Read-only tools in MVP.
- Bounded tool steps, token budgets and response sizes.
- Streaming text after retrieval where supported.
- Visible citations for clinical assertions.
- Graceful failure and safe no-data responses.
- Profile-specific conversation boundaries.

## Acceptance examples
"Last month" searches the previous calendar month, not the last 30 days. If no report exists, return "No verified report found in that period" and offer nearby dates.

"Compare my reports" uses clinically relevant comparability, shows matched, unmatched and excluded tests, and cites both source reports.

"Show Mom's report" never discloses content without an active matching grant.

## Definition of done
Twenty representative intent tests, clinical review of summaries, cross-profile denial tests, source traceability and mobile/web UI parity.
