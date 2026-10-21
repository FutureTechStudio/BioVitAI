# Component standards

Web primitives live in `apps/web/src/design-system.tsx`; native primitives live in `apps/mobile/src/design-system.tsx` and `action.tsx`. Shared tokens and vector geometry are presentation-only and import no domain implementations.

Use BioCard, StatusBadge, Icon, EmptyState, LoadingSkeleton and SideDrawer rather than independent surface implementations. Native BioText selects the appropriate bundled Manrope weight; Field and Action retain input and button semantics with consistent sizing.

HealthDashboard composes actual report counts, BodyInsights and BiomarkerInsights. Reuse TrendSparkline for numerical trends; always provide exact dates, values and provenance outside the chart. ReportCenter retains all verification actions and supports focused report/insight views. Domain-specific forms keep their existing validation, idempotency and expected-revision fields.

Drawers use native browser modal dialogs with Escape, focus containment and focus restoration. Native overlays use Modal and explicit close/back handling. Loading, empty, failed, disabled, unavailable and permission-denied are distinct states, not different wording for a single blank panel.

Do not build unused Wellness or Community components to imply missing services are operational. Register planned patterns separately until a functional implementation exists.
