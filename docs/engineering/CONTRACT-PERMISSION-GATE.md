# BV-013: contract and permission regression gate

The platform regression suite now runs at three levels: pure contract/client tests, real PostgreSQL/HTTP tests, and isolated Chromium acceptance against the optimized web app. All fixtures are synthetic. This is engineering validation; specialist approval, production readiness and hosted CI results are separate evidence.

## Commands

```sh
npm run check
npm run test:db
npx playwright install chromium
npm run test:web:isolated
npm run test:web:community-off
```

The two isolated browser commands build the backend, create a temporary PostgreSQL cluster, migrate it, start a real API on an available loopback port, copy web/shared source into that fixture, build an optimized Next.js app and start it on another available loopback port. They use fresh secrets and a private temporary email capture directory. Both servers, their pools and the cluster are closed before the UUID fixture directory is removed. Generated web types, build files, screenshots and capture links remain in that fixture and are removed with it. The existing development database, mailbox and running preview are not reused or reset. The private-object adapter receives a separate fixture directory too.

`npm run test:web` remains an explicit manual check against the running default local preview. `BIOVITAI_TEST_ORIGIN` accepts only `http://127.0.0.1:<port>`; the web proxy's test override changes only its numeric loopback port, never its host. Neither command loads `.env.local` into the API test fixture. Browser traces/video are disabled, private callback navigation errors are sanitized, and app-server output is drained without logging callback URLs. Framework build output and the test summary are visible. No email is sent externally.

## Coverage

| Boundary                                      | Evidence                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public account/profile/context response shape | Strict shared response schemas and real HTTP responses; extra contact, session, token and health fields are rejected rather than silently stripped                                                                       |
| Unauthenticated and cross-account access      | HTTP routes deny private metadata and mutations; two separate browser cookie stores cannot read, select or alter another manager's profile; nonexistent and unauthorized profile reads share the same error              |
| Shared viewer permissions                     | A real accepted viewer grant permits its exact read scope while contact updates, consent writes, further invitations and revocation remain owner-only; the owner’s contact value is unchanged after denied writes        |
| Consent and revocation                        | PostgreSQL suite covers purpose separation, AI gating, withdrawal, expiry, replay and protected-operation ordering                                                                                                       |
| Active profile context                        | Session/device isolation, stale revisions, delayed responses, immediate clearing and rejected-selection empty state; URL parameters cannot substitute the selected profile                                               |
| Health evidence                               | Comparator/date fidelity, immutable source fields, correction and verification history, lineage invalidation, concurrent publication and restricted-role RLS                                                             |
| Private storage and jobs                      | Signed context-bound downloads, tampering, authorization/audit/outbox rollback, fenced leases, retries, replay and fresh account/permission checks                                                                       |
| Web lifecycle and feature flag                | Real signup/verification/signin/reset, email-less family creation, contact update, all tabs, assistant reset, persisted selection, mobile overflow and fresh-session reset, repeated with Community enabled and disabled |

The browser's 409-selection case is deliberately intercepted to exercise the UI error branch. Real context races and authorization denials are separately covered through the API and PostgreSQL; the interception is not claimed as server-policy validation.

## CI and scope

`.github/workflows/ci.yml` retains the Node 22 Windows/Linux foundation checks, web build, PostgreSQL suites, dependency audit and source/tracker preservation checks. A separate browser matrix installs Chromium and its OS dependencies, then runs both feature-flag states on Windows/Linux with a 15-minute job bound. Any nonzero test/build/validator exit fails its job. No secret-bearing captures or browser traces are uploaded. Required branch-protection settings and actual hosted runs require a configured remote repository; neither is claimed locally.

BV-009, BV-010 and BV-011 have evidenced local prerequisite acceptance for this owner-authorized continuation, retaining their In Review status. That acceptance cannot make them Done or waive their original formal acceptance criteria. The tracker validator permits only the explicitly listed platform prerequisites and still validates evidence paths, task definitions and dependencies.

Future report-upload, scanning/OCR, AI, wellness and Community services must extend these permission and contract suites as they are implemented. Their clinical behavior is not tested by an empty shell or by the current synthetic storage receipt job.

Validated locally on 21 October 2026 with Node 22: 39 core/contract/client tests, 48 real PostgreSQL/HTTP tests, and two Chromium acceptance tests in each Community flag state. Both isolated runs complete their service shutdown and fixture removal. The optimized builds, lint and TypeScript checks pass. BV-013 is In Review; no formal Done or hosted-CI result is recorded.

References: [Playwright CI](https://playwright.dev/docs/ci), [Playwright browser dependencies](https://playwright.dev/docs/browsers), [Next CLI build/start options](https://nextjs.org/docs/app/api-reference/cli/next).
