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
