# ADR-012: Local private storage and PostgreSQL jobs

Status: Implemented for local synthetic development; BV-011 In Review. Date: 20 October 2026.

Use a port-backed local encrypted object provider and PostgreSQL outbox/job adapters within the existing modular monolith. Avoid a broker/cloud dependency for the first local pilot. Store opaque IDs in events and bind downloads to both an authenticated session and current profile policy. Keep signing and encryption key domains separate; hosted key management remains future configuration.

Share one infrastructure transaction/client across authorization, object metadata, outbox and handler receipt operations. Bind a single profile with transaction-local context. Use a non-key profile row lock so related foreign-key inserts remain compatible while revocation serializes. Compensate known file/DB rollback with targeted cleanup, preserving files when commit outcome is uncertain.

Demonstrate durable retries/replays with a bounded private-object receipt handler rather than pretending an OCR/scanning pipeline exists. Claims have expiring fenced leases; event/job/receipt uniqueness protects the transactional effect. Recheck verified account and explicit profile rights on every attempt. No external exactly-once delivery or clinical processing is claimed.

See [implementation, validation and operational limits](../engineering/STORAGE-JOBS.md).
