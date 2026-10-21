# Reviewer deferral for development and UAT preparation

Status: Owner-authorized roadmap amendment, 20 October 2026.

The owner explicitly requested that specialist reviewer requirements be placed in the backlog while the team continues pilot/UAT development. This supersedes the earlier requirement to obtain those specialist signoffs before P0 engineering can progress. No specialist signoff is claimed.

## Effective scope

- Clinical reviewer appointment (BV-004) returns to Backlog. Its original acceptance criteria, dependencies, ownership and evidence history are preserved.
- Specialist signoff portions of BV-003 (Security/Privacy), BV-006 (AI/Security) and BV-007 (Legal) are deferred for development. Their engineering deliverables still need completion and verification.
- Existing owner approval of three-tab scope and technology choices remains valid. Consent, authentication, profile authorization, provenance and data isolation remain engineering requirements.
- Engineering may prepare local and server-based UAT. No server location, AI processor or real-data processing arrangement has been selected by this amendment. “UAT” identifies an environment, not a country or data classification.
- This amendment is not evidence of regulatory approval, completed clinical review or production readiness. Identifiable-data pilots and production deployment must be assessed against the actual hosting, processor, feature and data choices before execution.

## Backlog follow-up

Before an identifiable-data pilot is enabled, record the dataset classification, participant consent, server country/region, AI processor and retention arrangement, and assess which specialist reviews the actual features require. Retain clinical/lab review for interpretation, conversions, aggregation and personalized action rules; privacy/security review for access and processing; jurisdiction review for applicable obligations. Reviewers can be engaged at focused checkpoints rather than as a standing team.

Specialist approvals stay Pending in approvals.json. Development deferrals are explicitly listed there so engineering checks do not falsely represent them as Approved. The full P0 review gate remains available with `npm run gate:p0:full`; it is separate from the development gate and does not establish P8 production readiness.

Historical reports describe the earlier gate and are retained. This amendment and the owner's confirmed decisions are authoritative for current development planning.

Tracker update: BV-004 changed from Blocked to Backlog in CSV/JSON/XLSX, with the prior files preserved under project-management/history/2026-10-20-before-review-deferral. BV-003/006/007 notes reference this amendment. Development may begin on work with the deferred BV-004 prerequisite; original task completion acceptance remains distinct from permission to begin work. Validation: 17 tests pass; tracker and requirement-package checks pass; workbook formulas and affected views were checked, showing five Blocked tasks and zero Done.
