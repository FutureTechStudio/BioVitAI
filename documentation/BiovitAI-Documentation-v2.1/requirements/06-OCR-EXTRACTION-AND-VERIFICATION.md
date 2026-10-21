# Extraction, Normalization and Verification

## Extraction targets
Test display name, standardized code, value, value type, unit, reference interval, abnormal flag if present, specimen, observation date, method, source page, source bounding box and confidence.

## Verification UI
Side-by-side source page and extracted rows. Highlight low-confidence fields and identity mismatches. User can edit values, units, dates and ranges with an audit reason. Some clinically consequential ambiguities should require trained review before verification.

## Normalization
Maintain original value/unit and canonical value/unit separately. Use reviewed conversion rules, including test-specific exceptions. Avoid comparisons across different analytes, incompatible specimen types, incompatible methodologies or uncertain dates.

## Status
EXTRACTED is not VERIFIED. Analysis endpoints use verified data by default; unverified results may appear only with a prominent warning and must not be mixed silently into health status.

## Quality metrics
Field-level precision/recall on a representative labeled corpus, critical-field error rate, correction frequency, duplicate detection, and time to verified record.

## Acceptance
A low-confidence HbA1c value never appears as a definitive verified result. Source location remains accessible from any displayed result.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Preserve raw text, value comparator, units, dates and source-region coordinates; never overwrite an unverified candidate with a derived value. Repeat/rerun and amended result detection is a separately validated workflow.

**Related v2.1 requirements:**
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
