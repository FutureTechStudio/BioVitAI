# Biomarkers and Interpretation

## Principle
Lab-provided reference intervals and reviewed clinical rules are distinct. An out-of-range value is not a diagnosis. A within-range value does not prove that an organ or person is healthy.

## Supported first-pass domains
Glucose/HbA1c, lipid panel, kidney-related markers, liver-related markers, complete blood count, thyroid markers, and BP readings. Add tests through reviewed definitions and mapping.

## Analysis pipeline
1. Validate measurement identity, date, unit and source.
2. Resolve the applicable reference interval.
3. Evaluate deterministic numeric flags.
4. Evaluate trend comparability.
5. Run versioned, clinically reviewed multi-marker rules.
6. Attach limitations, coverage and sources.
7. Render plain-language explanation.

## Safety
No standalone diagnosis, medication advice, invented risk score or unreviewed clinical thresholds. Route urgent symptom language to an approved safety response and appropriate medical help guidance.

## Governance
Each rule records clinical owner, rationale, evidence references, jurisdiction, effective date, test coverage, version and approval state.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** No unreviewed algorithm may diagnose or calculate a generic organ-health percentage. FHIR/LOINC/UCUM-aligned concepts support careful normalization; clinically meaningful composite calculations require a versioned approved rule.

**Related v2.1 requirements:**
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
