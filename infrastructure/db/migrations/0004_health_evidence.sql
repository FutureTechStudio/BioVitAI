-- Canonical evidence only. No clinical rules or interpretations are seeded.
CREATE DOMAIN health_finite_numeric AS numeric
  CHECK (VALUE::text NOT IN ('NaN','Infinity','-Infinity'));

CREATE TABLE health_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('normalization','aggregation','comparability')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','retired')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  rationale text NOT NULL CHECK (length(rationale)>0),
  evidence_references jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence_references)='array'),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code,version),
  CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND length(reviewed_by)>0 AND reviewed_at IS NOT NULL))
);

CREATE TABLE health_source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  storage_object_id uuid NOT NULL UNIQUE,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf','image/png','image/jpeg','image/tiff','image/webp')),
  byte_length bigint NOT NULL CHECK (byte_length>0),
  page_count integer NOT NULL CHECK (page_count>0),
  uploaded_by uuid NOT NULL REFERENCES identity_user(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id)
);
CREATE INDEX health_document_hash ON health_source_documents(profile_id,content_sha256);

CREATE TABLE health_diagnostic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  document_id uuid NOT NULL,
  facility_name text,
  report_identifier text,
  subject_identifiers jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(subject_identifiers)='object'),
  issued_precision text NOT NULL DEFAULT 'unknown' CHECK (issued_precision IN ('unknown','date','instant')),
  issued_date date,
  issued_at timestamptz,
  issued_timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id),
  UNIQUE(profile_id,document_id,id),
  FOREIGN KEY(profile_id,document_id) REFERENCES health_source_documents(profile_id,id),
  CHECK ((issued_precision='unknown' AND issued_date IS NULL AND issued_at IS NULL AND issued_timezone IS NULL)
    OR (issued_precision='date' AND issued_date IS NOT NULL AND issued_at IS NULL AND issued_timezone IS NULL)
    OR (issued_precision='instant' AND issued_at IS NOT NULL AND issued_date IS NULL))
);
CREATE INDEX health_report_profile_date ON health_diagnostic_reports(profile_id,issued_date DESC,issued_at DESC);

CREATE TABLE health_report_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  document_id uuid NOT NULL,
  page_number integer NOT NULL CHECK (page_number>0),
  page_sha256 text CHECK (page_sha256 ~ '^[0-9a-f]{64}$'),
  width_pixels integer CHECK (width_pixels>0),
  height_pixels integer CHECK (height_pixels>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,document_id,id),
  UNIQUE(profile_id,document_id,page_number),
  FOREIGN KEY(profile_id,document_id) REFERENCES health_source_documents(profile_id,id)
);

CREATE TABLE health_raw_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  document_id uuid NOT NULL,
  report_id uuid NOT NULL,
  page_id uuid NOT NULL,
  raw_text text NOT NULL,
  x0 health_finite_numeric NOT NULL CHECK (x0>=0 AND x0<=1),
  y0 health_finite_numeric NOT NULL CHECK (y0>=0 AND y0<=1),
  x1 health_finite_numeric NOT NULL CHECK (x1>=0 AND x1<=1),
  y1 health_finite_numeric NOT NULL CHECK (y1>=0 AND y1<=1),
  extractor_name text NOT NULL CHECK (length(extractor_name)>0),
  extractor_version text NOT NULL CHECK (length(extractor_version)>0),
  confidence health_finite_numeric CHECK (confidence>=0 AND confidence<=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,report_id,id),
  FOREIGN KEY(profile_id,document_id,report_id) REFERENCES health_diagnostic_reports(profile_id,document_id,id),
  FOREIGN KEY(profile_id,document_id,page_id) REFERENCES health_report_pages(profile_id,document_id,id),
  CHECK (x0<x1 AND y0<y1)
);

CREATE TABLE health_extraction_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  report_id uuid NOT NULL,
  raw_field_id uuid NOT NULL,
  field_kind text NOT NULL,
  parsed_value jsonb NOT NULL,
  parser_name text NOT NULL,
  parser_version text NOT NULL,
  confidence health_finite_numeric CHECK (confidence>=0 AND confidence<=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,raw_field_id) REFERENCES health_raw_fields(profile_id,report_id,id)
);

CREATE TABLE health_report_identity_actions (
  sequence bigserial PRIMARY KEY,
  profile_id uuid NOT NULL,
  report_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  state text NOT NULL CHECK (state IN ('pending','matched','quarantined')),
  reason text NOT NULL CHECK (length(reason)>0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,report_id,sequence),
  FOREIGN KEY(profile_id,report_id) REFERENCES health_diagnostic_reports(profile_id,id)
);
CREATE INDEX health_report_identity_latest ON health_report_identity_actions(profile_id,report_id,sequence DESC);

CREATE TABLE health_specimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  report_id uuid NOT NULL,
  original_text text NOT NULL,
  system_code text,
  field_id uuid NOT NULL,
  collected_time_field_id uuid,
  collected_precision text NOT NULL DEFAULT 'unknown' CHECK (collected_precision IN ('unknown','date','instant')),
  collected_date date,
  collected_at timestamptz,
  collected_timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,collected_time_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  CHECK ((collected_precision='unknown' AND collected_date IS NULL AND collected_at IS NULL AND collected_timezone IS NULL)
    OR (collected_precision='date' AND collected_date IS NOT NULL AND collected_at IS NULL AND collected_timezone IS NULL AND collected_time_field_id IS NOT NULL)
    OR (collected_precision='instant' AND collected_at IS NOT NULL AND collected_date IS NULL AND collected_time_field_id IS NOT NULL))
);

CREATE TABLE health_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  report_id uuid NOT NULL,
  candidate_id uuid,
  concept_code text,
  concept_system text,
  original_name text NOT NULL CHECK (length(original_name)>0),
  original_value text NOT NULL,
  original_unit text,
  name_field_id uuid NOT NULL,
  value_field_id uuid NOT NULL,
  unit_field_id uuid,
  reference_field_id uuid,
  method_field_id uuid,
  observed_time_field_id uuid,
  result_time_field_id uuid,
  value_kind text NOT NULL CHECK (value_kind IN ('quantity','qualitative','missing')),
  numeric_value health_finite_numeric,
  comparator text CHECK (comparator IN ('=','<','<=','>','>=')),
  qualitative_value text,
  missing_reason text,
  canonical_value health_finite_numeric,
  canonical_unit text,
  normalization_rule_id uuid REFERENCES health_rule_versions(id),
  reference_low health_finite_numeric,
  reference_high health_finite_numeric,
  reference_text text,
  reference_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(reference_context)='object'),
  specimen_id uuid,
  method text,
  observed_precision text NOT NULL DEFAULT 'unknown' CHECK (observed_precision IN ('unknown','date','instant')),
  observed_date date,
  observed_at timestamptz,
  observed_timezone text,
  resulted_precision text NOT NULL DEFAULT 'unknown' CHECK (resulted_precision IN ('unknown','date','instant')),
  resulted_date date,
  resulted_at timestamptz,
  resulted_timezone text,
  confidence health_finite_numeric CHECK (confidence>=0 AND confidence<=1),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  previous_observation_id uuid,
  correction_reason text,
  recorded_by uuid NOT NULL REFERENCES identity_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id),
  UNIQUE(profile_id,report_id,id),
  UNIQUE(profile_id,previous_observation_id),
  FOREIGN KEY(profile_id,report_id) REFERENCES health_diagnostic_reports(profile_id,id),
  FOREIGN KEY(profile_id,report_id,candidate_id) REFERENCES health_extraction_candidates(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,name_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,value_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,unit_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,reference_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,method_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,observed_time_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,result_time_field_id) REFERENCES health_raw_fields(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,specimen_id) REFERENCES health_specimens(profile_id,report_id,id),
  FOREIGN KEY(profile_id,previous_observation_id) REFERENCES health_source_observations(profile_id,id),
  CHECK ((value_kind='quantity' AND numeric_value IS NOT NULL AND comparator IS NOT NULL AND qualitative_value IS NULL AND missing_reason IS NULL)
    OR (value_kind='qualitative' AND numeric_value IS NULL AND comparator IS NULL AND length(qualitative_value)>0 AND qualitative_value IS NOT NULL AND missing_reason IS NULL)
    OR (value_kind='missing' AND numeric_value IS NULL AND comparator IS NULL AND qualitative_value IS NULL AND length(missing_reason)>0 AND missing_reason IS NOT NULL)),
  CHECK ((canonical_value IS NULL AND canonical_unit IS NULL AND normalization_rule_id IS NULL)
    OR (value_kind='quantity' AND canonical_value IS NOT NULL AND canonical_unit IS NOT NULL AND normalization_rule_id IS NOT NULL)),
  CHECK ((concept_code IS NULL) = (concept_system IS NULL)),
  CHECK (original_unit IS NULL OR unit_field_id IS NOT NULL),
  CHECK ((reference_low IS NULL AND reference_high IS NULL AND reference_text IS NULL) OR reference_field_id IS NOT NULL),
  CHECK (reference_low IS NULL OR reference_high IS NULL OR reference_low<=reference_high),
  CHECK (method IS NULL OR method_field_id IS NOT NULL),
  CHECK ((previous_observation_id IS NULL AND revision=1 AND correction_reason IS NULL)
    OR (previous_observation_id IS NOT NULL AND previous_observation_id<>id AND revision>1 AND length(correction_reason)>0 AND correction_reason IS NOT NULL)),
  CHECK ((observed_precision='unknown' AND observed_date IS NULL AND observed_at IS NULL AND observed_timezone IS NULL)
    OR (observed_precision='date' AND observed_date IS NOT NULL AND observed_at IS NULL AND observed_timezone IS NULL AND observed_time_field_id IS NOT NULL)
    OR (observed_precision='instant' AND observed_at IS NOT NULL AND observed_date IS NULL AND observed_time_field_id IS NOT NULL)),
  CHECK ((resulted_precision='unknown' AND resulted_date IS NULL AND resulted_at IS NULL AND resulted_timezone IS NULL)
    OR (resulted_precision='date' AND resulted_date IS NOT NULL AND resulted_at IS NULL AND resulted_timezone IS NULL AND result_time_field_id IS NOT NULL)
    OR (resulted_precision='instant' AND resulted_at IS NOT NULL AND resulted_date IS NULL AND result_time_field_id IS NOT NULL))
);
CREATE INDEX health_source_profile_concept_date ON health_source_observations(profile_id,concept_code,observed_date DESC,observed_at DESC);

CREATE TABLE health_verification_actions (
  sequence bigserial PRIMARY KEY,
  profile_id uuid NOT NULL,
  report_id uuid NOT NULL,
  observation_id uuid NOT NULL,
  identity_action_sequence bigint,
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  state text NOT NULL CHECK (state IN ('needs_review','verified','rejected')),
  reason text NOT NULL CHECK (length(reason)>0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(profile_id,report_id,observation_id) REFERENCES health_source_observations(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,identity_action_sequence) REFERENCES health_report_identity_actions(profile_id,report_id,sequence),
  CHECK (state<>'verified' OR identity_action_sequence IS NOT NULL)
);
CREATE INDEX health_verification_latest ON health_verification_actions(profile_id,observation_id,sequence DESC);

CREATE TABLE health_observation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  kind text NOT NULL CHECK (kind IN ('panel','repeat','rerun','episode','reprint')),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id)
);
CREATE TABLE health_group_members (
  profile_id uuid NOT NULL,
  group_id uuid NOT NULL,
  observation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id,group_id,observation_id),
  FOREIGN KEY(profile_id,group_id) REFERENCES health_observation_groups(profile_id,id),
  FOREIGN KEY(profile_id,observation_id) REFERENCES health_source_observations(profile_id,id)
);
CREATE TABLE health_aggregation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  group_id uuid NOT NULL,
  rule_id uuid REFERENCES health_rule_versions(id),
  kind text NOT NULL CHECK (kind IN ('select','aggregate','no_calculation')),
  reason text NOT NULL CHECK (length(reason)>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id),
  UNIQUE(profile_id,group_id,id),
  FOREIGN KEY(profile_id,group_id) REFERENCES health_observation_groups(profile_id,id),
  CHECK (kind='no_calculation' OR rule_id IS NOT NULL)
);
CREATE TABLE health_aggregation_inputs (
  profile_id uuid NOT NULL,
  group_id uuid NOT NULL,
  decision_id uuid NOT NULL,
  observation_id uuid NOT NULL,
  included boolean NOT NULL,
  reason text NOT NULL CHECK (length(reason)>0),
  PRIMARY KEY(profile_id,decision_id,observation_id),
  FOREIGN KEY(profile_id,group_id,decision_id) REFERENCES health_aggregation_decisions(profile_id,group_id,id),
  FOREIGN KEY(profile_id,group_id,observation_id) REFERENCES health_group_members(profile_id,group_id,observation_id)
);
CREATE TABLE health_aggregated_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  decision_id uuid NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  previous_aggregate_id uuid,
  value_kind text NOT NULL CHECK (value_kind IN ('quantity','qualitative')),
  numeric_value health_finite_numeric,
  comparator text CHECK (comparator IN ('=','<','<=','>','>=')),
  unit text,
  qualitative_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id),
  UNIQUE(profile_id,decision_id),
  UNIQUE(profile_id,previous_aggregate_id),
  FOREIGN KEY(profile_id,decision_id) REFERENCES health_aggregation_decisions(profile_id,id),
  FOREIGN KEY(profile_id,previous_aggregate_id) REFERENCES health_aggregated_observations(profile_id,id),
  CHECK ((value_kind='quantity' AND numeric_value IS NOT NULL AND comparator IS NOT NULL AND unit IS NOT NULL AND qualitative_value IS NULL)
    OR (value_kind='qualitative' AND numeric_value IS NULL AND comparator IS NULL AND unit IS NULL AND qualitative_value IS NOT NULL AND length(qualitative_value)>0)),
  CHECK ((previous_aggregate_id IS NULL AND revision=1) OR (previous_aggregate_id IS NOT NULL AND previous_aggregate_id<>id AND revision>1))
);

CREATE VIEW health_effective_source_observations WITH (security_invoker=true) AS
SELECT s.*,
  CASE WHEN EXISTS(SELECT 1 FROM health_source_observations child WHERE child.profile_id=s.profile_id AND child.previous_observation_id=s.id) THEN 'superseded'
    WHEN COALESCE(i.state,'pending') <> 'matched' THEN CASE WHEN i.state='quarantined' THEN 'quarantined' ELSE 'identity_pending' END
    WHEN v.state='verified' AND v.identity_action_sequence IS DISTINCT FROM i.sequence THEN 'needs_review'
    ELSE COALESCE(v.state,'unverified') END AS verification_state,
  v.recorded_at AS verification_recorded_at
FROM health_source_observations s
LEFT JOIN LATERAL (SELECT state,sequence FROM health_report_identity_actions WHERE profile_id=s.profile_id AND report_id=s.report_id ORDER BY sequence DESC LIMIT 1) i ON true
LEFT JOIN LATERAL (SELECT state,recorded_at,identity_action_sequence FROM health_verification_actions WHERE profile_id=s.profile_id AND observation_id=s.id ORDER BY sequence DESC LIMIT 1) v ON true;

CREATE VIEW health_effective_aggregated_observations WITH (security_invoker=true) AS
SELECT a.*,
  CASE WHEN EXISTS(SELECT 1 FROM health_aggregated_observations child WHERE child.profile_id=a.profile_id AND child.previous_aggregate_id=a.id) THEN 'superseded'
    WHEN EXISTS(SELECT 1 FROM health_aggregation_inputs input JOIN health_effective_source_observations source ON source.profile_id=input.profile_id AND source.id=input.observation_id WHERE input.profile_id=a.profile_id AND input.decision_id=a.decision_id AND input.included AND source.verification_state<>'verified') THEN 'stale'
    ELSE 'current' END AS lineage_state
FROM health_aggregated_observations a;

CREATE FUNCTION health_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Health evidence is append-only'; END;
$$;

CREATE FUNCTION health_validate_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision integer; declared_pages integer; identity_sequence bigint; identity_state text;
BEGIN
  -- Separate health lock avoids re-locking the authorization row from a nested connection.
  -- All health writes for one profile serialize verification/correction/derivation.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.profile_id::text,184226010));
  IF TG_TABLE_NAME IN ('health_report_identity_actions','health_verification_actions') THEN
    -- Defaults are evaluated before BEFORE triggers: allocate ordering only after the lock.
    NEW.sequence:=nextval(pg_get_serial_sequence(TG_TABLE_NAME,'sequence'));
    NEW.recorded_at:=clock_timestamp();
  END IF;
  IF TG_TABLE_NAME='health_report_pages' THEN
    SELECT page_count INTO declared_pages FROM health_source_documents WHERE profile_id=NEW.profile_id AND id=NEW.document_id;
    IF NEW.page_number>declared_pages THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Page is outside source document'; END IF;
  ELSIF TG_TABLE_NAME='health_source_observations' THEN
    IF NEW.previous_observation_id IS NOT NULL THEN
      SELECT revision INTO prior_revision FROM health_source_observations WHERE profile_id=NEW.profile_id AND id=NEW.previous_observation_id;
      IF prior_revision IS NULL OR NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid observation revision'; END IF;
    END IF;
    IF NEW.normalization_rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM health_rule_versions WHERE id=NEW.normalization_rule_id AND purpose='normalization' AND status='approved') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Approved normalization rule required';
    END IF;
  ELSIF TG_TABLE_NAME='health_verification_actions' THEN
    IF NEW.state='verified' THEN
      SELECT sequence,state INTO identity_sequence,identity_state FROM health_report_identity_actions WHERE profile_id=NEW.profile_id AND report_id=NEW.report_id ORDER BY sequence DESC LIMIT 1;
      IF identity_state IS DISTINCT FROM 'matched' THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Matched report identity required'; END IF;
      NEW.identity_action_sequence:=identity_sequence;
    END IF;
  ELSIF TG_TABLE_NAME='health_aggregated_observations' THEN
    IF NEW.previous_aggregate_id IS NOT NULL THEN
      SELECT revision INTO prior_revision FROM health_aggregated_observations WHERE profile_id=NEW.profile_id AND id=NEW.previous_aggregate_id;
      IF prior_revision IS NULL OR NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid aggregate revision'; END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM health_aggregation_decisions d JOIN health_rule_versions r ON r.id=d.rule_id WHERE d.profile_id=NEW.profile_id AND d.id=NEW.decision_id AND d.kind<>'no_calculation' AND r.status='approved' AND r.purpose='aggregation') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Approved derivation rule required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM health_aggregation_inputs WHERE profile_id=NEW.profile_id AND decision_id=NEW.decision_id AND included) OR EXISTS(SELECT 1 FROM health_aggregation_inputs input JOIN health_effective_source_observations source ON source.profile_id=input.profile_id AND source.id=input.observation_id WHERE input.profile_id=NEW.profile_id AND input.decision_id=NEW.decision_id AND input.included AND source.verification_state<>'verified') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Current verified source lineage required';
    END IF;
  ELSIF TG_TABLE_NAME='health_aggregation_inputs' THEN
    IF EXISTS(SELECT 1 FROM health_aggregated_observations WHERE profile_id=NEW.profile_id AND decision_id=NEW.decision_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Published lineage is sealed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['health_source_documents','health_diagnostic_reports','health_report_pages','health_raw_fields','health_extraction_candidates','health_report_identity_actions','health_specimens','health_source_observations','health_verification_actions','health_observation_groups','health_group_members','health_aggregation_decisions','health_aggregation_inputs','health_aggregated_observations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY profile_isolation ON %I USING (profile_id = nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid) WITH CHECK (profile_id = nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid)',table_name);
    EXECUTE format('CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION health_reject_mutation()',table_name);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation()',table_name);
    EXECUTE format('CREATE TRIGGER validate_evidence BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION health_validate_evidence()',table_name);
  END LOOP;
END;
$$;
CREATE TRIGGER immutable_rule BEFORE UPDATE OR DELETE ON health_rule_versions FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TRIGGER immutable_rule_truncate BEFORE TRUNCATE ON health_rule_versions FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation();
