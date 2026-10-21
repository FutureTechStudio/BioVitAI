# Report Upload and Ingestion

## Input
PDF and common image formats, with file size/page limits, MIME inspection, malware scanning, encrypted object storage, and upload progress.

## Pipeline
UPLOAD_RECEIVED → SCANNED → TEXT_EXTRACTED → TESTS_PARSED → IDENTITY_REVIEW → NORMALIZED → USER_REVIEW → VERIFIED → ANALYZED → INDEXED.

Errors enter explicit retry or review states; never silently mark failed documents verified.

## Data capture
Report ID, profile ID, facility, sample/observation dates, issued date, panel names, patient identifiers for matching, page count, raw file hash, source pages, extracted tests, ranges, units and confidence.

## Important behavior
- New uploads must not automatically change verified organ or condition views until validation completes.
- Detect duplicate hashes and semantically duplicate reports.
- Reject or quarantine documents with conflicting patient identity.
- Handle partial pages, handwritten values and scanned documents through review.
- Preserve immutable originals and corrected extraction history.

## Events
report.uploaded, report.extracted, report.review_required, report.verified, report.analysis_ready, report.rejected.

## Acceptance
A report containing mixed patient names is not attached to a profile automatically. A corrected value preserves both original extraction and human correction in the audit trail.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Retain the original report as immutable evidence. Each extracted candidate requires identity validation, report page/region provenance and a verification state; mismatched patient identity must be quarantined before publishing to a profile.

**Related v2.1 requirements:**
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
