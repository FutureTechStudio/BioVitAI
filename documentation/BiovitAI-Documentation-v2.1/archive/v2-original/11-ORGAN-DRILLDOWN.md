# Organ Drill-Down

## Initial views
Heart/cardiovascular, kidneys, liver, pancreas/metabolic, thyroid, brain/neurologic evidence and lungs/respiratory evidence where data exists.

## Each organ page
Title; evidence status; data coverage; relevant verified markers; source-linked trends; tracked conditions; explanatory limitations; related report links; "Ask BiovitAI" shortcut.

## Important distinctions
A kidney page may show creatinine and eGFR trends, but it cannot conclude overall kidney health without adequate context. A brain or lung page should remain "Not assessed" when no appropriate evidence exists.

## Model
organ_evidence(profile_id, organ_code, status, coverage, observation_ids, rule_version, generated_at, limitations).

## Acceptance
Every organ conclusion links to observations or an explicit absence-of-evidence statement. Users can inspect exactly which measurements caused a status.
