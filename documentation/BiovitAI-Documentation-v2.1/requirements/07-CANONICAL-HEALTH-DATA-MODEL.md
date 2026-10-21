# Canonical Health Data Model

## Entities
accounts, profiles, profile_grants, invitations, consent_records, reports, report_pages, observations, biomarker_definitions, observation_sources, device_connections, device_readings, condition_tracking, organ_evidence, lifestyle_plans, habits, chat_sessions, chat_messages, tool_audit, clinical_rule_versions.

## Observation fields
id; profile_id; biomarker_code; original_name; original_value; original_unit; canonical_value; canonical_unit; comparator (e.g. less-than); reference_low/high/text; specimen; method; observed_at; timezone; source_type; source_id; source_page; verification_state; confidence; verified_at; created_at; superseded_by.

## Data rules
- Distinguish observed_at, issued_at, uploaded_at and verified_at.
- Keep immutable provenance and revision history.
- Support nonnumeric results and qualitative tests.
- Track reference ranges specific to lab, sex/age context and methodology where applicable.
- Keep device readings separate from lab observations until a validated mapping exists.
- Store missingness and coverage explicitly.

## Access
All clinical queries must be profile-scoped and authorization-checked. Prefer database row-level security as defense in depth, not as the only layer.

## Further detail
See 40-DATABASE-MIGRATIONS-AND-SCHEMA.md.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** The canonical hierarchy must distinguish immutable SourceObservation, ObservationGroup, and versioned AggregatedObservation with full lineage. Do not combine analytes solely because labels appear equivalent. See 56 and data contracts 49.

**Related v2.1 requirements:**
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
