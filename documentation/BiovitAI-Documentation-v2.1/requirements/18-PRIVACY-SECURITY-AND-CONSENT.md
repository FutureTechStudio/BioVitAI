# Privacy, Security and Consent

## Principles
Privacy by default, minimum necessary access, encryption, auditability, data minimization, revocable sharing, transparent AI processing and secure deletion.

## Controls
- Strong authentication and per-profile authorization.
- Encryption at rest and in transit; managed secrets and key rotation.
- Restricted service accounts and isolated environments.
- Consent records with scope, purpose, version, timestamp and revocation.
- Retention schedule, data export and deletion workflows.
- Incident response, breach notification procedures and periodic reviews.
- No clinical data in routine application logs or analytics telemetry.
- Security testing for cross-profile access, file uploads and prompt injection.

## Regulatory workstream
Have qualified advisers assess applicable health-data privacy, consumer protection, medical-device classification, data residency and cross-border transfer requirements in launch jurisdictions, including India where relevant.

## AI specifics
See 36-AI-SECURITY-PRIVACY-AND-CONSENT.md.

## Acceptance
Revoked users cannot retrieve data through cached chat answers, direct object URLs, search indices or exports.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Separate consent for Health, Wellness, optional connectors, family sharing and AI tasks; enforce least-privilege server-side. Preserve revocation, audit, retention, deletion and regional residency reviews before launch.

**Related v2.1 requirements:**
- [52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE](52-PRIVACY-CLINICAL-SAFETY-AND-GOVERNANCE.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
