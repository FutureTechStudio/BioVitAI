# Adoption instructions

1. Back up any live `documentation` and source-code changes before replacing files.
2. Extract this ZIP inside `G:\APPS\BiovitAI\documentation\`; it creates a **new sibling folder**, avoiding overwrites.
3. Read `README.md`, `governance/CONFLICTS-AND-PRECEDENCE.md` and `governance/V2-TO-V2_1-RECONCILIATION-MAP.md`.
4. Use `requirements/00`–`59` as the **working baseline**. The originals 00–43 are preserved byte-for-byte under `archive/v2-original/`.
5. Use `project-management/BiovitAI_v2_1_Development_Tracker.xlsx` as your planning board. All statuses are Backlog; update when work actually happens. The roadmap is indicative, not a promise.
6. If adopting in Git, create a branch and commit the documentation package; use an approved pull request to review architecture, clinical review gates, security and regional obligations.
7. Decide open issues listed in `requirements/55` and `project-management/BiovitAI_v2_1_Decision_Log.csv` before features that depend on them.
8. Keep separate external research DOCXs next to the documentation package or in a dedicated local `research/` folder. This ZIP does not contain those DOCXs.

## Automated spot-check commands

PowerShell:
```powershell
$root = 'G:\APPS\BiovitAI\documentation\BiovitAI-Documentation-v2.1'
(Get-ChildItem "$root\requirements" -Filter '*.md').Count  # expect 60
(Get-ChildItem "$root\archive\v2-original" -Filter '*.md').Count  # expect 44
Get-ChildItem "$root\project-management"
```

Python: `python tools/validate_package.py` (run from this folder). The validator compares original hashes with `governance/MANIFEST.json` and checks that all original bodies survive in the amended files.
