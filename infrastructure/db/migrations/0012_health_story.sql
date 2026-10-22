-- Reported context is separate from laboratory evidence and clinical assessment.
CREATE TABLE health_story_versions (
 id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES identity_profile(id),
 record_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 previous_version_id uuid, actor_id uuid NOT NULL REFERENCES identity_user(id),
 request_key uuid NOT NULL, fingerprint text NOT NULL CHECK(length(fingerprint)=64),
 ciphertext bytea NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(profile_id,id), UNIQUE(profile_id,record_id,revision), UNIQUE(profile_id,request_key),
 UNIQUE(profile_id,previous_version_id),
 FOREIGN KEY(profile_id,previous_version_id) REFERENCES health_story_versions(profile_id,id),
 CHECK((revision=1 AND previous_version_id IS NULL) OR (revision>1 AND previous_version_id IS NOT NULL))
);
CREATE INDEX health_story_latest ON health_story_versions(profile_id,record_id,revision DESC);
CREATE TABLE health_story_reviews (
 sequence bigserial PRIMARY KEY, profile_id uuid NOT NULL REFERENCES identity_profile(id),
 actor_id uuid NOT NULL REFERENCES identity_user(id), request_key uuid NOT NULL,
 snapshot text NOT NULL CHECK(length(snapshot)=64), ciphertext bytea NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(profile_id,actor_id,request_key)
);
CREATE INDEX health_story_review_latest ON health_story_reviews(profile_id,actor_id,sequence DESC);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['health_story_versions','health_story_reviews'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY profile_isolation ON %I USING(profile_id=nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid) WITH CHECK(profile_id=nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid)',t);
  EXECUTE format('CREATE TRIGGER immutable_story BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION health_reject_mutation()',t);
  EXECUTE format('CREATE TRIGGER immutable_story_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation()',t);
 END LOOP;
END $$;
CREATE FUNCTION health_story_validate_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.previous_version_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM health_story_versions p WHERE p.profile_id=NEW.profile_id AND p.id=NEW.previous_version_id
   AND p.record_id=NEW.record_id AND p.revision=NEW.revision-1
 ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid story revision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_story_revision BEFORE INSERT ON health_story_versions FOR EACH ROW EXECUTE FUNCTION health_story_validate_revision();
