# Exports and Sharing

## Exports
Original reports, selected time-series tables, comparison summaries and clinician-friendly PDF/CSV exports.

## Required metadata
Patient/profile name, date range, data provenance, units, missingness, verification status, generation timestamp and interpretation limitations.

## Sharing
Time-limited, scoped access links only where supported and approved; default to secure authenticated sharing. Explicit confirmation for external recipient and included content.

## Security
Audit exports, enforce permissions, set expiry, support revocation and protect files at rest/in transit. Avoid exposing reports via predictable public URLs.

## Acceptance
A viewer without export scope cannot generate a full-profile export.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Exports and sharing must require active-profile permission and purpose-scoped consent. Never include Community profile content, family data or AI message history by default in another profile’s export.

**Related v2.1 requirements:**
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
