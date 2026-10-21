-- Preserve independently verified context without inventing missing metadata.
ALTER TABLE health_verified_context
 ALTER COLUMN concept_system DROP NOT NULL,
 ALTER COLUMN concept_code DROP NOT NULL,
 ALTER COLUMN specimen DROP NOT NULL,
 ALTER COLUMN method DROP NOT NULL,
 ALTER COLUMN observed_date DROP NOT NULL;
