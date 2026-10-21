# 56 — Multiple-check medical observation model
Status: Required enhancement to existing Tab 1 v2 · Owner: Health + Laboratory Reviewer

## Principle
**Preserve every clinically distinct source result. Group freely; calculate aggregates sparingly.** A report may repeat the same result, present amended/final data, display a time series, or use different specimens/methods. Similar labels are not proof of comparability.

## Three-layer model
1. `SourceObservation` immutable extracted/verified fact, source document ID/page/box, raw text/unit/comparator, collection/result dates, specimen, method and verification status.
2. `ObservationGroup` relates items sharing a panel, specimen, repeat/re-run or episode; does not imply numeric pooling.
3. `AggregatedObservation` derived versioned view with approved rule ID, inputs/exclusions, normalization, justification and complete lineage. A derived result never overwrites sources.

## Default decision order
Validate identity → capture source fields → verify → map concept/specimen/time/method → group by actual clinical event → detect exact reprints vs separate tests → select corrected/final only when explicit → create derived summary only if approved and protocol-applicable → persist decision trace and source links.

## Important negative examples
- Serum vs urine creatinine: **do not merge**.
- Fasting vs 2-hour glucose: **do not average**.
- Potassium 5.9 then rerun 4.4: preserve both + rerun relationship; follow validated display policy.
- CRP `<5 mg/L`: preserve comparator `<`, never silently treat as `5`.
- Lab panel with 15 analytes: panel is a group, not a scalar.
- Device BP protocol may permit clinically reviewed derived series summary, distinct from source readings.

## User-facing provenance
When displaying selected result, show date, status and `Why this value?` with source/excluded variants; ambiguity yields `Needs review`, not false certainty. Corrections invalidate downstream trend/cache/AI context through eventing.

## Acceptance
100% source-to-derived traceability on golden set, zero known clinically meaningful false merges, cross-profile identity mismatches quarantined, correct comparator/time/method preservation, no unsupported 'organ health score'.

## Reconcile
`05-REPORT-UPLOAD-AND-INGESTION.md`, `06-OCR-EXTRACTION-AND-VERIFICATION.md`, `07-CANONICAL-HEALTH-DATA-MODEL.md`, `08-LONGITUDINAL-TRENDS.md`, `09-BIOMARKERS-AND-CLINICAL-INTERPRETATION.md`, `31-REPORT-COMPARISON-PIPELINE.md`, `40-DATABASE-MIGRATIONS-AND-SCHEMA.md`.
