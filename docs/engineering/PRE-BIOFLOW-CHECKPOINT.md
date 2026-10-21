# Pre-BioFlow checkpoint

Recorded 21 October 2026 before any BioFlow implementation changes.

- `npm run check`: passed formatting, lint, architecture gates, web/native type checks and 51 core tests.
- `npm run test:db`: 59 tests passed using isolated PostgreSQL databases. The first sandboxed attempt failed during Windows user lookup before application tests; the permitted unsandboxed rerun passed.
- `npm run build:web`: optimized production build passed for all existing routes.
- Existing browser and Android rehearsal evidence remains in `docs/pilot/REHEARSAL.md`; those journeys were not rerun for this checkpoint.
- Proposed source files were checked for common private-key, GitHub-token, OpenAI-key and AWS-key patterns; none were found. Local environments, databases, objects, mail captures, demo-account records and build outputs are ignored.

This checkpoint preserves engineering progress and synthetic demo tooling. It does not change formal review statuses, claim clinical approval, configure live AI, or represent participant research or iOS validation.
