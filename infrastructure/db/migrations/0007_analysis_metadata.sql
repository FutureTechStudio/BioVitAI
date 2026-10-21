-- Confirmed contextual metadata is append-only, with an explicit source field.
CREATE TABLE health_verified_context (
 profile_id uuid NOT NULL, report_id uuid NOT NULL, observation_id uuid PRIMARY KEY,
 concept_system text NOT NULL, concept_code text NOT NULL, specimen text NOT NULL,
 method text NOT NULL, observed_date date NOT NULL, source_field_id uuid NOT NULL,
 FOREIGN KEY(profile_id,report_id,observation_id) REFERENCES health_source_observations(profile_id,report_id,id),
 FOREIGN KEY(profile_id,report_id,source_field_id) REFERENCES health_raw_fields(profile_id,report_id,id)
);
ALTER TABLE health_verified_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_verified_context FORCE ROW LEVEL SECURITY;
CREATE POLICY health_context_profile ON health_verified_context USING (profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid) WITH CHECK (profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid);
CREATE TRIGGER health_context_immutable BEFORE UPDATE OR DELETE ON health_verified_context FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TRIGGER health_context_immutable_truncate BEFORE TRUNCATE ON health_verified_context FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation();
