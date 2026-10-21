# P2–P5 local implementation and evidence

Owner authorization: implement BV-014–BV-032 under the accepted plan, with local synthetic data, English, Android first, iOS-compatible source, local OCR and configurable OpenAI explanations. Reviewer appointment remains deferred. P6/P7 services are excluded. P1 formal review statuses are preserved.

## Report evidence

Forward-only migrations 0006–0011 extend the original immutable schema. Uploads are authenticated, selected-profile/revision bound, limited to 20 MiB, content-sniffed and deduplicated per profile. Originals remain encrypted and immutable. Generic foundation download tickets cannot bypass report scanning. The worker uses fenced durable leases, three bounded attempts, explicit retry/cancellation and a separate scan/extract/review lifecycle. Cancellation withdraws verified evidence too.

Local ClamAV uses official signatures; a clean exit additionally requires a loaded signature database and one scanned file. Missing tools and scanner failures do not become successful processing. A harmless custom signature was detected by the real installed engine; a separate clean-file probe passed. EICAR attempts produced an unavailable result on this host, and are not claimed as successful detection tests.

PDF inspection rejects encrypted, malformed and over-50-page documents. Rasterization and image decoding are bounded. Embedded PDF text extraction is supported when `pdftotext` is installed; otherwise local Tesseract reads rasterized pages. The installed host currently uses the OCR fallback. OCR returns normalized source boxes, with a four-minute extraction deadline and an 80 MiB preview cap. Uncertain values remain candidates. Patient names never silently match identity; missing identity requires explicit confirmation and conflicting names remain quarantined. Unverified/quarantined originals and pages are restricted to the owner/uploader.

Web and native source/review screens support quantity, qualitative and missing results, corrections with reasons, and manual candidate selection from immutable raw regions. Published observations require identity-bound verification. Original extraction, verification history, source fields and report relationships remain separate. Rerun/amendment declarations preserve both sources; no result averaging is enabled.

Reference intervals remain verbatim and carry a selected raw-region link through verification and correction history. Independently known dates, methods, specimens and concepts can be confirmed without inventing the missing fields. Unknown context remains null and is excluded conservatively. Source-region outlines are displayed on the web page viewer.

The engineering corpus contains 56 generated synthetic PNG/JPEG/WebP/TIFF/PDF documents, including multipage PDFs, comparators, qualitative/missing results and identity variants. Exact parsed result fields and source-coordinate bounds pass. PostgreSQL tests separately exercise duplicate handling, manual review, explicit relationships, quarantine, scanner outage, malware denial and corrections. These are engineering goldens, without clinical approval.

## Deterministic health intelligence

Comparability requires exact verified concept system/code, specimen, method, unit and observation date. Missing or incompatible context and censored/non-numeric results receive exclusions. Results remain distinct and source-linked. No conversion, normalization, aggregation or clinical interpretation rule is activated. Charts have exact-value tables; organ evidence stays explicitly not assessed while reviewed interpretation rules are absent. Derived views are recomputed from effective verified evidence rather than stale persistent caches. Conversation evidence fingerprints include observation and report revisions.

## AI authorization and accounting

The provider-neutral explanation port is implemented by a server-only OpenAI Responses adapter. Requests use strict JSON schema and `store:false`; this is not a claim of zero provider retention. Output is schema-validated, then checked for allowed citations/revisions and forbidden HTML/URLs. The fixed read registry exposes verified reports/observations, trends, comparisons and organ evidence. Agents have no database, arbitrary URL or code-execution facility.

Conversations are profile-specific, encrypted locally and included in backups. Authorization, active context, health AI consent and evidence fingerprints are rechecked before retrieval, dispatch and delivery. Concurrent request claims prevent duplicate dispatch; stale evidence suppresses delivery/history. Configuration requires `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MILLION` and `OPENAI_OUTPUT_USD_PER_MILLION`. No model/pricing is invented and no live provider test is claimed without configuration. The deterministic features remain available.

The context manifest contains the analysis version, authorized cohort IDs, explicit exclusions, organ evidence states and omitted-observation count. It contains no raw report pages or patient headers. The Gateway rechecks session/account verification, permission, consent and evidence after reserving budget, immediately before dispatch. A denied check makes no provider call and releases only that known-undispatched reservation. Post-validation accepts numeric comparators while rejecting HTML, URLs, fabricated citations and stale revisions.

Atomic PostgreSQL reservations enforce the app-wide US$5/day cap at midnight Asia/Kolkata. UTF-8 input size plus framing allowance bounds reserved input tokens; output is capped at 1,200 tokens and calls have a 20-second deadline. There is no automatic dispatch retry. Ambiguous failures retain the reservation. Concurrent exhaustion, replay, consent withdrawal and stale evidence were tested against PostgreSQL.

## Native application and local tools

Expo SDK 55, Expo Router, Better Auth Expo and SecureStore supply native authentication, three tabs, family selection, reports, verification, evidence and chat. Managed profiles need no email. Context changes clear profile views and abort old requests. The Android document picker rechecks account/context on return. App links are restricted to the configured scheme; browser Origin/CSRF defenses remain enforced.

Portable Java/Android SDK tooling lives under `.local/android-tools`. A debug APK was built at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`; Android bundle export and TypeScript checks passed. Emulator API/Metro forwarding uses `adb reverse`; the API remains bound to 127.0.0.1. Metro selects IPv4 localhost to avoid the observed IPv6 forwarding fault. Native rehearsal results are recorded separately below as they are verified. iOS build and device validation remain pending an Apple environment.

Native rehearsals confirmed fresh sign-in, SecureStore restoration, email-less family creation, profile switching, binary upload, real local scanning/OCR, explicit identity/result verification, source-page viewing, authorized chat and consent withdrawal. Separate generated sources exercised native comparisons and a comparable trend chart. A separate owner granted caregiver access, then revoked it while the caregiver viewed a source page; report values and the image cleared, and profile access recovered after refresh. The 150% text smoke check retained usable profile controls and an upload target. Native actions have 48 dp minimum targets, and form Done actions dismiss the keyboard without navigation. Full manual screen-reader and native RTL review remain pending.

The Android upload adapter sends a bounded binary buffer because Expo's File/Blob transport replaces Content-Type with the file MIME type. This preserves the octet-stream upload contract. iOS configuration permits the loopback pilot connection through a limited ATS exception; no Apple build/device validation is asserted.

## Pilot operations and validation

The protocol, instructions, interview prompts, severity criteria and empty participant register are in `docs/pilot`. Scrubbed tracing joins API, object storage, workers and Gateway without logging report text, questions, email, filenames or model payloads. `pilot:ops` exposes aggregate queue, extraction-quality and budget metrics; permission denials appear as HTTP trace statuses.

`pilot:backup` encrypts a custom PostgreSQL dump, encrypted objects and the application encryption key under an independent passphrase. Restore is restricted to an isolated test cluster and empty object directory. The real restore drill verified source bytes, effective observations, session continuity, authorization denial and encryption-key recovery. Missing utilities or credentials fail explicitly. PostgreSQL client utilities are provisioned separately from the embedded server.

Recorded checks: 51 core/contract/client tests and 59 PostgreSQL/HTTP tests passed. The full real-scanner/OCR web upload → verify → compare → unavailable-AI/consent-withdrawal journey passed. Community on/off browser regressions passed. Axe, keyboard, large-text and RTL overflow checks passed in the latest three-test web rehearsal. Native rehearsal results are updated in `docs/pilot/REHEARSAL.md`.

## Remaining gates and limitations

Formal clinical/privacy approvals, promoted clinical rule/golden governance, hosted CI, iOS validation and participant feedback/signoff are not engineering completion claims. No actual participant research is recorded. The current dependency audit reports 21 high and 14 moderate transitive advisories. Compatible upstream fixes remain a readiness defect; no forced downgrade or audit suppression was applied. Manual screen-reader/native RTL review and the external gates remain open before pilot readiness can be signed off.

Run commands: `npm run setup:reports`, `npm run setup:android`, `npm run setup:backup`, `npm run build:android`, `npm run dev:mobile`, `npm run reports:worker`, `npm run pilot:ops`, and `npm run pilot:backup` with a separate `BACKUP_PASSPHRASE`. `node tools/run-web-tests.mjs --reports` uses isolated synthetic data and real local tools. Tools do not authorize production or real patient processing.

With the emulator, API, worker and Metro running, `node tools/android-pilot-rehearsal.mjs` runs the native synthetic journey. `node tools/seed-android-rehearsal.mjs` prepares two controlled comparison sources, followed by the rehearsal's `--compare-only` mode. `node tools/seed-android-caregiver.mjs` prepares a separate synthetic owner and grant, followed by `--caregiver-only`, which revokes that grant during source viewing. `--large-text-only` tests 150% text and restores the normal font setting. These tools use dedicated local synthetic accounts and capture files, with no external message delivery. Per-run records live in ignored `.local/android-tools/rehearsals`.
