# Open Decisions and Reference Work

## Product decisions
- Initial launch jurisdiction and language(s).
- Whether adult profiles can be managed before independent email verification and what legal consent model applies.
- Which lab panels and biomarker codes ship first.
- Supported report formats and labs.
- Which organ views have clinically meaningful evidence.
- Whether caregiver roles can edit manual entries.
- Which device ecosystems ship first.
- Whether chat history is retained by default.

## Engineering decisions
- Web/mobile stack and shared UI strategy.
- Identity provider and MFA requirements.
- Cloud region and data residency.
- OCR/extraction vendor and verification workflow.
- LLM provider and data processing terms.
- Queue, storage, cache and observability platforms.
- Report comparison cache invalidation.
- Model routing, fallback and budget policy.

## Clinical and compliance decisions
- Intended medical use and regulatory classification.
- Clinical advisory/review process.
- Reviewed marker mappings and reference interval policy.
- Multi-marker rule approval and change management.
- Escalation wording and urgent-symptom policy.
- Medical content and patient data retention.
- Security, privacy, incident and breach-response procedures.

## Standards and source material to evaluate
HL7 FHIR Observation and DiagnosticReport resources; LOINC for lab test identifiers; UCUM for units; OAuth/OIDC for authentication; OWASP ASVS and API Security guidance; WCAG accessibility guidance; relevant national privacy and health-data regulations.

Do not assume any named standard automatically guarantees compliance. Validate applicability and licensing.

## Next artifact recommendations
OpenAPI specification, database migrations, TypeScript tool contracts, sequence diagrams, clinician-reviewed synthetic fixtures, Figma design system and engineering tickets.

## Version history
v2.0 — BiovitAI naming, web/mobile profile and organ evidence views, email-linked family access, complete AI chat/tool orchestration architecture, context manifest, report comparison, analytics, structured response blocks, safety, tests, costs and build plan.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Use the v2.1 decision log and architecture ADR process to close unresolved clinical scope, UAE regulatory claims, data residency, provider choice, notifications, language, moderation and longitudinal outcome thresholds before relevant release gates.

**Related v2.1 requirements:**
- [55-DECISIONS-RISKS-AND-DEPENDENCIES](55-DECISIONS-RISKS-AND-DEPENDENCIES.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
