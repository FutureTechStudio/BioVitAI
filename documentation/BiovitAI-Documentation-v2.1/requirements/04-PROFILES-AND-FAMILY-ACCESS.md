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


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Every cross-tab read must resolve active profile authorization server-side. Family access is purpose-scoped and revocable, and Wellness plans/Community accounts must never inherit permissions merely from relationship or a shared device.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [47-MODULAR-ARCHITECTURE-AND-BOUNDARIES](47-MODULAR-ARCHITECTURE-AND-BOUNDARIES.md)
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
