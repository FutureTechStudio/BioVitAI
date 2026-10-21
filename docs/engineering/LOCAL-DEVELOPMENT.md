# Local API and PostgreSQL

The local foundation runs real PostgreSQL, liveness/readiness endpoints and the first identity API slice. See IDENTITY-IMPLEMENTATION.md for signup, local verification capture and session controls. Configuration accepts only loopback hosts and synthetic data. Production mode and remote database hosts are rejected; server UAT configuration is a later change.

## Start without Docker

Use Node 22. The first command installs pinned runtime and development dependencies, including native PostgreSQL binaries for the current OS. The native runner is a development convenience, not a production database service.

```sh
npm ci
npm run setup:local
npm run dev:local
```

On first use and after adding migrations, apply them from a second terminal with `npm run db:migrate`. HTTP startup does not implicitly change the schema. Readiness returns 503 until the required identity/profile/context, health evidence and storage/job schemas exist. See [profile permissions and consent](PROFILE-IMPLEMENTATION.md), [health schema](HEALTH-SCHEMA.md) and [storage/jobs](STORAGE-JOBS.md).

With the database running, `npm run jobs:once` processes the foundation receipt job. Report ingestion uses `npm run reports:worker`. Run `npm run setup:reports` for the local Windows scanner and provide Poppler utilities on PATH or via `POPPLER_BIN_DIR`. Missing tools produce an explicit unavailable state. Private files use ignored `.local/private-objects`; preserve the stable auth secret with database/object backups because encryption keys are derived from it.

The API listens on `http://127.0.0.1:3001`; the database listens on `127.0.0.1:54329`. The setup command generates a random password under ignored `.local/` and writes ignored `.env.local`, preserving existing files. Never paste these files into chat or commit them. On Windows the file permissions follow the user's inherited filesystem ACLs; POSIX mode bits are not a substitute for Windows ACL review.

`GET /health/live` reports process liveness. `GET /health/ready` returns 200 only after real queries confirm the required identity/profile tables are accessible; failures and deadlines return 503 without raw connection details. Readiness does not verify migration checksums, authorization behavior or clinical readiness. Request IDs are server-generated. Responses are not cached, and unknown routes return generic errors.

Stop the API with Ctrl+C, then run `npm run db:native:stop` to ensure the native database is stopped. Windows terminal/npm signal propagation can terminate the wrapper before its asynchronous cleanup finishes. The explicit stop command uses PostgreSQL's pg_ctl with a clean shutdown and targets only this workspace's cluster. Native database files persist at `.local/native-postgres`. Do not delete that directory to resolve startup errors; check port conflicts/settings first. The native local role owns its development cluster; a separate least-privilege runtime role is required before any UAT domain schema or sensitive data is introduced.

## Reports, Android and pilot operations

After migrations, run the API, web application and `npm run reports:worker` in separate terminals. Uploads accept PDF, PNG, JPEG, TIFF and WebP up to 20 MiB/50 pages. Use synthetic data only. Identity confirmation and result verification precede publication. Report corrections and withdrawals invalidate derived evidence.

Run `npm run setup:android`, `npm run build:android`, then `npm run dev:mobile`. The debug APK requires Metro. `node tools/start-android-emulator.mjs` and `node tools/install-android-debug.mjs` prepare the emulator, install the APK and forward ports 3001/8081 to host loopback. The native API address remains 127.0.0.1 through `adb reverse`. Generated Android/iOS directories are not edited by hand.

Optional AI needs server-only `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MILLION` and `OPENAI_OUTPUT_USD_PER_MILLION`, plus explicit profile consent. Missing configuration leaves AI unavailable. Reservations enforce US$5 per Asia/Kolkata day across the app.

Run `npm run setup:backup` for Windows PostgreSQL client tools and `npm run pilot:ops` for scrubbed aggregate metrics. Set a separate `BACKUP_PASSPHRASE` with at least 24 characters and run `npm run pilot:backup`. It writes a timestamped encrypted archive under `.local/backups`. Keep that passphrase separate from the archive. Restore only into the isolated fixture described by the backup tool. See [implementation evidence](P2-P5-IMPLEMENTATION.md) and [rehearsal gates](../pilot/REHEARSAL.md).

## Docker alternative

Start Docker Desktop, then:

```sh
npm run setup:local
npm run db:up
npm run dev:api
```

Do not run both database variants at once: they use the same local port. They keep separate data stores. Compose uses PostgreSQL 17.10; the pinned native development/test runner currently supplies PostgreSQL 18.4. Neither variant silently migrates the other's files. Stop Compose with `npm run db:stop`; the named volume remains. Password changes in a file do not rotate credentials in an initialized volume/cluster.

## Validation

Start the web UI in another terminal with `npm run dev:web` and open <http://127.0.0.1:3000>. Use the generated loopback defaults: the web proxy has a fixed API upstream at port 3001. `npm run build:web` and `npm run start:web` provide an optimized local preview. See [web shell and browser checks](WEB-SHELL.md) for captured verification/reset links and `npm run test:web`.

```sh
npm run check
npm run test:db
```

The integration suite creates temporary native PostgreSQL clusters with random credentials and verifies runtime, identity, profiles and the health evidence schema using synthetic fixtures. Health checks include immutable provenance and a restricted database role for row-level isolation. Generated UUID directories are checked before cleanup. CI runs it on Windows/Linux without a Docker dependency. No patient data is used.

Implementation references: [node-postgres configuration](https://node-postgres.com/features/connecting), [node-postgres TLS settings](https://node-postgres.com/features/ssl), [official PostgreSQL container](https://hub.docker.com/_/postgres), [native development runner](https://github.com/leinelissen/embedded-postgres). The local adapter does not configure remote TLS because remote hosts are currently rejected.
