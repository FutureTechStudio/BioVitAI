# 46 — Community & Trends | Tab 3
Status: Scoped for later phase; design early, release after moderation readiness · Owner: Community + Trust & Safety

## Purpose and content tiers
1. **Reviewed educational articles**: independently sourced and editorially reviewed, dated, evidence grade and review-by date.
2. **Verified professional posts**: verified credential AND clear caveat that a post is general information, not personalized medical advice; verify credential regularly.
3. **Community discussion**: unverified user-generated experiences. Explicit `Community opinion` label; no implicit clinical endorsement.
4. **Medical news/trends**: summarize only identified authoritative sources, link to original, publish/updated dates, distinction between preliminary study and clinical guidance.

## MVP → expansion
- **Initial read-only release:** curated medically reviewed articles, source links, search/filter, saved content, clear dates, report misinformation. Minimal sharing surfaces.
- **Moderated posting beta:** verified accounts, report/block tools, spam and harmful-advice detection via review workflow, human appeals, rate limits, author labels.
- **Future:** opt-in peer groups, optional discussions, multilingual creators, community challenges governed by safety/privacy.

## Untrusted-content and AI firewall
Posts are **never** trusted as medical source-of-truth, and cannot update medical evidence, safe-action rules, or health recommendations. Community moderation AI may classify/triage content via AI Gateway, but high-impact moderation needs human adjudication and an appeal trail. Prompt injection inside posts is treated as inert data.

## Privacy and moderation controls
- Community public identity separate from family/health profile identity; no health info auto-published.
- Sensitive user stories must show disclosure warning and a removable draft preview.
- PII/PHI redaction suggestions plus detection do not substitute for user control.
- Block personal diagnosis, emergency misinformation, self-harm encouragement, deceptive product promotion, spam, harassment, identifiable patient info without proper authority.
- Content policy, reviewer SLA, escalation, sanctions, appeals, records and retention must be approved before user posting is enabled.
- Underage account strategy and jurisdiction-specific rules require legal decision before launch.

## Acceptance criteria
- Read-only feed usable while posting is feature-flagged off.
- Every medical trend carries source URL, publish date, author/source identity and content classification.
- Community read/write APIs have independent authorization and moderation checks.
- No family report or health-context data leaves Health through Community endpoints.
- Test dataset proves injection instructions embedded in a post cannot execute agent tools.
