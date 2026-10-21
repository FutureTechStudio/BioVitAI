# 55 — Open architecture decisions, risks and dependency map
Status: Decision log · Owner: Product / Tech Lead

## Open decisions
| ID | Decision | Conservative baseline | Required by |
|---|---|---|---|
| DEC-001 | Hosting/data residency and launch jurisdiction | Keep provider/cloud abstract; no assumed regulatory approval | P0 |
| DEC-002 | Web/mobile tech stack | Monorepo interfaces portable; choose after team skill review | P0 |
| DEC-003 | OCR provider and supported lab templates | Adapter + pilot golden set, manual verification | P2 |
| DEC-004 | Clinical/lab rule signoff owner | Qualified external/internal reviewer is required | P0 |
| DEC-005 | AI provider/model selection | Gateway adapters, strict residency and evaluation | P4 |
| DEC-006 | Supported languages | English + Arabic launch target, validate audience | P0 |
| DEC-007 | Wearable integration pathways | No vendor assumptions; manual input works first | P6 |
| DEC-008 | Community public-post launch | Default OFF; read-only curated feed first | P7 |
| DEC-009 | Family minors/guardians | Do not implement minors until legal/privacy policy defined | P1 |
| DEC-010 | Wellness evaluation cohort and timeframes | Register 3/6/12-month measures; no outcome claim before follow-up | P6 |

## Key risks and mitigations
- **False health merge:** preserve atomic result, strong comparability gating, reviewer controls, golden fixtures.
- **Privacy leakage across family profiles:** server-side scope checks in every tool, query, cache, job and export; negative tests.
- **Model hallucinations:** deterministic tools, evidence references, structured output validation, safe fallbacks.
- **Unreviewed coaching:** approved action catalogue and precondition engine, no freeform medical regimens.
- **Behavior fatigue:** user-selected goals, minimum actions, opt-out, reminder budget, recovery support.
- **Community misinformation:** source labels, moderation and separate trust domain; posting flag OFF until staffed.
- **Vendor lock-in/cost:** AI Gateway adapters, cache safe artifacts, per-workflow budgets and observability.
- **Scope explosion:** hold P7 social features to curated read-only until P6 pilot outcomes are credible.

## Cross-phase dependency spine
`P0 policy/data decisions` → `P1 identity/consent` → `P2 verified source data` → `P3 clinical aggregation/trends` → `P4 authorized AI` → `P5 pilot` → `P6 reviewed adaptive wellness`. Community architecture begins at P0 but user posting has independent P7 gate; P8 production readiness closes operations, privacy and jurisdiction risks.
