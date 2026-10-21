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
