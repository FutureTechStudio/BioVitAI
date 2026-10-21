# Longitudinal Trends

## Requirements
- Time-series view for any supported biomarker or vital.
- Select 30 days, 3 months, 6 months, 1 year, all time and custom dates.
- Show measurement date, source type, unit, reference interval, and source document.
- Display sample count and gaps; no implied continuity where data is sparse.
- Support side-by-side report comparison and longitudinal comparisons.
- Mark method/unit differences and exclude incomparable points from computed deltas.
- Deduplicate repeated uploads without deleting audit history.

## Derived values
Absolute change, percent change when meaningful, direction and date range. "Improved" is not equivalent to "numerically decreased"; interpretation is biomarker-specific and context-dependent.

## Charts
Accessible tables must accompany charts. Never interpolate a clinical result as if observed. If a value is below detection limit, display comparator rather than a fabricated number.

## Acceptance
Two reports with mismatched units are converted only through an approved rule. Missing values appear as missing, not zero.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Only construct trends across clinically comparable measurement methods/specimens/units and known collection times. Revised or invalidated source observations must invalidate the relevant trend and AI context caches.

**Related v2.1 requirements:**
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
