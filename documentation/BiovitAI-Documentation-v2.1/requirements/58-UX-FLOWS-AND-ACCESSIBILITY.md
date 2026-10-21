# 58 — Three-tab UX, mobile flows, accessibility and localization
Status: Product UX baseline · Owner: Product Design

## Shell
Bottom tabs on mobile / primary navigation on desktop: My Health, My Wellness, Community. Persistent AI assistant access and profile-context indicator. AI suggestions are optional. Preserve v2 Health dashboard and drilldowns rather than rewriting.

## Wellness screens
1. Onboarding: goals and preference; optional barriers, time/availability, accessibility, shift work, fasting, language, notification choice.
2. Today: one user-selected small action with minimum/standard/fallback, easy Skip/Pause and why-it-fits.
3. Progress: weekly pattern + confidence + explicit missing-data marker, no ranking by shame or punitive streak.
4. Recovery: 'Plans change. Would you like a smaller restart?' with barriers and `Skip`.
5. My Plan: change goals/schedule/effort and explanation of adaptation; versioned history.
6. Safety: clear non-diagnostic information, source linking, clinician referral when configured.

## Community screens
Read-only source-labeled feed, article detail (source/author/date/evidence label), saved reads; posting/replies behind feature flags until moderation review. Each UGC item displays whether it is personal experience or professionally reviewed. No auto-publication from medical profile.

## Accessibility & localization
WCAG 2.2 AA target; keyboard and screen-reader flows, font scaling, simplified language, RTL Arabic and proper bidirectional numeric/unit display, reduced-motion option, large tap targets, voice/text alternatives, low-bandwidth states. Never infer disability, culture or religion; let user opt in to relevant modes.

## Key UX acceptance
- User can complete initial Wellness plan without uploading medical reports or owning a wearable.
- Health evidence source can be expanded to original verified report.
- A missed week leads to an encouraging recovery option and does not delete past achievements.
- Profile change clears stale cross-profile Health/AI data.
- Arabic screen-reader and mixed LTR values verified on core screens.
