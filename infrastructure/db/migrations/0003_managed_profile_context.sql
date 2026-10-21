ALTER TABLE identity_profile ADD COLUMN kind text NOT NULL DEFAULT 'self' CHECK (kind IN ('self','family'));
ALTER TABLE identity_profile ADD COLUMN contact_email text;
ALTER TABLE identity_profile DROP CONSTRAINT identity_profile_owner_id_key;
CREATE UNIQUE INDEX identity_profile_one_self ON identity_profile(owner_id) WHERE kind='self';
CREATE INDEX identity_profile_manager ON identity_profile(owner_id);

CREATE TABLE identity_profile_context (
  session_id uuid PRIMARY KEY REFERENCES identity_session(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES identity_profile(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  changed_at timestamptz NOT NULL DEFAULT now()
);
