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
