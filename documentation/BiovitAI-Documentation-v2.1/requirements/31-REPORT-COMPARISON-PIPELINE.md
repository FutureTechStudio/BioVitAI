# Report Comparison Pipeline

## Objective
Compare the entire relevant test set across two or more verified reports, with traceable differences and clinically appropriate comparability checks.

## Step 1: Choose reports
Latest by observation date; prior by type, panel overlap, specimen compatibility and chronology. If several candidates are equally plausible, ask user or show selection. Never select solely by upload timestamp.

## Step 2: Match tests
Use standardized analyte code plus specimen, method and relevant context. Alias names such as HbA1c and glycated hemoglobin map to one reviewed definition. Prevent false matches (total vs direct bilirubin; fasting vs random glucose where context matters).

## Step 3: Normalize
Use approved conversion registry, preserve original values and units, flag method changes, reference-range differences, inequalities and nonnumeric results.

## Step 4: Compute
For valid numeric pairs:
absolute_change = latest - previous
percent_change = 100 * (latest - previous) / previous, only when mathematically and clinically meaningful.
Include date interval, precision rules and source IDs.
Do not call an increase/decrease an improvement without reviewed context.

## Step 5: Coverage
Output matched, latest_only, previous_only, excluded and uncertain test groups. Display all relevant tests, not only flagged ones.

## Step 6: Pattern analysis
Pass verified comparable observations to versioned multi-marker rules. Distinguish report findings from longitudinal findings. Do not infer a diagnosis.

## Step 7: Render
Comparison summary; complete test table; chart for selected markers; source cards; limitations; clinician follow-up prompts when warranted.

## Example response fragment

    {
      "latest_report_id": "r_21",
      "previous_report_id": "r_17",
      "selection_reason": "previous verified comparable blood panel",
      "matched": [
        {
          "marker_code": "hba1c",
          "previous": {"value": 7.1, "unit": "%"},
          "latest": {"value": 6.7, "unit": "%"},
          "absolute_change": -0.4,
          "direction": "decreased",
          "interpretation": "requires clinical context",
          "source_ids": ["obs_101", "obs_205"]
        }
      ],
      "latest_only": [],
      "previous_only": [],
      "excluded": [],
      "warnings": []
    }

## Acceptance
A report with 40 tests cannot be summarized as if it contained only the three abnormal ones. All 40 must be accounted for in matched/unmatched/excluded output.

## Caching
Cache comparison by both report IDs, observation revisions, clinical rule version and normalization version. Invalidate on correction.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Comparison and aggregation depend on specimen, method, context, time and final/corrected status; preserve comparator values such as <5 and prevent automatic merging across different clinical events.

**Related v2.1 requirements:**
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
