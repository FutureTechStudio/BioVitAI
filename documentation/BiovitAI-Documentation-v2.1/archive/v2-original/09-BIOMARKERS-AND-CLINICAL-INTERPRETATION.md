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
