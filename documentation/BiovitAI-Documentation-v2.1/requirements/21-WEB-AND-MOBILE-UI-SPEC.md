# Web and Mobile UI Specification

## Design direction
BiovitAI: calm clinical clarity, warm green accent, clean typography, high contrast, generous spacing and obvious provenance.

## Web navigation
Sidebar: My Profile, Reports, Conditions, Progress, Family Access, AI Chat, Settings.

## Mobile navigation
Bottom tabs for Profile, Reports, Chat, Progress and More. Condition and organ views accessible from Profile. Persistent selected-profile indicator.

## Shared components
Profile switcher, report card, evidence badge, organ map, biomarker chart, source citation, report comparison, empty state, permission request, AI chat card.

## Chat placement
Prominent global "Ask BiovitAI" entry, context-aware actions from report and organ screens, and a full conversation page. AI should render existing chart/card components rather than inventing ad hoc markup.

## States
Loading, partial, verified, not assessed, permission denied, unavailable, stale, and error.

## Acceptance
The same structured response payload can render on both web and mobile. Every chart has an accessible textual equivalent.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** The primary app surface is a three-tab shell: My Health, My Wellness and Community & Trends; profile picker/settings/unified AI access are shared. First-run Wellness surfaces should emphasize Today, Progress, Recovery rather than an abstract score.

**Related v2.1 requirements:**
- [44-PRODUCT-ARCHITECTURE-AND-NAVIGATION](44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md)
- [58-UX-FLOWS-AND-ACCESSIBILITY](58-UX-FLOWS-AND-ACCESSIBILITY.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
