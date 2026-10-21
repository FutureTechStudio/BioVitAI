# P0 continuation 02 — local runtime

Date: 20 October 2026. Engineering evidence: BV-002 and BV-005. No P1 domain implementation started.

## Result

A runnable local API now connects to real PostgreSQL. It serves process liveness and database readiness, returns 503 on dependency failure/deadline, uses server-generated request IDs, suppresses raw connection errors and returns no private configuration. The readiness probe recovers when PostgreSQL returns. Local configuration rejects non-loopback hosts, patient data mode and production mode.

The native development runner works without Docker and stores its files under ignored .local/native-postgres. Random credentials and generated settings are ignored and preserved on repeated setup. A Compose alternative binds PostgreSQL to loopback and uses a password-file secret. Docker Desktop could not start on this host; Compose configuration validation passed, but the container path was not run. The stalled Docker startup helper was stopped.

The owner's existing scope/stack confirmations are now reconciled into approvals.json as owner approvals, with a recording timestamp and OWNER-DECISIONS.md evidence. Specialist approval entries remain Pending and explicitly deferred for development. ADR-001 reflects accepted owner direction without claiming independent specialist signoff.

## Changed files

- apps/api/src/main.ts and application/status.ts: composition root and application status behavior.
- infrastructure/config/runtime.ts, db/postgres.ts and http/server.ts: typed configuration, real PostgreSQL adapter and HTTP transport.
- shared/contracts/src/runtime.ts: dependency probe and status service contracts.
- tools/setup-local.mjs, dev-local.mjs and stop-native-postgres.mjs: idempotent secret generation, native local startup and clean pg_ctl stop.
- compose.yaml: persistent local PostgreSQL alternative.
- tests/runtime.test.mjs and tests/integration/postgres.test.mjs: HTTP/configuration/deadline and real database checks.
- package.json/package-lock.json, ESLint and boundary configuration, CI: pinned dependencies, commands, permitted transport import and integration execution.
- README.md, docs/engineering/LOCAL-DEVELOPMENT.md and ADR-008: startup, limitations, environment isolation and lifecycle rationale.
- approvals.json, ADR-001 and phase-gate fixtures: owner decision reconciliation while keeping test fixtures independent of actual approvals.
- Tracker CSV/JSON/XLSX, decision CSV/workbook and status history: current evidence; originals retained before mutation.

## Validation

- npm run check: format, lint, boundaries, phase guard, types, build and 20 tests pass.
- npm run test:db: one real PostgreSQL integration test passes; valid credentials succeed, wrong credentials fail, shutdown yields unavailable. The test exercises the same pg_ctl lifecycle helper used locally and cleans only its verified generated UUID directory.
- The checks and database integration pass under Node 22.23.3; local Node 25 checks also passed earlier in this cycle.
- Manual runtime: both health endpoints return 200, then readiness returns 503 after clean database stop and returns 200 after restart.
- setup:local rerun preserves both existing settings and password files; Git ignores them.
- docker compose config --quiet passes. Hosted CI and Docker container execution remain unverified.

Initial validation found missing lint globals and a cleanup guard placed in finally; corrected before rerunning. Windows terminal interruption exposed a native process lifecycle issue. Switching to pg_ctl, waiting on process exit rather than pipe closure, and moving its log outside PGDATA resolved the tested start/stop/restart failure. No data directory was deleted to fix it.

A concurrent integration run also exposed the need for a separate log per cluster. The lifecycle helper now derives that log from the cluster directory, and cleanup attempts to stop a cluster even when startup fails partway through. The final Node 22 database test passed after these corrections.

## Tracker and next work

BV-002 and BV-005 move from Blocked to In Review with owner acceptance/runtime evidence. BV-001 remains In Review; its notes now reflect actual owner scope approval. BV-004 remains Backlog under the reviewer deferral. Other tasks retain their states and dependencies. No task is marked Done merely from generated files; engineering review/evidence reconciliation remains before the development phase transition.

Identity/authentication and family authorization remain the next P1 slice once that transition is recorded. No authentication, clinical interpretation or AI-provider capability is claimed by the operational health endpoints. English is the confirmed initial language, UAE/India are target markets, production hosting and minors scope remain unresolved; minor/guardian workflows stay unimplemented.
