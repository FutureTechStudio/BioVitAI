CREATE TABLE identity_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES identity_user(id),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity_consent (
  sequence bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  purpose text NOT NULL CHECK (purpose IN ('family_sharing','health_ai','wellness_ai','health_to_wellness','connectors','notifications')),
  notice_version text NOT NULL CHECK (notice_version = 'pilot-v1'),
  granted boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_consent_latest ON identity_consent(profile_id, purpose, sequence DESC);
CREATE TABLE identity_profile_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer','caregiver')),
  scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  grant_expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity_profile_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES identity_profile_invitation(id),
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  account_id uuid NOT NULL REFERENCES identity_user(id),
  role text NOT NULL CHECK (role IN ('viewer','caregiver')),
  scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_profile_grant_account ON identity_profile_grant(account_id, profile_id);
CREATE TABLE identity_profile_audit (
  sequence bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES identity_profile(id),
  actor_id uuid NOT NULL REFERENCES identity_user(id),
  event text NOT NULL,
  resource_id uuid,
  purpose text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
