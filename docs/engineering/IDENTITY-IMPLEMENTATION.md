# Local identity slice — BV-008

The API now supports synthetic account signup, verification-gated login, database sessions, password reset, logout and logout-all. It runs entirely against local PostgreSQL. This is the first P1 engineering slice; no health profile, family access or AI consent is automatically created by an account.

## Startup and migrations

```sh
npm ci
npm run setup:local
npm run dev:local
```

In a second terminal on first use:

```sh
npm run db:migrate
```

Setup preserves existing settings and adds a missing AUTH_SECRET without printing it. Existing databases need the migration before readiness becomes healthy. The migration command is repeatable; changing an already-applied SQL file is rejected. Stop/restart instructions remain in LOCAL-DEVELOPMENT.md. An actual external email service is not configured.

## API contract

All JSON POST requests require `Content-Type: application/json` and the exact origin `Origin: http://127.0.0.1:3001`. Use the API origin matching the configured loopback host/port. Requests are limited to 16 KiB; forwarded IP headers are ignored. Retain response cookies for subsequent calls. No session tokens are returned in JSON.

| Method/path                            | Input/behavior                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| POST /api/auth/sign-up/email           | name, email, password (12–128 characters); no automatic session                 |
| POST /api/auth/sign-in/email           | email, password; rejects unverified accounts; sets HttpOnly/SameSite cookie     |
| GET /api/auth/verify-email             | Use the generated verification URL; optional callback must be trusted           |
| POST /api/auth/send-verification-email | email and optional trusted callbackURL                                          |
| GET /v1/me                             | Cookie required; returns verified actor or 401; ignores claimed actor IDs       |
| GET /api/auth/get-session              | Cookie required for an authenticated session; opaque token omitted              |
| POST /api/auth/sign-out                | Current cookie; ends current session and clears cookie                          |
| POST /api/auth/revoke-sessions         | Current cookie; revokes all of this actor's sessions                            |
| POST /api/auth/revoke-session          | Current cookie and owned session token; cannot revoke another account's session |
| POST /api/auth/request-password-reset  | email and trusted redirectTo; generic request response                          |
| GET /api/auth/reset-password/{token}   | Captured reset link; redirects to the trusted reset callback with token         |
| POST /api/auth/reset-password          | token and newPassword; single use and revokes prior sessions                    |

The [web shell](WEB-SHELL.md) now provides signup, sign-in, verification resend, password recovery and reset callback screens at `/auth`. Local capture links return to that trusted loopback web callback. API-only testing can still follow the captured reset URL without auto-following its redirect, then submit its callback token to the POST reset endpoint.

## Local verification capture

Verification/reset messages are JSON files under ignored `.local/auth-mailbox`. Inspect them locally to follow a verification URL or complete an API reset. They contain sensitive test links and must not be committed, pasted into logs or exposed via HTTP. Their filenames are generated UUIDs, not recipient-provided paths. Local filesystem access is trusted for development; this is not genuine email delivery or production proof of mailbox control.

Browser session cookies are scoped to the biovitai prefix. Cookie caching is off; each protected actor read checks PostgreSQL, so expired/revoked cookies stop working immediately. The HTTP origin check blocks cross-origin writes. Login is limited to ten requests/minute per socket-derived address, signup and reset requests to five/minute; other provider routes have a bounded default rate. Dedicated tests verify that spoofed forwarding headers do not change the limiter identity.

## Evidence and scope

`npm run check` covers typed contracts, boundaries, phase-gate handling and HTTP foundation tests. `npm run test:db` exercises real PostgreSQL and actual HTTP signup, duplicate email handling, unverified rejection, verification, fresh signin cookies, persistent session resolution, tampering, cross-account revoke isolation, logout, logout-all, expiry, redirect/origin rejection, payload caps, password reset, rate limiting, migration idempotence, checksum drift and transaction rollback. Tests use temporary synthetic databases and in-memory email capture; they do not send messages.

Local engineering acceptance is recorded in docs/p0/DEVELOPMENT-ACCEPTANCE.md. P0 tasks remain In Review, BV-004 remains Backlog, and full specialist review remains deferred. BV-008 moves to In Review only after these checks pass; no task is marked Done without its remaining acceptance/review evidence. Hosted CI, external mail delivery, remote UAT and production are not validated by this slice. Family/profile authorization and purpose-specific consent belong to BV-009, the next slice.

Initial integration testing caught empty JSON-content-type redirects being parsed as JSON in the adapter, which turned successful verification into an HTTP 500. The adapter now preserves empty redirects. Subsequent login/revocation tests pass through the real transport.
