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
