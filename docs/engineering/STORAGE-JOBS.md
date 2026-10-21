# Private object storage and durable jobs

BV-011 local synthetic-data foundation, 20 October 2026. Migration `0005_storage_jobs.sql` adds private object metadata, outbox events, leased jobs and immutable completion receipts. The API exposes authenticated signed downloads and job status. `npm run jobs:once` dispatches pending outbox rows and processes one job, then exits.

This slice supplies infrastructure for report ingestion. It does not add a public upload endpoint, malware scanner, MIME/content validation, OCR or a real report-processing handler. The only registered purpose is `foundation_fixture`; metadata explicitly remains `not_scanned`, and downloads use `application/octet-stream` with attachment disposition. Internal `registerSynthetic` and isolated synthetic integration fixtures exercise the real storage/queue path without claiming a clean or verified medical document. P2 ingestion must add its own validated quarantine/release workflow before admitting report uploads.

## Private storage and access

The local provider writes to ignored `.local/private-objects/<opaque-uuid>.bin`, never a user filename or public static directory. Writes use exclusive creation and fsync, with a 5 MiB foundation limit. AES-256-GCM encrypts each object with a fresh nonce; authenticated additional data binds the object and profile IDs. Reads verify authentication, byte count and SHA-256 before returning bytes. Swapped, corrupted or mismatched files fail closed. The metadata table is immutable and tied to a profile, registering account and request key.

Encryption and ticket-signing keys are derived from the stable random AUTH_SECRET with separate domain labels. This is local development key management; changing that secret without preserving the old encryption key makes existing objects unreadable. A hosted provider needs a separate versioned keyring/KMS, controlled rotation, private object ACLs, backup/restore and retention policies. POSIX modes are requested on files/directories; Windows uses inherited filesystem ACLs. No real-patient deployment or cloud object-store integration is claimed.

`POST /v1/storage/links` accepts `{objectId,context:{profileId,revision}}`. It requires a verified login, exact configured Origin, JSON and current active-profile health/read/care permission. It returns `{url,expiresAt}`. Tickets are HMAC-authenticated, expire after 60 seconds and bind object, actor, login session, selected profile and context revision. They are not standalone bearer access: redemption again resolves the current authenticated actor and current profile/grants/consent policy. Another session/account, profile switch (including switching away and back), expiry or revoked access blocks redemption.

`GET /v1/storage/objects/:id?ticket=...` returns attachment-only bytes with no-store, nosniff and the API's restrictive CSP. There is no filesystem route, raw object key, arbitrary path or public download. Ticket URLs must not be logged or included in analytics. Existing global HTTP JSON requests retain the 16 KiB body limit. Object registration is internal; this API does not accept file bytes.

`GET /v1/storage/jobs/:id?profileId=...&revision=...` returns only ID, state, attempt limits, safe error code and completion time after the same current active-profile read check. Lease tokens, paths, exception text, event payloads and bytes are excluded.

## Atomic registration and authorization

An infrastructure-only async transaction context shares the current PostgreSQL client between Identity policy and nested storage/job adapters; the composition root supplies the same pool to them. The unit of work binds one profile through transaction-local `biovitai.profile_id`; attempts to mix profiles fail. Nested adapters do not commit independently, and a nested failure marks the whole transaction for rollback. This keeps the profile authorization audit, object metadata and outbox event atomic, while avoiding nested-pool starvation.

Profile authorization uses `FOR NO KEY UPDATE`: concurrent policy/revocation operations still serialize, while foreign-key checks can reference that profile. Session/context locking and current scope checks continue to apply. The existing negative revocation tests remain part of regression validation.

Encrypted file creation precedes the database transaction's final commit. A known rollback removes only the newly created unreferenced file. Reconciliation checks whether metadata exists before deletion, so a lost commit acknowledgement cannot delete a committed object's bytes. If commit state cannot be determined, the private file is preserved and the operation reports reconciliation failure. A process/power failure can also leave an inaccessible orphan. A durable orphan reconciler and storage backup/restore are future work; files and PostgreSQL are not one atomic filesystem transaction.

Registration uses a UUID request key scoped to profile/account. An identical replay returns the same object; different bytes with that key return an idempotency conflict. Metadata and the minimal outbox reference commit together. Events carry IDs, schema version, time, trace ID, optional causation ID and idempotency key, with no raw health/chat/file payload. Object/profile/actor foreign keys prevent mixed-profile or actor-spoofed event references. Outbox content is immutable apart from dispatch bookkeeping.

## Durable dispatch, retries and fencing

The internal dispatcher selects outbox rows with `FOR UPDATE SKIP LOCKED`, creates one job per event and marks dispatch in the same transaction. Replays cannot create another job or reset a completed job. There is no external broker/publisher yet; external delivery would require its own at-least-once protocol using the same event IDs.

Claims use row locks/skip-locked, a fresh lease token, a 30-second lease, an incremented attempt count and a default maximum of three attempts. Expired leases can be reclaimed. Completing or failing an attempt requires its current unexpired token, so an old worker cannot overwrite a newer claim. Transient errors back off exponentially (bounded at 60 seconds); exhausted attempts fail. Access revocation cancels the job, and integrity failures terminate it. Stored error codes are allowlisted; exception strings and medical payloads are not persisted or logged.

The demo handler fetches the registering account's current verified state, rechecks explicit-profile health/read permission through `withAccess`, decrypts/verifies the stored object, then writes one immutable receipt and completes the job within the authorization transaction. It does not borrow a browser's currently selected profile or record a report verification. Account/session selection cannot retarget a queued job. Revoked membership or an unverified account cancels the attempt before reading bytes.

The receipt primary key makes this handler's transactional database effect replay-safe. Delivery/execution remains at least once; this is not a general exactly-once guarantee for future emails, OCR providers or other external side effects. Longer handlers require heartbeat/cancellation and provider-specific idempotency before adoption. The worker command is a bounded local run, not an installed background service or scheduler.

## Isolation, validation and remaining scope

Private platform tables have enabled/forced row-level security. Profile-scoped metadata adapters set context locally and keep explicit profile predicates. A restricted fixture role verifies isolation and rejected cross-profile writes. Local development still uses the synthetic database owner; production application/dispatcher roles and their policies need deployment configuration. Database context is additional isolation, not a substitute for the Identity policy boundary.

Tests cover ciphertext/write-once behavior, secret/ticket tampering and expiry, signed HTTP access across profiles/sessions, file corruption/swap/digest mismatch, idempotent registration, rollback compensation, authorization-audit atomicity, concurrent protected calls, mixed transaction profiles, concurrent outbox/worker delivery, replay, job-status isolation, lease reclamation/fencing, backoff/exhaustion, revocation, verified-account changes and database foreign keys/RLS. All fixtures are synthetic; no external messages or providers are called.

Run `npm run check` and `npm run test:db`. Start the local database/API, apply `npm run db:migrate`, and run `npm run jobs:once`. With no queued fixtures the worker reports `idle`. Readiness checks the required object/outbox/job/receipt tables; it is not a full storage integrity or backup drill. BV-011 remains In Review with local engineering evidence. Next: BV-012, the actual app shell, authentication screens and visible profile picker.
