# BiovitAI — Product and Engineering Requirements v2.0

Updated: 2026-10-20
Status: Implementation-ready draft; clinical, security, and legal review required.

## What is BiovitAI?

A consent-aware, family-centered health intelligence platform for web and mobile. It transforms verified medical reports, connected device measurements, and manual entries into longitudinal histories, body/organ evidence views, condition tracking, and cautious lifestyle guidance.

The AI chat is an interface to the SAME health platform. It must discover authorized context, select approved backend tools, retrieve verified evidence, and render grounded responses. It must never be a second independent source of medical truth.

## Package map

### Core product: 01–26
01 Vision and scope
02 Personas and journeys
03 Onboarding and authentication
04 Profiles and family access
05 Report upload and ingestion
06 Extraction and verification
07 Canonical health data model
08 Historical trends
09 Biomarker interpretation
10 Profile and body map
11 Organ drill-down
12 Condition tracking
13 Lifestyle plans and progress
14 Devices and manual entry
15 Notifications
16 Report library
17 Exports and sharing
18 Privacy, security, and consent
19 System architecture
20 REST APIs and events
21 Web and mobile design
22 Accessibility and localization
23 QA and acceptance
24 Roadmap and backlog
25 Screen inventory
26 Dad-first pilot

### AI intelligence: 27–43
27 AI chat product requirements
28 Orchestrator and tool calling
29 AI tool catalog
30 Context manifest
31 Report comparison
32 Multi-marker clinical analytics
33 Structured chat UI blocks
34 Prompts and guardrails
35 Conversation memory and retrieval
36 AI security and consent
37 Evaluation and fixtures
38 Observability, performance, cost
39 AI MVP build plan
40 Database migrations
41 API payloads and contracts
42 Edge cases and acceptance
43 Open decisions and references

## Recommended build sequence

1. Authentication, profiles, consent and authorization.
2. Upload → extraction → human verification → normalized storage.
3. Report search, analytics, comparison, and longitudinal history.
4. Five read-only AI tools and bounded orchestration.
5. Structured chat response cards, charts and citations.
6. Body map, condition views, family access, devices and plans.
7. Clinical review, security testing, pilot and release gates.

## Architectural rule

Do NOT send all patient PDFs to an LLM per message. The database is the source of truth for numeric measurements; immutable report files provide source evidence; deterministic services compute comparisons; the LLM orchestrates tools and explains supported results.

## Suggested repository layout

apps/web
apps/mobile
services/api
services/ingestion
services/analytics
services/ai-orchestrator
packages/contracts
packages/clinical-rules
packages/ui-tokens
infra
docs/requirements

## Release gate

No real patient launch without explicit consent flows, secure data isolation, deletion/export, clinician-reviewed safety policy, measured extraction quality, audited AI tools, and a completed privacy/security review.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** For the consolidated implementation baseline, use the three-tab navigation in 44 and the phase P0–P8 gates in 51. The earlier implementation sequence above remains historical V2 context, not the latest phase schedule.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [51-PHASED-ROADMAP-AND-GATES](51-PHASED-ROADMAP-AND-GATES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
