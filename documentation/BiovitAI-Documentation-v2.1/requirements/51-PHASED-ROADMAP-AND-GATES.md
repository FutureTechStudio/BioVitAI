# 51 — Phase-wise development roadmap and release gates
Status: Planning baseline · Owner: Product + Engineering · Capacity assumptions pending

Illustrative sequential **31-week** envelope, not a delivery commitment. Dependencies matter more than dates. Run parallel frontend/design/security tasks within phases when staffed. Never launch features before safety/privacy gates.

| Phase | Indicative weeks | Objective | Exit gate |
|---|---|---|---|
| P0 Foundation | 1–2 | Scope, safety, ADRs, source data model, environment | Product/navigation architecture, data handling plan and clinical review owner approved |
| P1 Platform & identity | 3–5 | Auth, multi-profile consent, data contracts, storage | Cross-profile tests green; access revocation and audit demonstrable |
| P2 Medical report pipeline | 6–9 | Secure upload, OCR, layout-aware extraction, verification | Verified observations with source linkage; upload/worker error recovery |
| P3 Health intelligence | 10–13 | Comparability, safe aggregation, trends, body/organ UI | Clinical goldens green; no unapproved merge/score; provenance inspectable |
| P4 AI platform | 14–17 | Gateway, authorized tools, context, chat UI | Cross-profile injection/clinical evaluation and schema checks green |
| P5 Private health pilot | 18–20 | Family pilot, instrumentation and fixes | Pilot safety/privacy signoff; severity-1/2 blockers closed |
| P6 Adaptive wellness | 21–24 | Baseline, goals, reviewed action catalogue, check-ins, recovery, optional device data | Clinically reviewed actions, consented adaption, pilot metrics; no shame/streak reset |
| P7 Community beta | 25–28 | Curated content, then moderated posts behind flag | Proven trust boundary, reporting/appeals and moderation staffing readiness |
| P8 Production readiness | 29–31 | Security, disaster recovery, localization, legal, launch controls | Go/no-go checklist complete; jurisdiction and claims reviewed |

## Release definitions
- **Milestone M1:** P1 profiles secure and stable.
- **M2:** P3 verified Health v2 capability complete.
- **M3:** P5 health+AI private pilot is usable.
- **M4:** P6 Wellness MVP ready for a monitored longitudinal cohort.
- **M5:** P7 Community read-only release; posting separate approval.
- **M6:** P8 staged launch when all jurisdiction/operational gates pass.

## Critical path
Identity/consent → document verification → source observation/provenance → clinical comparability → AI tool permissions → pilot safety → reviewed wellness catalogue/adaptation → sustained-outcome pilot. Community read-only can progress in parallel but public posting must not block safer Health/Wellness release.

## Sprint policy
Two-week sprints with acceptance demo, dependency review and safety triage. Only take a story into Sprint Ready if it has owner, acceptance checks, dependencies, data classification and test approach. A 'Done' story is not a released feature until its phase gate passes.

## Team role map (not assigned individuals)
Product Lead, Tech Lead, Backend, Frontend/Mobile, AI Engineer, Clinical/Laboratory Advisor, Behavioral Scientist, QA/Automation, Security/Privacy, DevOps, Content Trust & Safety, Localization. Some roles may be shared at small scale, but independent clinical review must not be replaced by the builder of a rule.
