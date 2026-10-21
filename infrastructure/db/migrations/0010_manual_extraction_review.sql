CREATE TABLE health_manual_candidate_actions(profile_id uuid NOT NULL,report_id uuid NOT NULL,candidate_id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES identity_user(id),reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(profile_id,report_id,candidate_id) REFERENCES health_extraction_candidates(profile_id,report_id,id));
ALTER TABLE health_manual_candidate_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_manual_candidate_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY health_manual_profile ON health_manual_candidate_actions USING(profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid) WITH CHECK(profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid);
CREATE TRIGGER health_manual_immutable BEFORE UPDATE OR DELETE ON health_manual_candidate_actions FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TRIGGER health_manual_no_truncate BEFORE TRUNCATE ON health_manual_candidate_actions FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation();
