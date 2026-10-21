-- Originals stay immutable. Operational ingestion state is separate from clinical evidence.
ALTER TABLE platform_private_objects DROP CONSTRAINT platform_private_objects_byte_length_check;
ALTER TABLE platform_private_objects DROP CONSTRAINT platform_private_objects_purpose_check;
ALTER TABLE platform_private_objects DROP CONSTRAINT platform_private_objects_media_type_check;
ALTER TABLE platform_private_objects ADD CHECK (
  (purpose='foundation_fixture' AND media_type='application/octet-stream' AND byte_length BETWEEN 1 AND 5242880)
  OR (purpose='health_report' AND media_type IN ('application/pdf','image/png','image/jpeg','image/tiff','image/webp') AND byte_length BETWEEN 1 AND 20971520)
);
CREATE TABLE health_ingestions (
  id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES identity_profile(id),
  actor_id uuid NOT NULL REFERENCES identity_user(id), object_id uuid NOT NULL,
  request_key uuid NOT NULL, content_sha256 text NOT NULL, byte_length integer NOT NULL,
  media_type text NOT NULL, file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','review_needed','quarantined','verified','failed','cancelled')),
  stage text NOT NULL DEFAULT 'scan' CHECK (stage IN ('scan','extract','review','complete')),
  scan_state text NOT NULL DEFAULT 'pending' CHECK (scan_state IN ('pending','clean','infected','unavailable')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0), attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_until timestamptz,
  error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id), UNIQUE(profile_id,actor_id,request_key), UNIQUE(profile_id,content_sha256),
  FOREIGN KEY(profile_id,object_id,actor_id) REFERENCES platform_private_objects(profile_id,id,actor_id),
  CHECK ((state='processing')=(lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX health_ingestion_queue ON health_ingestions(available_at) WHERE state IN ('queued','processing');
CREATE TABLE health_ingestion_events (
  id bigserial PRIMARY KEY, profile_id uuid NOT NULL, ingestion_id uuid NOT NULL,
  event_type text NOT NULL, trace_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(profile_id,ingestion_id) REFERENCES health_ingestions(profile_id,id)
);
CREATE TABLE health_page_previews (
  id uuid PRIMARY KEY, profile_id uuid NOT NULL, ingestion_id uuid NOT NULL, page_id uuid NOT NULL,
  page_number integer NOT NULL CHECK (page_number BETWEEN 1 AND 50), content_sha256 text NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length>0), width integer NOT NULL, height integer NOT NULL,
  UNIQUE(profile_id,ingestion_id,page_number),
  FOREIGN KEY(profile_id,ingestion_id) REFERENCES health_ingestions(profile_id,id)
);
CREATE TRIGGER immutable_ingestion_event BEFORE UPDATE OR DELETE ON health_ingestion_events FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TRIGGER immutable_preview BEFORE UPDATE OR DELETE ON health_page_previews FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
CREATE TABLE health_candidate_reviews (
  id bigserial PRIMARY KEY, profile_id uuid NOT NULL, report_id uuid NOT NULL, candidate_id uuid NOT NULL,
  observation_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES identity_user(id), reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(profile_id,report_id,candidate_id) REFERENCES health_extraction_candidates(profile_id,report_id,id),
  FOREIGN KEY(profile_id,report_id,observation_id) REFERENCES health_source_observations(profile_id,report_id,id)
);
CREATE TRIGGER immutable_candidate_review BEFORE UPDATE OR DELETE ON health_candidate_reviews FOR EACH ROW EXECUTE FUNCTION health_reject_mutation();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['health_ingestions','health_ingestion_events','health_page_previews','health_candidate_reviews'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY profile_isolation ON %I USING(profile_id=nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid) WITH CHECK(profile_id=nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid)',t);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION health_reject_mutation()',t);
  END LOOP;
END $$;
