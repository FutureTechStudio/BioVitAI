# Profiles and Family Access

## Model
account = authenticated person
profile = health record subject
profile_grant = permission for account to access profile
invitation = pending request, NOT an active grant

## Roles
Owner: manages own data and grants.
Caregiver: reads permitted health categories and performs expressly granted actions.
Viewer: reads selected categories only.
Support: no routine clinical access.

Permissions are scoped by profile, action, category, expiry and revocation state. Role names are UI presets, not substitutes for authorization checks.

## Invitation flow
1. Owner chooses profile, email, role/scopes and expiry.
2. Backend creates single-use, expiring invite; sending an email does not grant access.
3. Invitee authenticates and verifies email.
4. Required profile-owner consent and invitee acceptance are recorded.
5. Backend activates grant; access is reevaluated on EVERY tool/API call.
6. Owner can revoke instantly; sessions and caches must not preserve stale access.

## Safeguards
No cross-profile leakage in chat context, embeddings, logs, summaries, exports or notifications. A conversation is pinned to one selected profile; switching requires explicit UI action and resets profile-specific context.

## Acceptance
"Show Dad's blood pressure" returns a permission request or denial unless Dad's profile is currently authorized. An email alone is never sufficient.
