# Automated rehearsal register

These are synthetic engineering rehearsals, not participant research or pilot signoff.

Verified: 51 core/contract/client checks; 59 PostgreSQL/HTTP checks; 56 source-document extraction goldens with exact expected result fields; real ClamAV clean and harmless custom-signature probes; encrypted isolated backup restoration; real scanner/OCR web upload, identity verification, report comparison, provenance, unavailable provider and AI consent withdrawal. Existing Community on/off browser regressions pass. Responses adapter mocks verify strict schema, store:false, reservation-before-dispatch, conservative failure accounting and no automatic retry.

Accessibility: Axe WCAG A/AA checks, large-text/RTL overflow and keyboard focus checks passed in the full real-report web rehearsal. The final run passed all three browser tests. Automated checks do not replace manual screen-reader review.

Android: debug APK built/installed and final bundle export passed. Phased synthetic rehearsals verified fresh authentication, SecureStore restoration, email-less family creation, profile switching, real upload/scanning/OCR, identity/result verification, source viewing, unavailable-provider chat and consent withdrawal. Two generated verified sources exercised comparisons and a comparable trend chart. Caregiver access, revocation during source viewing and owner-profile recovery passed. A 150% text smoke check passed. Per-run records are kept under ignored `.local/android-tools/rehearsals`. The API stayed loopback-bound.

Resolved during rehearsal: Expo File transport replaced the upload Content-Type, Metro initially bound IPv6, keyboard Back events could leave a form, and the harness could reuse a different synthetic account. The adapter now sends bounded binary data; Metro uses IPv4; fields use Done/blur actions; the harness verifies the signed-in account. Clipped controls are scrolled into view before activation. These are engineering rehearsals with generated data, not actual participant findings.

Open defects/gates:

- DEP-001: current SDK transitive advisories (including high severity) remain unresolved. Pilot readiness is not signed off. Compatible fixes/upstream updates require validation; audit failures are not suppressed.
- MOB-001: full manual screen-reader and native RTL audit remains pending. Automated accessibility trees, source/chart alternatives and a 150% text smoke check passed; these do not establish complete manual accessibility acceptance.
- CI-001: hosted Windows/Linux CI has not run. Poppler and PostgreSQL 18 client provisioning is configured for the new golden/restore checks, awaiting hosted execution.
- CLIN-001: independent clinical review and promoted interpretation rules are deferred. No clinical conversion, interpretation or organ score is enabled.
- EXT-001: live OpenAI model/key/pricing validation, iOS build/device checks and actual participant feedback/signoff await the required configuration/environment/people.

No severity-1/2 readiness acceptance or human pilot completion is asserted while these gates remain open.
