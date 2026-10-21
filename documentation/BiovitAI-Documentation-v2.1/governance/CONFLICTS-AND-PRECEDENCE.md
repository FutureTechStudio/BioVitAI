# Conflict resolution and document precedence

This document resolves **which requirements to follow when original V2 and added v2.1 text overlap**. Original V2 text is preserved as history. A new requirement is not silently applied merely because a document has a larger file number: the controls below make the intended precedence explicit, subject to review/approval.

| Area | V2 baseline | Consolidated v2.1 decision | Reference |
|---|---|---|---|
| Product identity | Health/family information first | **Wellness-first** with Health evidence and separately moderated Community | 01, 44–46 |
| Main navigation | Report/body/health feature views | **Three explicit tabs**, shared profile picker and AI assistant | 21, 25, 44, 58 |
| Lifestyle goals | Basic proposed→accepted→check-in | Reviewed actions, barrier-aware adaptation, optional check-ins and non-punitive lapse recovery | 13–15, 45 |
| AI architecture | Orchestrator and backend tools | **Central AI Gateway** owns all model/provider interactions and safeguards; data/permissions in domain services | 19, 27–30, 47, 48, 57 |
| Deployment | Services suggested; technology choices flexible | **Modular monolith first** with extraction-ready boundaries; not premature microservices | 19, 47, 50 |
| Clinical report values | Verified observations, comparisons | Atomic source observations + grouping + carefully selected/derived results and provenance, no naive averaging | 05–09, 31, 40, 56 |
| Organ UI | Evidence-based body map | Evidence layer distinct from Wellness Factors; unknown is not healthy | 10, 11, 44, 56, 58 |
| Community | Not in V2 baseline | Curated read-only first; moderated posting later, separated identity and PHI boundary | 46, 52 |
| Roadmap | Old prioritization called P0–P4 | **Nine program phases P0–P8**, 31 weeks *illustrative*, 51 tasks in tracker | 24, 39, 51, 54 |
| AI trust | Guardrailed chat | Per-task typed tool permissions, prompt injection tests, bounded structured outputs and no community→clinical evidence promotion | 28–37, 48, 52, 53, 57 |
| Location and language | Locale baseline TBD | Plan for Abu Dhabi/Arabic+English, but **regulatory compliance and hosting region require explicit legal/product decisions** | 22, 52, 55, 58 |

**How to read:** For each area above, implement the v2.1 consolidated decision unless it is subsequently superseded by an approved versioned ADR. V2 acceptance criteria **continue to apply** unless the later requirement explicitly tightens or replaces them. Do not apply the obsolete P0–P4 program phase numbering to new development tasks. Maintain traceability in the task tracker.
