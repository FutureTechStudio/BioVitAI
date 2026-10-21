# Canonical health evidence schema

BV-010, local synthetic-data implementation, 20 October 2026. Migration `0004_health_evidence.sql` is additive to the existing identity/profile/context schema. It introduces evidence storage and typed contracts, with no clinical rules seeded, no report upload endpoint and no clinical calculations. Original requirements 05, 06, 07, 40, 49 and 56 inform this model.

## Stored evidence

| Layer                 | Tables                                                                                                                | Meaning                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original document     | `health_source_documents`, `health_diagnostic_reports`, `health_report_pages`                                         | Profile-specific opaque storage reference, SHA-256, media type/size/page count, report/facility/subject metadata, issue date and upload time         |
| Raw extraction        | `health_raw_fields`, `health_extraction_candidates`                                                                   | Immutable text, normalized page rectangle, extractor/parser versions, confidence and candidate interpretation                                        |
| Identity and specimen | `health_report_identity_actions`, `health_specimens`                                                                  | Append-only identity review/quarantine and original specimen/method/date evidence                                                                    |
| Source results        | `health_source_observations`, `health_verification_actions`                                                           | Original name/value/unit/range, parsed value and comparator, specimen/method/time, field references, correction chain and human verification history |
| Grouping              | `health_observation_groups`, `health_group_members`                                                                   | Panel/repeat/rerun/episode/reprint relationships; no numeric pooling                                                                                 |
| Derived evidence      | `health_rule_versions`, `health_aggregation_decisions`, `health_aggregation_inputs`, `health_aggregated_observations` | Versioned rule reference, reason, included/excluded input IDs, sealed lineage and separate derived value                                             |

Source, group and derived IDs remain distinct. Similar labels never imply equivalent analytes. Device readings, comparability cohorts, computed trends, clinical mapping catalogues and clinical rule evaluation are later work; lab results do not silently become device records or organ scores.

## Source fidelity and corrections

Clinical numbers use unbounded PostgreSQL NUMERIC with non-finite values rejected. TypeScript contracts transport decimal strings, preserving precision beyond JavaScript numbers. `<5` is stored as raw text `<5`, parsed threshold `5` and comparator `<`; the threshold is not treated as an exact measurement. Qualitative results and missingness have separate representations and cannot carry a numeric zero as a substitute.

Reference bounds/text/context, raw unit, specimen and method are kept separately from optional normalization. A canonical value requires its exact reviewed normalization rule version; raw evidence is retained. The schema checks rule metadata/purpose, not execution of a clinical protocol. No normalization or aggregation algorithm is enabled by this migration.

Upload time, report issue date, specimen collection, observed date, result date and verification time remain separate. Unknown time stays unknown. Date-only fields use DATE, never fabricated midnight instants. The pool preserves DATE as `YYYY-MM-DD` strings with a pool-local type parser; other PostgreSQL parsers remain unchanged. Exact instants use timestamptz with the reported timezone recorded separately where known. Known collection/observation/result times require raw field references. Full original source text remains available for ambiguous dates.

Composite foreign keys bind each page/field/specimen/candidate/result/group/input to the same profile and, where relevant, the same report/document. Even two profiles managed by the same account cannot borrow each other's evidence. Name and value fields are mandatory references; unit, range, method and known times require their corresponding references. Page numbers must fit the declared source document.

Evidence tables reject UPDATE, DELETE and TRUNCATE. Corrections append a new source ID with predecessor, next sequential revision and reason. One predecessor cannot branch into multiple successors. Originals, parser output and earlier verification records remain intact. This is an application/database immutability safeguard, not protection against a privileged database administrator disabling triggers. Retention/deletion procedures must later use a controlled audited workflow rather than silently rewriting evidence.

## Effective verification and lineage

New results are `identity_pending`; a matched report identity is required before recording verification. Quarantine blocks effective verification. Verification binds to the exact latest identity-action sequence; changing identity review makes an earlier verification require review again, even if the new identity decision is also matched. Verifications do not become valid again merely because identity quarantine was removed. No public HTTP route currently records these actions; the later verification workflow must authorize actors and capture its review basis.

`health_effective_source_observations` resolves current verification without mutating source rows. A correction supersedes its predecessor and starts unverified. `health_effective_aggregated_observations` reports stale lineage when an included source is superseded, unverified, rejected or quarantined. Previously stored derived values remain available as historical records. Querying the raw derived table alone does not establish that an output is current or safe to display.

Publishing a derived row requires an aggregation rule version with approval metadata, at least one included input, and current verified lineage. A `no_calculation` decision cannot publish a result. Both included and excluded inputs have reasons and must be actual members of the referenced group. Once an output exists, that decision's input set is sealed. Changing inputs means creating a new decision/output revision. Rule metadata does not establish real human approval by itself; no approved clinical rules are shipped. Fixtures labeled `SYNTHETIC_ONLY` exist only in isolated tests.

All health inserts take a transaction-level per-profile advisory lock. This serializes corrections, identity changes, verification, lineage sealing and publication. Review sequences are assigned after obtaining that lock, preventing caller-supplied ordering or pre-lock sequence allocation from restoring stale state. A concurrency test holds an uncommitted correction while another connection attempts derivation; publication is rejected after the correction commits. The health lock is separate from the Identity authorization row lock. BV-011 added a shared infrastructure transaction/client for nested persistence and changed the authorization lock to FOR NO KEY UPDATE so foreign-key inserts remain compatible while revocation serializes. Future health repositories should join that unit of work.

## Isolation and integration boundary

Every private health table has enabled/forced row-level security keyed to transaction-local `biovitai.profile_id`. Both effective views use invoker security. A restricted test role without ownership, superuser or BYPASSRLS privileges sees no rows without context, only the selected profile with context, and cannot write to another profile. The setting is transaction-local and does not survive connection reuse.

RLS is additional isolation, not authorization: a database client able to set context is trusted infrastructure. Future request handlers must derive the actor from the real session and wrap user-facing reads/writes in `ProfilePolicy.withActiveAccess`, with explicit profile predicates and current scopes/consent. Workers use explicit-profile policy, not UI selection. The current local runtime owns its synthetic database and bypasses RLS; real non-owner runtime roles, hosting configuration and storage controls remain deployment work. No health repository or endpoint bypassing those checks is added by this slice.

Object references and checksums are schema metadata. Actual durable originals, byte/hash/MIME validation, scanning, private object access, signed links, outbox/jobs and pipeline status are BV-011/P2 work. Cache invalidation delivery is not claimed: the current views invalidate dynamically; future stored caches/trends/AI contexts need the event/job integration. Clinical retention, rule lifecycle/revocation and independent protocol review also remain separate work.

## Validation and status

Run `npm run check` and `npm run test:db` on Node 22. The health suite uses actual PostgreSQL with synthetic fixtures. It checks upgrade preservation/idempotence, raw round-trips, exact decimals, censored/missing/qualitative values, date precision, immutable originals, identity-bound verification, cross-profile/report/page foreign keys, correction history, reviewed-rule metadata, sealed lineage, concurrent correction/publication and restricted-role RLS/invoker views.

Apply `npm run db:migrate` against the running local database. Readiness now verifies the source/effective-view schema. BV-010 remains In Review with engineering evidence, rather than claiming clinical or production acceptance. Next: BV-011, private object storage and asynchronous job/outbox foundation; the app shell/profile picker remains BV-012.
