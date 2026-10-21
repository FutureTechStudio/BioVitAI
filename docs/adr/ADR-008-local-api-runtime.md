# ADR-008: Local API and PostgreSQL foundation

Status: Implemented local development decision, 20 October 2026. Task: BV-005. Requirements: 19, 47, 49, 50, 59.

Use the Node HTTP transport for the first operational endpoints, with status behavior behind a typed application service and a DatabaseProbe port. This keeps the foundation small; no new web/API framework is selected by this slice. The composition root wires configuration, database, application service and HTTP adapter. The boundary checker permits the node:http import only in the transport adapter; it still rejects provider imports outside Gateway infrastructure.

Use node-postgres with bounded pool, acquisition and query timeouts. Runtime configuration permits loopback hosts, synthetic data and development/test environments only. Plain local database transport is restricted to that loopback configuration. Remote UAT needs a distinct reviewed configuration with TLS, secret management and least-privilege roles. Do not add DATABASE_URL parsing that can silently override transport settings.

Provide two local database paths: Compose with a private password-file secret and loopback published port, or pinned native development/test binaries without Docker. These have separate storage directories and PostgreSQL major versions; they do not migrate one another. Native binaries are development dependencies only. Setup generates random ignored credentials, preserving existing settings and volumes. The developer cluster owner is not a production application role.

The native launcher initializes with the embedded-postgres helper but starts/stops with pg_ctl. On Windows, a detached server can inherit pipe handles; wait for pg_ctl's exit with ignored stdio rather than waiting for inherited pipe closure. Put the development log outside PGDATA to avoid Windows file-sharing interference during recovery. Explicit stop is available when terminal interruption bypasses asynchronous cleanup. This behavior is covered by the real PostgreSQL integration test and manual start/stop/restart checks.

No clinical schema, identity/session implementation, patient-data ingestion or external AI processing is enabled. The next database migrations belong to their P1 tasks after the amended development gate and dependencies clear.

References: [node-postgres configuration](https://node-postgres.com/features/connecting), [TLS configuration caveats](https://node-postgres.com/features/ssl), [PostgreSQL pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html), [native development helper](https://github.com/leinelissen/embedded-postgres).
