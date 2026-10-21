# Onboarding and Authentication

## Screens
Welcome → sign up/login → email verification → privacy summary → profile creation → optional data upload → dashboard → optional family linking.

## Requirements
- Unique verified email per independently authenticated account.
- Secure session management, token rotation, logout-all-sessions, MFA/passkey support where practical.
- Profile identity is distinct from login account identity.
- An adult profile owner explicitly approves access; adding an email creates a pending invitation only.
- No implicit family membership or data sharing.
- Explain report extraction, AI processing, retention and consent before use.
- Allow read-only exploration of sample data without mixing demo and real records.

## Technical requirements
Use an established identity provider or rigorously reviewed auth implementation. Server verifies session and derives actor ID. Never trust profile ID or permissions solely from client request. Apply rate limits to login, invitation and password reset flows.

## Acceptance
An unverified invitee cannot view protected records. Revoking a session immediately blocks new protected API calls. Logout clears local sensitive caches.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Extend onboarding to separate consent scopes for Health, Wellness data use, device connectors, AI assistant, family sharing, and community participation. Community identity must not automatically expose clinical or family profile identity.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
