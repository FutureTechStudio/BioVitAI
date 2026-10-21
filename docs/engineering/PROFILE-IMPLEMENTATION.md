# Profile, sharing and consent API

BV-009 local implementation, 20 October 2026. This builds on the tested BV-008 identity service. All routes require a verified database session; the HTTP adapter resolves the actor from its cookie. Request bodies cannot select an owner or role for the caller. POST requires the configured exact Origin and JSON, with a 16 KiB limit. Responses use no-store caching.

## Model and policy

An account is an authenticated person. A profile is a separate UUID for a health record subject. An account can have one `self` profile and multiple managed `family` profiles, with no email or login required for family members. `ownerId` identifies the managing account, not a verified identity claim about the subject. Optional contact email can be added, changed or removed later by the manager; it grants no account access and is excluded from general profile responses. Linking another login uses verified invitation acceptance against the existing profile ID, preserving its records; no automatic merge or management transfer occurs. Age assurance and legal guardian workflows remain unimplemented.

Sharing requires explicit `family_sharing` consent and a single-use invitation accepted by its intended verified email address. An email alone is never a grant. Tokens contain 256 random bits; only SHA-256 hashes enter PostgreSQL. Private local files under `.local/auth-mailbox/invitations` capture delivery; no external messages are sent. The owner receives the invitation ID, never the token through an HTTP response. A capture failure cancels the committed invitation and records a failure event. A crash between commit and capture can leave an unusable pending invitation that expires; a durable delivery outbox is future hosted work.

Scopes are exact `(category, action, purpose)` triples. Categories: `profile`, `health`, `wellness`. Actions: `read`, `write`. Purposes: `care`, `wellness`. Role names are labels; viewers cannot receive write scopes, and caregivers gain no implicit permissions. Grant expiry must be in the future and within 90 days; invitation acceptance expires after at most 24 hours. Owners can cancel pending invitations or revoke accepted grants. Revoking either identifier invalidates the linked invitation/grant. Expiry is checked on every operation.

The public `ProfilePolicy.withAccess` contract wraps each protected operation, including future tool/worker/cache retrieval. It locks the profile row, resolves current consent/grants from PostgreSQL, executes the operation, writes a successful access audit, then commits. All sharing/consent mutations lock the same row. An operation already holding the lock finishes before a concurrent revocation commits; no new operation can reuse an old allow decision after that commit. Database statement deadlines still apply. Do not call this recursively for the same profile or cache its result as authorization. Future health repositories must also filter every resource/reference by the authorized profile ID inside their protected operation.

This slice has no worker, clinical cache, search index, export or source download pipeline. Their future implementations must use the same policy before returning stored results; their end-to-end revocation acceptance remains to be exercised when those paths exist. The API does not expose clinical records or an AI provider.

## Consent

For managed profiles, the audit/consent actor identifies the manager performing the action. This does not claim that the subject personally clicked consent. Creating a family profile does not automatically opt into AI or other processing.

Each explicit grant or withdrawal appends a timestamped record with actor, profile, purpose and notice version. There is no automatic consent at signup or invitation acceptance. The local contract recognizes `pilot-v1` for `family_sharing`, `health_ai`, `wellness_ai`, `health_to_wellness`, `connectors` and `notifications` separately. This version identifies the engineering contract, not a reviewed legal notice or production consent UI. Health-to-wellness access requires its own consent even for owners. AI integrations must supply the appropriate AI consent purpose to `withAccess`; family permissions alone cannot establish AI consent. Connectors/notifications are records only until their integrations exist.

Withdrawing family sharing atomically revokes all current grants and pending invitations. Reconsenting does not resurrect them. Withdrawing AI consent leaves family read permissions intact but blocks subsequent operations requiring that AI consent. Historical consent/audit rows are retained. The application exposes no edit/delete route for them; the local database owner remains privileged. Tamper-resistant retention, dedicated runtime database roles, export/deletion and hosted hardening remain future work.

## Routes

Creation now accepts `{displayName, kind:"family", contactEmail?}`; omitting kind preserves the existing self-profile contract. Owner-only `GET/POST /v1/profiles/:id/contact` reads/updates `{email:string|null}`. Contact email does not create a grant.

`GET /v1/profile-context` returns `{profile,revision}` for the current session, initially `{profile:null,revision:0}`. `POST` to the same route accepts `{profileId,expectedRevision}`. A stale revision returns 409. The selection is shared across the app in that session; another browser/device session retains its own selection. It never changes the signed-in actor. See [active profile contract and client guard](PROFILE-CONTEXT.md).

| Method | Route                                                  | Contract                                                                                                               |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/profiles`                                         | `{displayName}` creates own profile; duplicate returns 409                                                             |
| GET    | `/v1/profiles`                                         | Current authorized profile list, at most 100 candidates; default care/profile/read scope                               |
| GET    | `/v1/profiles/:id?purpose=care`                        | Exact profile/read scope; purpose also supports wellness                                                               |
| POST   | `/v1/profiles/:id/consents`                            | Owner only: `{purpose, noticeVersion:"pilot-v1", granted}`                                                             |
| GET    | `/v1/profiles/:id/consents`                            | Owner only, latest 100 consent records                                                                                 |
| POST   | `/v1/profiles/:id/invitations`                         | Owner only: `{email, role, scopes:[{category,action,purpose}], expiresAt}`; returns invitationId and acceptance expiry |
| POST   | `/v1/profile-invitations/accept`                       | Intended verified recipient: `{token}`; returns grantId/profileId                                                      |
| GET    | `/v1/profiles/:id/sharing`                             | Owner only, latest 100 invitations with linked grant state; excludes tokens/hashes                                     |
| POST   | `/v1/profiles/:id/sharing/:invitationOrGrantId/revoke` | Owner only, `{}`                                                                                                       |
| GET    | `/v1/profiles/:id/audit`                               | Owner only, latest 100 successful access/security change events                                                        |

Unknown/inaccessible profiles return the same 404. Invalid DTOs return 400; unauthenticated requests return 401; missing required consent returns 403. Audit events contain identifiers, event, purpose and timestamp, never display names, email addresses, tokens or clinical content. Failed policy decisions currently return generic errors without creating profile audit records. HTTP application errors remain generic.

## Validation

`tests/integration/profiles.test.mjs` runs the real HTTP/authentication/policy stack against isolated native PostgreSQL. It covers cross-account IDs, forged owner fields, explicit sharing consent, pending versus accepted invitations, intended email binding, read/write/purpose boundaries, separate AI consent, health-to-wellness consent, consent history, same-session revocation, row-lock ordering, reconsent without resurrection, invitation replay races, expired invites/grants, resource substitution, origin rejection and capture failure cancellation. No patient data or external delivery is used.

Run `npm run check` and `npm run test:db`. Apply the additive `0002_profile_access.sql` and `0003_managed_profile_context.sql` migrations using `npm run db:migrate` against the running local database. Readiness now checks identity/profile/context tables and the new profile columns. Previously applied migrations are unchanged. The managed-profile upgrade test seeds an old self profile, consent and audit before applying 0003 and verifies their IDs/content survive.

BV-009 remains In Review with local engineering evidence. No production acceptance or absent worker/cache implementation is claimed. The next scheduled slice is BV-010, canonical health evidence schema and migrations.
