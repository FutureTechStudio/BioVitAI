CREATE TABLE health_report_relationships(
 id uuid PRIMARY KEY,profile_id uuid NOT NULL,report_id uuid NOT NULL,related_report_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('rerun','amendment')),reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000),
 actor_id uuid NOT NULL REFERENCES identity_user(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(report_id<>related_report_id),FOREIGN KEY(profile_id,report_id) REFERENCES health_ingestions(profile_id,id),FOREIGN KEY(profile_id,related_report_id) REFERENCES health_ingestions(profile_id,id)
);
ALTER TABLE health_report_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_report_relationships FORCE ROW LEVEL SECURITY;
CREATE POLICY health_relation_profile ON health_report_relationships USING(profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid) WITH CHECK(profile_id=nullif(current_setting('biovitai.profile_id',true),'')::uuid);
CREATE TRIGGER immutable_relation BEFORE UPDATE OR DELETE ON health_report_relationships FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TRIGGER immutable_relation_truncate BEFORE TRUNCATE ON health_report_relationships FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation();
