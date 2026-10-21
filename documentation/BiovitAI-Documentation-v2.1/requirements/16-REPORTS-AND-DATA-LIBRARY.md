# Reports and Data Library

## Library
Search by report type, facility, observed date, upload date, verification state, marker, and tags.

## Report detail
Original PDF, source pages, extraction review, verified tests, report-level analysis, related reports, change history and download.

## Search semantics
"Latest" means most recent verified observation/report date unless user explicitly requests upload date. "Last month" means prior calendar month in user's timezone. "Previous" should select a relevant comparable report, not blindly the next upload.

## AI handoff
Chat can open a report, cite a page, compare reports or launch a chart. The AI must use report IDs returned by authorized tools, never guessed identifiers.

## Acceptance
A report uploaded today but collected months ago is sorted by clinical observation date when the user asks for latest test results.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Show original reports, verified observations, corrected/amended lineage and selected derived observations as distinguishable items. Library access must be profile-scoped and revocable.

**Related v2.1 requirements:**
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
