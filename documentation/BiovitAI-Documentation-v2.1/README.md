# BiovitAI — Consolidated Documentation v2.1

**Prepared:** 20 October 2026  
**Status:** Requirements baseline for product/engineering review, **not** a claim of implementation, clinical validation or production clearance.

## What changed

This archive is the **consolidated** package built from the actual supplied `BiovitAI-Requirements-v2.zip` and `BiovitAI_v2_1_MD_and_Development_Tracker.zip`.

- **44 original V2 Markdown files (`00`–`43`) are present in `requirements/`**, each with its full original V2 body intact and a clearly delimited **v2.1 integration amendment** at the end.
- **16 new v2.1 requirement files (`44`–`59`)** are alongside the V2 files in `requirements/`.
- **Exact-byte originals** are also stored in `archive/v2-original/` for comparison/rollback.
- **51 development tasks**, nine phases (P0–P8), tracker workbook, CSV/JSON, roadmap and decision log are in `project-management/`.
- `governance/` contains the merge matrix, file provenance manifest, changelog, validation report and adoption instructions.
- No application source code or GitHub repository was modified.

## Authoritative reading order

1. `requirements/00-README.md` — historic product/AI baseline plus v2.1 amendment.
2. `requirements/44-PRODUCT-ARCHITECTURE-AND-NAVIGATION.md` — all three tabs.
3. `requirements/45-WELLNESS-BEHAVIOR-CHANGE-ENGINE.md` — adaptive, reviewed behavior loop.
4. `requirements/47-MODULAR-ARCHITECTURE-AND-BOUNDARIES.md` and `48-AI-GATEWAY-AND-AGENT-SERVICES.md` — service boundaries.
5. `requirements/56-OBSERVATION-PROVENANCE-AND-AGGREGATION.md` — source/final/derived result traceability.
6. `requirements/51-PHASED-ROADMAP-AND-GATES.md`, `project-management/BiovitAI_v2_1_Development_Tracker.xlsx` — delivery.
7. `governance/CONFLICTS-AND-PRECEDENCE.md` — explicit resolution of overlaps.

## Product shape

**Tab 1: My Health** — trustworthy multi-report evidence, human verification, family access, biomarker trends, condition/device tracking, bounded AI explanation.  
**Tab 2: My Wellness** — user-chosen goals, barriers, reviewed micro-actions, check-ins, adaptation, lapse recovery and longitudinal outcomes.  
**Tab 3: Community & Trends** — reviewed health information and separately moderated social participation, with no implied access to medical records.

## Non-negotiable architecture

Web/Mobile → API/BFF → Health/Wellness/Community services; an AI Orchestrator invokes permission-checked typed tools for data and the **AI Gateway** for provider/model tasks. Neither AI agents nor clients query another domain's database or call a provider directly. Deterministic clinical computation and Wellness safety/eligibility belong to tested domain services, not model prompts.

## Adoption in your project

Extract into `G:\APPS\BiovitAI\documentation\` (the ZIP creates a `BiovitAI-Documentation-v2.1` folder). Review `governance/ADOPTION-INSTRUCTIONS.md` before replacing any already-present docs. The workbook is a **planning baseline**: the 31-week schedule is illustrative and all 51 tasks start Backlog.

## Safety and governance

Medical interpretation, regulatory classification/claims, regional data processing, consent, moderation, Arabic/English localization, and security controls must receive appropriate specialist and stakeholder approval. Do not treat these documents as a regulatory authorization or a clinical protocol.
