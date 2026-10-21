# Interaction and accessibility

Target WCAG 2.2 AA: visible focus, keyboard-accessible navigation and body controls, labeled fields, error/status announcements, non-color status labels and exact-value chart alternatives. Use at least 44px web primary controls and 48px native buttons; provide sufficient pointer hit areas.

The selected profile stays visible. A profile change, permission loss or session reset clears all private data, search state, source images, modal details and AI context through the existing publication/cancellation guards. Component-local state must remount on profile ID/context revision changes.

Global search uses authorized report names and verified biomarker labels. Search is explicit; keystrokes do not dispatch AI. Never place medical search text in public URLs or analytics. Citations remain permission-checked source links; AI output remains structured text, not arbitrary HTML.

Authentication, consent, corrections and unavailable-provider states preserve existing behavior. User contact email is not account authorization. Permission failures cannot silently select another family member.
