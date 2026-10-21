# Device Connections and Manual Entry

## Data sources
Supported platform health stores, compatible BP monitors, wearables, glucometers where available, and manual input.

## Requirements
Connection consent and revocation; last sync timestamp; data-type scope; duplicate detection; unit normalization; device provenance; backfill rules; source priority.

## Manual entry
Capture value, unit, date/time, source, optional note, and user confirmation. Mark manual data clearly. Offer edit history and correction.

## Safety
Do not merge lab glucose, continuous glucose monitor samples and manual glucose readings as interchangeable data without context. Respect device accuracy and missing-data limitations.

## Acceptance
Disconnecting a source stops future sync. Duplicate syncs do not inflate counts or charts.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Device data integration is optional and consent-scoped, with transparent freshness, data quality, revocation and manual override. Reconcile duplicate sources without destroying raw readings. Device disconnection must not imply user failure.

**Related v2.1 requirements:**
- [45-WELLNESS-BEHAVIOR-CHANGE-ENGINE](45-WELLNESS-BEHAVIOR-CHANGE-ENGINE.md)
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
