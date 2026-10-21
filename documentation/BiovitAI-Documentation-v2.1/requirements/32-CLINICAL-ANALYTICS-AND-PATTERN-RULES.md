# Clinical Analytics and Multi-Marker Rules

## Principle
The clinical analytics engine, not the LLM, computes numeric findings and reviewed clinical patterns. The AI explains only returned, supported findings.

## Three layers
A. Raw evidence: verified observations and original source pages.
B. Deterministic analytics: normalization, comparability, ranges, trends, reviewed multi-marker rules.
C. Language generation: explanation, prioritization for readability, uncertainty and follow-up questions.

## Rule object

    {
      "rule_id": "lipid_panel_pattern_v1",
      "version": "1.0.0",
      "status": "approved",
      "required_markers": ["ldl", "hdl", "triglycerides"],
      "optional_markers": ["total_cholesterol"],
      "required_context": ["age_context_if_relevant"],
      "evaluation_function": "server_side_reviewed_code",
      "output": {
        "finding_code": "pattern_for_review",
        "severity": "informational",
        "evidence_observation_ids": [],
        "limitations": []
      },
      "clinical_owner": "reviewed by named qualified reviewer",
      "approved_at": null
    }

This is a schema illustration, not an approved medical rule.

## Rule engine requirements
- Versioned, reviewed and testable.
- No execution of model-generated code.
- Explicit required inputs and missingness.
- Unit and specimen compatibility checks.
- Lab-specific reference interval handling.
- No unapproved risk scoring or diagnostic claims.
- Every output carries supporting observation IDs, rule ID and version.
- Recompute affected insights when source data or rules change.
- Keep withdrawn rules auditable.

## Coverage
Use statuses: enough evidence for this narrow finding; limited evidence; not assessed; conflicting evidence; pending verification. Avoid global "healthy/unhealthy" organ labels.

## Multi-marker example
If HbA1c, fasting glucose and lipid markers coexist, the engine may return separate reviewed trend findings and contextual notes. The model must not invent a syndrome or treatment recommendation from their co-occurrence.

## Human governance
Clinical review board approves rules, language templates, urgent thresholds and exclusions. Test rules on synthetic and consented de-identified datasets as appropriate. Document population applicability and limitations.

## Acceptance
If a required marker is missing, a multi-marker rule returns "insufficient evidence" rather than inferring the missing result.


---

<!-- BIOVITAI_V2_1_INTEGRATION_AMENDMENT -->
## V2.1 integration amendment (20 October 2026)

> This clearly marked section extends the unchanged V2 requirement above. For explicitly overlapping rules, follow the v2.1 decision and the consolidated precedence guide. Clinical/privacy/legal decisions still require review.

**Implementation refinement:** Deterministic, clinically reviewed analysis remains the source for comparative patterns. Wellness services may consume authorized summarized findings but never derive a diagnosis or unsafe action directly from a generative model.

**Related v2.1 requirements:**
- [45-WELLNESS-BEHAVIOR-CHANGE-ENGINE](45-WELLNESS-BEHAVIOR-CHANGE-ENGINE.md)
- [56-OBSERVATION-PROVENANCE-AND-AGGREGATION](56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md)

**Program references:** [Phase roadmap](51-PHASED-ROADMAP-AND-GATES.md) · [Review and release gates](53-TESTING-EVALUATION-AND-OUTCOMES.md)
