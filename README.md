# BiovitAI

Local modular-monolith foundation with PostgreSQL, verified-email authentication, separate self-owned profiles, invitation-based family permissions, consent records and audit. See [identity setup](docs/engineering/IDENTITY-IMPLEMENTATION.md) and [profile/consent API](docs/engineering/PROFILE-IMPLEMENTATION.md).

Managed family profiles work without email, with optional contact updates and later verified invitations. The Next.js web application and Expo Android application include authentication, three tabs and a family picker that resets private views on switching.

The [P2–P5 implementation evidence](docs/engineering/P2-P5-IMPLEMENTATION.md) covers encrypted report upload, local scanning/OCR, identity review, corrections, conservative trends/comparisons, authorized AI conversations and pilot backup/restore. No unreviewed clinical conversions, interpretation rules or organ scores are enabled. The [rehearsal register](docs/pilot/REHEARSAL.md) separates passing checks from remaining native, dependency, provider and human approval gates.

[Private storage and jobs](docs/engineering/STORAGE-JOBS.md) provide encrypted local objects, authenticated expiring download tickets and durable jobs. Run `npm run setup:reports` to provision the local scanner, then `npm run reports:worker` alongside the API for report ingestion. PDF processing also requires Poppler utilities on PATH or `POPPLER_BIN_DIR`.

The owner has [deferred specialist reviewer signoffs](docs/p0/REVIEW-DEFERRAL.md) to the backlog for pilot/UAT development. The development gate now uses that explicit amendment; full specialist review remains a separate gate. Core engineering acceptance checks still apply.

[Confirmed owner decisions](docs/p0/OWNER-DECISIONS.md): three-tab scope and proposed technology direction accepted; target UAE and India; local PostgreSQL; English initially. Minors scope and specialist reviews remain unresolved. These choices supersede earlier proposals in the review packet.

The authoritative baseline is [documentation v2.1](documentation/BiovitAI-Documentation-v2.1/README.md). Its original requirements and archives are preserved.

The current web presentation and executed checks are recorded in the [BioFlow refinement record](documentation/design-system/BIOFLOW-REFINEMENTS-2026-10-22.md), including avatar profile controls, the floating session-aware assistant and distinct tab layouts.

## Local checks

Use Node 22 LTS and npm. Local checks have passed on Node 22 and Node 25; CI is configured for Windows and Linux. Run:

```sh
npm ci
npm run check
npm run test:db
npx playwright install chromium
npm run test:web:isolated
npm run test:web:community-off
python documentation/BiovitAI-Documentation-v2.1/tools/validate_package.py
```

Start locally with `npm run setup:local` followed by `npm run dev:local`. Apply `npm run db:migrate` from a second terminal on first use and when new migrations are added. The API exposes auth routes, `/v1/me`, `/v1/profiles`, `/health/live` and `/health/ready` at port 3001; native PostgreSQL runs on port 54329. Verification/reset emails and profile invitations are private local capture files, not external deliveries. See [startup and shutdown](docs/engineering/LOCAL-DEVELOPMENT.md). Docker Compose is also provided. Tests use synthetic data only; never add patient records or credentials to source control.

The [local P0 engineering acceptance](docs/p0/DEVELOPMENT-ACCEPTANCE.md) opens the development gate for P1 while the source tasks remain In Review and specialist appointments remain deferred. `npm run gate:p0` checks development prerequisites; `npm run gate:p0:full` retains the full review gate. Approval records live in `docs/p0/approvals.json`; only actual reviewer evidence should populate them. The checker validates recorded fields, not the authenticity of a human signoff.

The [foundation P0 closeout](docs/p0/FOUNDATION-CLOSEOUT.md) reconciles BV-001–BV-007 against current implementation and clean-install evidence. Local foundation engineering is complete within the owner-approved scope; formal review and the deferred reviewer appointment remain separately tracked.

The [contract and permission gate](docs/engineering/CONTRACT-PERMISSION-GATE.md) includes isolated browser checks with Community on/off. These use temporary databases, private capture directories and separate web builds, so the running development preview stays available. CI is configured for both Windows and Linux; hosted execution and branch protection are not yet verified.

## Proposed topology

`apps/api` contains the API; `apps/web` and `apps/mobile` contain separate web/native rendering. Domain modules own application services, public contracts and repository adapters. `shared/contracts` contains schemas and runtime ports. Infrastructure supplies database, HTTP, encrypted storage, scanning/OCR, tracing and the server-only AI provider adapter.

TypeScript, npm workspaces, ESLint, Prettier and Node's test runner support the application. Run `npm run dev:web` alongside the API and open <http://127.0.0.1:3000>. Android setup/build use `npm run setup:android` and `npm run build:android`; launch Metro with `npm run dev:mobile`. Emulator connectivity uses adb reverse while the API stays on loopback. iOS configuration is included; build/device validation requires an Apple environment.

## Guardrails

`tools/check-boundaries.mjs` parses imports, exports and dynamic imports. Its negative fixtures test cross-module internals, domain purity, client boundaries and provider SDK isolation. This is a baseline static check, not a sandbox or proof against arbitrary networking; security review and runtime controls remain required.

It also checks TypeScript import types/import-equals, literal template imports, known internal alias prefixes and alternate network clients. New alias conventions and transport libraries require corresponding architecture checks before adoption. See [continuation evidence](docs/p0/CONTINUATION-01.md) for Node 22 validation and phase-gate coverage.

Gateway schemas reject mixed-profile/unverified evidence and unknown fields. Application services separately recheck authorization, consent and evidence revisions. Live AI requires server-only key/model/pricing configuration; missing configuration produces an unavailable response. The US$5 app-wide daily budget uses Asia/Kolkata midnight. Independent clinical/privacy approvals and participant signoff remain separate from local engineering validation.
