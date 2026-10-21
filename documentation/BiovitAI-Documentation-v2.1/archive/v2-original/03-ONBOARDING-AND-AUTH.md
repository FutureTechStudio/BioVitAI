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
