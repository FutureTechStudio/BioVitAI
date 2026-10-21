# P0 review packet — 20 October 2026

Historical initial review packet. Current owner decisions, implemented foundation evidence and development gate status are reconciled in [FOUNDATION-CLOSEOUT.md](FOUNDATION-CLOSEOUT.md). Statements below describing the initial empty repository and blocked development are retained as history.

All approvals below are pending. No reviewer or owner individual has been invented. Role labels identify required accountable parties. This packet prepares decisions; it is not a signoff.

## Assessment and implementation order

Initial inventory: documentation only, 60 working specifications, 44 archived originals, 51 Backlog tasks, ten Open decisions, no application source, manifests, tests or Git repository. The 22-byte root ZIP is retained without using it as a source. Working features to preserve: none found. Main gaps: every runtime module and all approval evidence.

Review 00–59 under the explicit precedence matrix: three tabs, modular monolith, centralized Gateway, preserved observation provenance, deterministic reviewed clinical and Wellness logic. Original V2 acceptance criteria still apply. New DDL is P1 work; analytics P3, provider integrations P4, adaptive Wellness P6 and Community P7.

First close BV-001, then BV-002/BV-003/BV-004; BV-005 follows accepted BV-002; BV-006 follows BV-002/BV-003; BV-007 follows BV-003. The implementation brief explicitly permits independent preparatory tooling/contracts while decisions await review. The local scaffold provides review evidence only; none of these dependencies is treated as satisfied.

## BV-001: scope for Product review

| Area               | Agreed baseline to review                                    | Proposed route |
| ------------------ | ------------------------------------------------------------ | -------------- |
| My Health          | Upload, verify, library, trends, evidence, family access     | /health        |
| My Wellness        | User goals, reviewed actions, check-ins, adaptation/recovery | /wellness      |
| Community & Trends | Source-labeled curated feed first; posting OFF               | /community     |

Shared assistant and profile indicator remain visible in sensitive views. Profile switching explicitly clears personal views/chat context and resolves new permissions before loading. Community identity stays independent. Health and Wellness must work with Community disabled. Each tab needs loading, empty, error, permission and accessibility states. English/Arabic and RTL are planned, pending DEC-006. Clinical data never auto-shares publicly.

Review journeys: upload→identity quarantine if needed→verify→source-linked comparison→optional reviewed action; start Wellness without labs/device→choose minimum action→skip/pause/check-in→recover without loss of history; article→inspect source→save; switch relative→clear context→re-authorize. Product/UX must review these and requirements 02/25/44/58, approve scope and attach dated evidence. No UI implementation is claimed.

## BV-002, BV-005, BV-006

Review ADR-001 and ADR-002. Build, lint, format, contracts and negative boundary checks are preparatory engineering deliverables. Missing: accepted architecture, stack/team decision, Git remote and reviewed PR, hosted CI evidence and production security controls. The repository has been initialized locally without committing or publishing. No P1 endpoints or shell are implemented.

## BV-004: clinical and golden-set charter

Product appoints a named qualified clinical/laboratory reviewer independent of rule authors and a backup/escalation contact. They approve marker mapping, unit conversion, comparability, amendment selection, urgent wording, population exclusions and all clinical rule versions. A behavior-science reviewer additionally approves adaptive action content and exclusions before P6.

Goldens start synthetic; consented de-identified data requires documented lawful handling. Each case records source fixture/hash, expected raw comparator/unit/date/specimen/method, identity, provenance, expected exclusions, rule version, author and independent reviewer/date. Cover corrected/preliminary reports, reruns, incompatible specimens, censored values, missing data and cross-profile attacks. At least 50 extraction cases are BV-018, not a P0 accomplishment. Source fidelity and identity isolation must be exact on controlled cases, with zero known meaningful false merges; reviewer defines representative corpus and additional thresholds before pilot. Version fixtures; changes trigger regression and reviewer reapproval. Never store patient fixtures in Git.

Unsafe result or rule: block promotion, record defect without PHI, notify designated clinical/security owner through the agreed incident process, disable affected rule, preserve audit history and invalidate derivatives. No rule ships with missing reviewer evidence. Named reviewer, backup, escalation channel, evidence method and dated acceptance are still required.

## BV-007: decision recommendations (all pending)

| Decision | Recommendation for review                                                                                           | Required owner                  |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| DEC-001  | Synthetic local development; choose jurisdiction, region, transfers, retention and processor terms before cloud/PHI | Product + qualified local Legal |
| DEC-002  | Typed monorepo, Next.js/React Native/TypeScript/PostgreSQL; review skills and operating cost                        | Tech Lead                       |
| DEC-004  | Appoint independent lab/clinical reviewer and backup                                                                | Product + Clinical              |
| DEC-006  | English/Arabic with explicit RTL and assistive-technology checks                                                    | Product + UX                    |
| DEC-009  | Adults only until legal/privacy guardianship policy approved                                                        | Legal + Privacy                 |

No UAE compliance, hosting location or minors policy is approved here. DEC-009 baseline due gate remains P1, but the implementation brief makes its scope decision part of BV-007/P0; record this stricter planning requirement without rewriting the baseline. DEC-003/005/007/008/010 remain Open for later gates. Do not select vendors implicitly.

## Exit gate

P0 FAILS/CLOSED TO P1: pending signed navigation, accepted architecture, approved profile/data-handling threat model, named clinical owner, reviewed Gateway contracts, jurisdiction/language/minors decisions, and reviewed tooling evidence. Each approval must include named reviewer, role, date, artifact version and durable PR/decision evidence. Technical checks cannot supply these approvals.

Next eligible task: BV-001 Product/UX review. Continue only independent P0 review preparation until its dependencies clear. See THREAT-MODEL.md and EXECUTION-REPORT.md for evidence and limitations.
