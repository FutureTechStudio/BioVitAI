# Database Schema and Migration Starter

The following is illustrative PostgreSQL DDL. Add tenant IDs, indexes, foreign keys, retention policies and row-level security to fit your deployment.

## Tables

    CREATE TABLE profiles (
      id UUID PRIMARY KEY,
      owner_account_id UUID NOT NULL,
      display_name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE profile_grants (
      id UUID PRIMARY KEY,
      profile_id UUID NOT NULL REFERENCES profiles(id),
      grantee_account_id UUID NOT NULL,
      scope_json JSONB NOT NULL,
      consent_record_id UUID,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE reports (
      id UUID PRIMARY KEY,
      profile_id UUID NOT NULL REFERENCES profiles(id),
      object_key TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      report_type TEXT,
      observed_at TIMESTAMPTZ,
      issued_at TIMESTAMPTZ,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      verification_state TEXT NOT NULL,
      revision INT NOT NULL DEFAULT 1
    );

    CREATE TABLE observations (
      id UUID PRIMARY KEY,
      profile_id UUID NOT NULL REFERENCES profiles(id),
      report_id UUID REFERENCES reports(id),
      biomarker_code TEXT NOT NULL,
      original_name TEXT NOT NULL,
      original_value TEXT,
      original_unit TEXT,
      canonical_value NUMERIC,
      canonical_unit TEXT,
      reference_low NUMERIC,
      reference_high NUMERIC,
      specimen TEXT,
      method TEXT,
      observed_at TIMESTAMPTZ NOT NULL,
      source_page INT,
      verification_state TEXT NOT NULL,
      revision INT NOT NULL DEFAULT 1,
      superseded_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE chat_sessions (
      id UUID PRIMARY KEY,
      actor_account_id UUID NOT NULL,
      profile_id UUID NOT NULL REFERENCES profiles(id),
      summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE tool_execution_audit (
      id UUID PRIMARY KEY,
      chat_session_id UUID,
      actor_account_id UUID NOT NULL,
      profile_id UUID NOT NULL,
      tool_name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

## Additional production tables
accounts; invitations; consent_records; report_pages; observation_sources; biomarker_definitions; device_connections; device_readings; condition_tracking; organ_evidence; clinical_rules; report_analyses; lifestyle_plans; chat_messages; audit_events.

## Indexes
reports(profile_id, observed_at DESC);
observations(profile_id, biomarker_code, observed_at DESC);
profile_grants(grantee_account_id, profile_id);
chat_sessions(actor_account_id, profile_id).

## Migration policy
Additive schema changes first; backfill; dual-read/write if needed; validate; then remove old columns. Never silently rewrite historical original measurements. Preserve revision and audit records.

## Isolation
Enforce authorization at API/service layer and use database row-level security as defense in depth. Object keys must not be publicly guessable.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Add SourceObservation/ObservationGroup/AggregatedObservation and rule/version/lineage models, plus Wellness profile/goal/action/check-in/plan/adaptation/recovery entities and separate Community identity/moderation tables. Migrations must preserve v2 data.

**Related v2.1 requirements:**
- [49-DATA-CONTRACTS-AND-EVENTS](49-DATA-CONTRACTS-AND-EVENTS.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
