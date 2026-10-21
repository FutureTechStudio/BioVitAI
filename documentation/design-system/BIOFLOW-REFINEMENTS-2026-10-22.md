# BioFlow refinements — 22 October 2026

The owner's follow-up replaces the in-page profile strip and sidebar assistant with a quieter header and floating chat, broadens the accent palette, and gives each web tab its own composition. Existing permissions, clinical rules and service availability remain authoritative.

## Profile controls

The avatar opens My Profile, Switch Profile and Manage Profiles. The menu supports Arrow Up/Down, Home/End, Escape, outside click and focus return. My Profile shows the signed-in account/self profile. Switch Profile uses the permission-checked profile list; Manage Profiles retains email-less creation and later contact updates. The repeated selected-profile card is removed from page content. A first-time account can still use Add a profile.

## Assistant behavior

The bottom-right icon opens a compact, nonmodal conversation window. Full screen opens the same conversation with its history sidebar and modal keyboard containment; minimizing retains the conversation. New chat starts a fresh conversation. Reopening or navigating to another tab resumes the current conversation for that profile and browser session.

Only an opaque conversation UUID is retained in sessionStorage, scoped by account, authenticated session ID and profile ID. No question, medical text, draft or authentication token is stored there. A new sign-in/session receives a fresh conversation; historical conversations remain available through authorized, consent-checked retrieval in full screen. If sessionStorage is unavailable, an in-memory pointer is used.

Profile changes close the assistant and reset rendered messages, history, sources and pending publication through the existing context guard. Consent withdrawal clears displayed messages, source context and history. Missing evidence and an unconfigured provider produce their actual unavailable states. Suggested questions only fill the composer; they never send automatically.

## Color and page composition

White/mist surfaces dominate. Green identifies brand and wellness, blue identifies evidence and analytics, amber/coral identify review/attention states, and violet identifies the assistant. Dark foreground variants preserve contrast. Anatomical accents identify regions while every organ remains explicitly not assessed.

| Tab | Composition |
| --- | --- |
| Dashboard | Mint-to-blue welcome, five subtly accented evidence metrics, neutral body navigator, analytical biomarker filters/sparklines and warmer next-step actions. |
| My Health | Dedicated health hero, three evidence journeys, anatomical navigation, actual record/verification counts and a source-literacy card. Existing report workbench and `/health?report=…` access are retained. Verification progress measures records, not health. |
| Labs & Reports | Document hero, real library/review counts, upload-review-compare journey, upload surface, named comparison region and source/status-aware document rows. |
| Insights | Blue analytical hero, actual cohort/result/exclusion counts, biomarker search/date controls, individual trend cards with exact source tables, exclusions and comparisons. |
| My Wellness | Warm editorial layout, gentle botanical artwork and genuine links to reports/evidence. Plans, goals, tracking and recommendations remain unavailable. |
| Community | Violet editorial canvas, explicit read-only/paused state, private-health navigation and no fabricated published content. Publishing remains unavailable. |

## Validation and evidence

- `npm run check` passed formatting, lint, token/inventory/architecture checks, web/native type checks and 51 core tests.
- `node tools/run-web-tests.mjs --reports` passed all five production Chromium journeys in 2.3 minutes, including the new assistant regression and actual report extraction. The serial signup cooldown accounts for approximately one minute.
- `node tools/run-web-tests.mjs --community-off` passed four production Chromium journeys in 25.5 seconds; the report rehearsal was intentionally skipped in this feature-flag run.
- `npx playwright test tests/web/assistant.spec.mjs tests/web/bioflow.spec.mjs --browser webkit --workers 1` passed both journeys in 52.2 seconds. The profile menu now defers its focus-exit check until pointer activation completes, fixing a WebKit blur/click ordering defect. The public 404 check uses a separate page to avoid competing with private-view redirects.
- `npm run build:web` passed the final optimized build of all web routes. Existing PostgreSQL/API/clinical logic is unchanged; the previous 59-test database result is retained rather than represented as a fresh run in this refinement.
- The new assistant browser regression exercises avatar keyboard navigation, My Profile, compact resume, navigation between tabs, New chat, full-screen history selection, fresh sign-in and switching profiles during a pending response.
- The existing real ClamAV/OCR report journey continues through identity, verification, append correction, comparison, source inspection and unavailable-provider/consent states.
- All six populated tab pages and both assistant sizes passed Chromium Axe checks for the audited WCAG A/AA tags. Tablet/mobile widths 1024/390/320 and RTL at 200% text passed overflow checks. Narrow-screen body cards stack for legibility.
- A low-contrast information badge was corrected to the dark analytical-blue foreground. Obsolete sidebar-assistant/profile-strip selector blocks were removed.
- Synthetic signups retain the actual pilot rate limiter. The serial regression harness waits for the indicated cooldown before retrying a throttled account creation.
- Coverage registers 118 surfaces, with 115 applicable and three excluded. Recorded passes are functional 98, visual 89, responsive 58 and accessibility 52; untested dimensions remain explicit. CSV/JSON and the Artifact Tool-authored workbook sheet are reconciled while preserving all five original worksheet parts, 51 tasks, ten decisions and formal review statuses.

Changed source is concentrated in the web shell, new avatar menu/session pointer/assistant window/page compositions, existing dashboard/report/intelligence/chat presentation, shared accent tokens and browser regressions. No backend or clinical-rule migration is included. Nineteen obsolete CSS selector blocks for the superseded sidebar assistant/profile strip were removed.

Screenshots and machine-readable audit results are in [the refinement evidence directory](evidence/refinements-2026-10-22/). This is engineering evidence, not human accessibility or participant acceptance. Firefox's existing launch issue, full manual screen-reader/device/iOS acceptance, live provider configuration, dependency advisories and formal signoff retain their earlier limits.
