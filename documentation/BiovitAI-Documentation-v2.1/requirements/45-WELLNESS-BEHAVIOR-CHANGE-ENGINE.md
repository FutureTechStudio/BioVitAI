# 45 — Wellness behavior-change engine | Tab 2
Status: Proposed / clinical-content review required · Owner: Wellness + Clinical Advisor

## Intended outcomes
Start, maintain, **recover**, and sustain user-chosen movement, sleep, nutrition, tobacco cessation support, and recovery/stress behaviors. Prioritize 3/6/12-month persistence, user wellbeing, and equitable outcomes over streak length or app opens.

## Adaptive loop
**Understand → Choose → Act → Observe → Learn → Adapt → Recover → Sustain**. Behavior stages: Explore, Start, Stabilize, Maintain, At-risk, Lapse, Recover, Sustain. States reflect self-report and context, not inferred psychological diagnoses. Missing app usage must never automatically count as failed behavior.

## Module split
- **Wellness Profile:** preferred language, work pattern, disability/accessibility options, sleep anchor, interests, participation preferences; sensitive fields optional.
- **Baseline & Barrier Assessment:** recent routines, readiness, practical constraints, confidence; COM-B categories are internal support-selection hints, not labels attached to people.
- **Goal Service:** user-selected goal, target and frequency, start/pause/end, goal history.
- **Reviewed Action Catalogue:** versioned, human-reviewed actions with minimum/normal/fallback variants, safe eligibility and exclusions, evidence tier, language, contraindication review, expiry/review date.
- **Plan Engine:** selects available actions from catalogue through deterministic eligibility and rules; limits daily burden; user must accept.
- **Check-in Service:** optional, low-burden completion, difficulty, energy, barriers, opt-out/skip; sources tagged as manual/device/self-report.
- **Adaptation Engine:** modifies timing, action size, cue, communication channel after consented signals; never auto-escalates exercise or dietary restrictions from lab values alone.
- **Recovery Service:** after disruption, invites a neutral check-in and a smaller restart; never deletes completed history or resets meaningful achievements.
- **Outcomes & Experimentation:** 7-day and sustained outcomes, disaggregated equity/retention, message burden, intervention exposure, opt-outs.

## Plan-selection algorithm (normative)
1. Authorize active profile; load consent, preferences and relevant verified health context through typed services.
2. Filter action catalogue for reviewed+active actions, user interests, language/accessibility, known exclusions, timing/work/heat constraints; block clinical-uncertain actions for review.
3. If red flag/pain/illness/other safety trigger, pause unsafe action and route to configured safe response/referral; do not diagnose.
4. Rank only eligible actions using baseline, user preference, opportunity/barriers, recent response, burden budget; explain *why* and permit user edits.
5. Offer minimum/standard/fallback choices; obtain explicit user selection; store policy version, decision reasons, catalogue version.
6. Record outcomes without punishing omissions; use check-ins and source-quality flags; detect likely barriers rather than blaming motivation.
7. On lapse, ask what changed (with Skip option); lower the burden, change cue or pause. Preserve achievement and recovery history separately.
8. Reassess weekly; cap reminders, respect quiet hours, consent and withdrawal, and do not infer a lapse solely from missing data.

## Example reviewed micro-action schema
```json
{
  "action_id":"movement-after-first-meal",
  "catalog_version":"1.0.0",
  "domain":"movement",
  "eligibility_policy_id":"movement-basic-v1",
  "review_status":"approved",
  "review_due_at":null,
  "variants":{"minimum":"approved_small_action","normal":"approved_standard_action","fallback":"approved_indoor_or_low_burden_action"},
  "trigger":"after_first_meal",
  "barrier_tags":["time","heat","forgetting"],
  "source_evidence_refs":[],
  "requires_user_acceptance":true,
  "prohibited_if":["configured_safety_red_flag"]
}
```
Actual instructional text must be evidence-reviewed and localized. This schema illustrates structure; it is not clinical advice.

## User protections
- No hardcoded “10,000 steps for everyone,” no universal 21-day habit promise, no shame wording, no punitive streak reset.
- Ramadan/fasting mode **opt-in**, never inferred from religion or name; shift workers use wake/sleep/meal-relative cues.
- Heat-aware and ability-aware alternatives must pass safety and accessibility review.
- User can pause coaching, snooze prompts, revoke device access, delete goal data, or request plain-language explanation.
- Smoking-cessation support is supportive/educational and must not replace qualified treatment; medication advice stays out of scope.

## Acceptance / metrics
- First goal is chosen by the user and includes feasible minimum action.
- Every action shown maps to approved catalogue content and eligibility decision trace.
- Lapse recovery preserves historical completion and avoids automatic escalation.
- User can disable prompts independently of health tracking.
- Pilot measures action completion, recovery-within-X-days, burden complaints, 3-month sustained behavior, subgroup gaps and data missingness; formal thresholds to be set before pilot.

## Existing v2 docs to reconcile
`13-LIFESTYLE-PLANS-AND-PROGRESS.md`, `14-DEVICES-AND-MANUAL-ENTRY.md`, `15-NOTIFICATIONS-AND-REMINDERS.md`, `27-AI-CHAT-PRODUCT-REQUIREMENTS.md`, `32-CLINICAL-ANALYTICS-AND-PATTERN-RULES.md`.
