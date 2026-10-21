# BioFlow implementation and validation

Engineering evidence recorded 21–22 October 2026. This is a synthetic local rehearsal, not participant research, clinical approval or a release signoff.

## Repository and scope

The pre-redesign application was committed and pushed as [`ced0d80bfe70d81258acadf63eca85b06fb2a9ba`](https://github.com/FutureTechStudio/BioVitAI/commit/ced0d80bfe70d81258acadf63eca85b06fb2a9ba). `git ls-remote origin refs/heads/main` matched the local checkpoint before `codex/bioflow-ui` was created. The migration preserves the server, migrations, contracts and existing clinical rules. No force push or merge to main is part of this work.

The inventory registers 118 surfaces: 24 route/layout files, 74 named rendering components, 16 workflow-state groups, one brand-asset group and three explicitly excluded template/system surfaces. All 115 applicable surfaces have their presentation implementation accounted for; this does not mean every state has passed acceptance. A workflow-state group is not a count of individually exercised states. The 24 route/layout files include redirects, error/loading boundaries and navigators; they do not represent 24 distinct product destinations. See the independently recorded validation totals in [the coverage matrix](UI-MIGRATION-COVERAGE.md).

The [22 October refinement record](BIOFLOW-REFINEMENTS-2026-10-22.md) supersedes the initial header/profile-strip/sidebar-assistant presentation and documents the session-aware floating assistant, avatar menu, broader accents and distinct tab designs. Initial screenshots below remain historical evidence of the first migration.

## Delivered modules

| Module | Implementation | Evidence and limits |
| --- | --- | --- |
| Foundation | Shared platform-neutral palette, geometry and icon paths; CSS/native adapters; bundled licensed Manrope; reusable controls, notices, cards and overlays | Token and hardcoded-color checks cover web source, route components, global CSS and native source. Platform-specific JSX/styles are retained. |
| Shell/dashboard | Expanded web navigation, responsive sidebar, profile controls, authorized explicit search, report/assistant actions, actual evidence counts, neutral body and source-linked biomarkers | Chromium/WebKit audits and populated screenshots. Notification delivery and wellness metrics remain unavailable. |
| Reports/verification | Upload, processing states, retry/cancel/withdraw, identity review/quarantine, original source and region overlays, correction reasons/history and relationships | Real local ClamAV/OCR production browser rehearsal; existing contract/DB failure-path tests. Rare UI branches are identified separately in the coverage matrix. |
| Health intelligence | Separate comparable cohorts, exact values, source navigation, exclusions and organ not-assessed evidence | Web and native comparisons preserve distinct results; no averaging, clinical conversions or interpretation is introduced. |
| Assistant/profiles | Profile-specific conversations, consent, structured rendering/citations, unavailable states, email-less family creation and later contact updates | Browser recovery/switching/isolation; native consent/provider-unavailable/withdrawal. Live response presentation requires configured AI for end-to-end verification. |
| Android | Three original tabs, focused Reports/Insights stack routes, native BioFlow primitives/fonts, family controls and accessible chart/source alternatives | APK build/install, Android export and emulator rehearsals. Physical-device, iOS and full manual screen-reader acceptance remain separate. |
| Wellness/Community | Existing unavailable, read-only and feature-paused states | No new P6/P7 services or publishing UI. Community on/off production browser gates pass. |

## Executed checks

| Command/check | Actual result |
| --- | --- |
| `npm run check` | Passed formatting, ESLint, boundaries, phase gate, BioFlow token/inventory/tracker checks, all three TypeScript targets and 51 core tests. |
| `npm run test:db` | 59 PostgreSQL/HTTP/permission/report/conversation/budget/storage tests passed using isolated databases. |
| `node tools/run-web-tests.mjs --reports` | Optimized production build passed; all four Chromium journeys passed in 56.3 seconds. Real local scanner/OCR, identity, verification, unchanged-value append correction, comparison, source, AI unavailable, consent withdrawal, account recovery and cross-account isolation are included. |
| `node tools/run-web-tests.mjs --community-off` | Optimized production build passed; three tests passed in 17.2 seconds. Report rehearsal was intentionally disabled for this feature-flag run. |
| `npx playwright test tests/web/bioflow.spec.mjs --browser webkit --workers 1` | Passed in 31.0 seconds: route audits, modal focus return, Escape, layouts, unavailable/retry/access-loss states. |
| Responsive web | 1448/1024/390/320px layouts; RTL plus 200% root text overflow checks passed. Populated 1024/390/320px dashboard overflow checks passed. |
| Accessibility automation | No Axe WCAG 2 A/AA, 2.1 AA or 2.2 AA violations in tested routes, populated dashboard/reports/insights/wellness/community and the populated biomarker drawer. Exact-value chart alternatives and non-color status text are retained. This does not establish complete WCAG conformance. |
| Android full rehearsal | Passed SecureStore restoration, email-less family creation/selection, document picker, authenticated upload, identity/result verification, source navigation, consent, unavailable provider and withdrawal. |
| Android comparison | Two generated verified reports passed distinct-result comparison and source-linked trend checks. |
| Android access and navigation | Caregiver source access, revocation clearing and owner-profile recovery passed. Focused Reports/Insights, body evidence modal and back navigation passed. Supporting tabs/chat, sign-out, fresh sign-in and sign-up/recovery form rendering passed. |
| Android accessibility smoke | 150% text retained visible profile controls and upload action. Installed TalkBack service binding was observed and prior emulator settings restored; speech/focus acceptance remains pending. |
| Authentication presentation audit | All five web modes passed Axe and 1280/390px overflow checks. The reset form used a deliberately invalid synthetic token that was never submitted; actual recovery is covered by the production browser journey. |
| Native build | Debug APK built and installed on the local API 36 emulator; final Android export passed (approximately 4.1 MB Hermes bundle plus assets). |

The first sandboxed DB attempt failed during Windows user lookup; the permitted rerun passed. Repeated development signups hit the existing rate limit, so the final browser gate used an isolated database. A broad focus workaround was narrowed to drawer launchers, duplicate sibling React keys were made unique, and native requests now cancel quietly during profile transitions. The Android harness now avoids re-verifying a previously verified cached account, bounds startup verification and scrolls clipped consent controls before activation.

## Visual and performance evidence

The [evidence directory](evidence/) contains genuine checkpoint captures of My Health and current synthetic populated dashboard, reports, insights, verification, source, quarantine and supporting screens. The checkpoint preview uses the committed source and the same synthetic profile. Development-only Next indicators may appear in development-server captures.

The reviewed desktop dashboard follows the reference composition: sidebar and utility header, selected-profile greeting, five evidence metrics, body/evidence column and biomarker/action column. Mobile stacks these surfaces. The body stays neutral and explicitly says wellness goal progress is unavailable. Source reference text is displayed when supplied by verified evidence; the demo reports without it say it is unavailable.

[Browser measurements](evidence/browser-measurements.json) record one local Chromium development-server run. Response completion was 44–64 ms and DOMContentLoaded 67–86 ms across the five sampled routes. The recorded 1.77–2.36 second readiness figures include screenshot/Axe work. These are reproducibility notes, not production benchmarks or a speed improvement claim. No comparable pre-migration performance baseline was collected.

The debug APK is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. It uses the local Metro development server on port 8081 and the loopback API on port 3001 through the emulator's retained ADB reverse mappings. The Android export contains the current JavaScript bundle; a debug APK is not a standalone production release.

## Changed files and remaining styles

- `shared/design-tokens` contains the source tokens and vector vocabulary. Web/native design-system adapters, local fonts/licenses and generated launch assets implement the presentation foundation.
- `apps/web/app` and `apps/web/src` contain the new routes, replacement global CSS, shell/dashboard and migrated health, report, profile, authentication and assistant interfaces.
- `apps/mobile/src` retains Expo Router and platform rendering, adding focused Reports/Insights, evidence overview, source-region overlays, shared typography/controls and cancellation-safe private requests.
- `tools/bioflow-*`, `tools/check-bioflow.mjs`, browser tests and the Android rehearsal maintain inventory, drift checks and executed evidence. Design documentation, the navigation ADR, CSV/JSON and the appended BioFlow workbook sheet record the workstream.

The old web global stylesheet has been replaced. Native feature StyleSheets and limited web inline geometry remain deliberately platform-specific; their colors use the shared tokens. The unused Expo starter files are excluded from the shipped route inventory and retain their original template styling. Operating-system file-picker styling is outside application control. No API implementation, database migration or clinical contract changed in this branch.

## Remaining validation and release limits

- Firefox could not launch: Playwright's installed executable fails with `spawn UNKNOWN`; direct launch reports an incorrect Windows side-by-side configuration. Chromium and WebKit results do not count as Firefox validation.
- Full manual web screen-reader and Android TalkBack/native RTL acceptance, physical-device checks and all rare UI-state branches remain pending where marked in the coverage inventory. Source review and shared tokens alone do not count as executed visual/accessibility validation.
- Live OpenAI calls and rendered provider/budget errors need the configured key, model and prices. Deterministic gateway/schema/citation/budget regressions pass; local UI tests exercise the actual unconfigured-provider state.
- iOS build/device validation, hosted CI, formal approvals and actual participant feedback/signoff remain pending. The original 51 product-task records and their review statuses are unchanged.
- Dependency audit records 21 high and 11 moderate advisories, zero critical. Existing dependency debt is not suppressed or represented as release-ready.

## Planned and excluded interfaces

Notification delivery, wellness plans/goals/check-ins/coaching, Community publishing/moderation, medical-history/condition-management services, device integrations and new sharing/export services are outside this migration unless already implemented. Their mention in the original discovery checklist is not evidence of an existing functional screen. The unused Expo starter entry files and Android's system document picker are explicitly not counted as redesigned application UI.
