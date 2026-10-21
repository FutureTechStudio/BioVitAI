# ADR-011: Immutable, profile-bound health evidence

Status: Implemented for local synthetic development; BV-010 In Review. Date: 20 October 2026.

Preserve original document/page/field evidence separately from interpreted source observations, groups and derived outputs. Every clinical reference uses composite profile foreign keys. Exact decimals remain strings at the TypeScript boundary and NUMERIC in PostgreSQL; comparators, qualitative results, missingness and date precision are explicit. Profile IDs remain independent of manager login/contact changes.

Use append-only rows for corrections, identity review and verification. Effective views resolve supersession/quarantine/current verification and stale derived lineage. Verified actions bind to the current identity review. Require reviewed-rule metadata and explicit, sealed inputs before storing a derived result. Ship no clinical rule seeds or calculation implementation.

Serialize health writes with a separate per-profile advisory lock; allocate audit sequence order after locking. Use transaction-local row policies and invoker views as defense in depth, with actual non-bypass-role tests. Existing Identity policy remains the required application authorization boundary; local superuser development connections are not proof of production isolation.

Choose explicit SQL migrations and Zod contracts without installing an ORM or creating unused service endpoints. Storage/ingestion, rule lifecycle, event-driven cache invalidation and full clinical comparability belong to later slices. See [schema and validation details](../engineering/HEALTH-SCHEMA.md).
