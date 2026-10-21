CREATE TABLE platform_private_objects (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  request_key uuid NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length>0 AND byte_length<=5242880),
  purpose text NOT NULL DEFAULT 'foundation_fixture' CHECK (purpose='foundation_fixture'),
  media_type text NOT NULL DEFAULT 'application/octet-stream' CHECK (media_type='application/octet-stream'),
  scan_state text NOT NULL DEFAULT 'not_scanned' CHECK (scan_state='not_scanned'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,id),
  UNIQUE(profile_id,id,actor_id),
  UNIQUE(profile_id,actor_id,request_key)
);
CREATE TABLE platform_outbox (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  object_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type='platform.private_object.stored.v1'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version=1),
  trace_id uuid NOT NULL,
  causation_id uuid,
  idempotency_key uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  UNIQUE(profile_id,actor_id,idempotency_key),
  UNIQUE(profile_id,object_id,id),
  UNIQUE(profile_id,object_id,id,actor_id),
  FOREIGN KEY(profile_id,object_id,actor_id) REFERENCES platform_private_objects(profile_id,id,actor_id)
);
CREATE INDEX platform_outbox_pending ON platform_outbox(occurred_at) WHERE dispatched_at IS NULL;
CREATE TABLE platform_jobs (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  object_id uuid NOT NULL,
  event_id uuid NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind='private_object.receipt.v1'),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text CHECK (last_error_code IN ('ACCESS_REVOKED','OBJECT_UNAVAILABLE','INTEGRITY_FAILURE','RETRYABLE_FAILURE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(profile_id,object_id,id),
  FOREIGN KEY(profile_id,object_id,event_id,actor_id) REFERENCES platform_outbox(profile_id,object_id,id,actor_id),
  CHECK ((state='running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (state<>'running' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX platform_jobs_claim ON platform_jobs(available_at,created_at) WHERE state IN ('queued','running');
CREATE TABLE platform_job_receipts (
  job_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL,
  object_id uuid NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(profile_id,object_id,job_id) REFERENCES platform_jobs(profile_id,object_id,id)
);
CREATE FUNCTION platform_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Platform evidence is immutable'; END;
$$;
CREATE TRIGGER immutable_private_object BEFORE UPDATE OR DELETE ON platform_private_objects FOR EACH ROW EXECUTE FUNCTION platform_reject_mutation();
CREATE TRIGGER immutable_job_receipt BEFORE UPDATE OR DELETE ON platform_job_receipts FOR EACH ROW EXECUTE FUNCTION platform_reject_mutation();
CREATE TRIGGER immutable_private_object_truncate BEFORE TRUNCATE ON platform_private_objects FOR EACH STATEMENT EXECUTE FUNCTION platform_reject_mutation();
CREATE TRIGGER immutable_job_receipt_truncate BEFORE TRUNCATE ON platform_job_receipts FOR EACH STATEMENT EXECUTE FUNCTION platform_reject_mutation();
CREATE TRIGGER immutable_outbox_delete BEFORE DELETE ON platform_outbox FOR EACH ROW EXECUTE FUNCTION platform_reject_mutation();
CREATE TRIGGER immutable_outbox_truncate BEFORE TRUNCATE ON platform_outbox FOR EACH STATEMENT EXECUTE FUNCTION platform_reject_mutation();
CREATE FUNCTION platform_guard_outbox_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-'dispatched_at') IS DISTINCT FROM (to_jsonb(OLD)-'dispatched_at') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Outbox event content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_outbox_content BEFORE UPDATE ON platform_outbox FOR EACH ROW EXECUTE FUNCTION platform_guard_outbox_update();
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['platform_private_objects','platform_outbox','platform_jobs','platform_job_receipts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY profile_isolation ON %I USING (profile_id = nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid) WITH CHECK (profile_id = nullif(current_setting(''biovitai.profile_id'',true),'''')::uuid)',table_name);
  END LOOP;
END;
$$;
