# Screen Inventory and UX Flows

## Public
Landing, feature explanation, sign up, sign in, verify email, reset password, privacy and consent.

## Authenticated
Profile selector; My Profile/body map; organ detail; condition detail; report library; report viewer; extraction verification; biomarker chart; report comparison; chat; chat history; progress; lifestyle plan; device connections; manual entry; family access; invitation; notifications; settings; export.

## Chat flows
- From My Profile: broad health question, scoped to selected profile.
- From Report: "Explain this report" with explicit report context.
- From Organ: "Why is kidney evidence marked for review?" with organ context.
- From Condition: "Show BP changes" with condition context.
- From Family: select authorized relative first; no silent profile switching.

## Shared screen behaviors
Show data freshness, source links, status explanations, profile identity and safe fallback for missing data.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Extend screens with Wellness: baseline/barriers, goal catalogue, Today, check-in, Adapt, Recover, outcomes. Community launches as curated read-only feed before posting. Keep current profile visually persistent on sensitive views.

**Related v2.1 requirements:**
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
