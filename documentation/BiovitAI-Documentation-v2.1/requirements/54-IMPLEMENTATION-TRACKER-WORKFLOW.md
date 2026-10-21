# 54 — Development tracker and execution workflow
Status: Active planning template · Owner: Engineering PM / Tech Lead

## Canonical task fields
`ID`, `Phase`, `Workstream`, `Title`, `Description`, `Owner Role`, `Priority`, `Estimate Days`, `Dependencies`, `Status`, `Acceptance Criteria`, `Deliverable`, `Release Gate`, `Risk Level`, `Notes`.

## Status lifecycle
`Backlog → Ready → In Progress → In Review → Done` or `Blocked`. `Done` requires PR, tests and evidence; phase gate is separate. No task is assumed complete merely because its spec exists.

## Priorities
`P0` = blocker/safety-critical; `P1` = essential to targeted module milestone; `P2` = can follow. Dates are not commitments. Unassigned individuals are role placeholders, not actual assignments.

## Tracker files
- `tracker/BiovitAI_v2_1_Development_Tracker.csv`: GitHub Project/Linear/Excel import and source-of-truth task IDs.
- `tracker/BiovitAI_v2_1_Roadmap.csv`: phase/weekly planning view.
- `tracker/BiovitAI_v2_1_Decision_Log.csv`: unresolved decisions, owners and due gates.
- `BiovitAI_v2_1_Development_Tracker.xlsx`: formatted workbook with Dashboard, Tasks, Phases, Decisions, Dependencies.

## Sprint routine
Weekly dependency triage, biweekly demo/gate review, monthly safety/clinical review. A task can be parallelized if dependencies are satisfied; never mark `Done` without source-linked evidence and tests. Track defects as separate linked tasks instead of hiding them under milestone acceptance.

## GitHub usage
Prefer one PR with these additive MDs plus tracker for review, then implement in task-sized PRs. If a connected BiovitAI repository becomes available, map tasks to GitHub Issues with labels `phase:P*`, `area:*`, `priority:P*`; do not bulk-create issues in unrelated repositories. Version documentation alongside code, and update tracker status from issue state rather than maintaining divergent copies.
