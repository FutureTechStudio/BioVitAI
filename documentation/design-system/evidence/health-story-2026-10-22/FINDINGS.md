# Health Story rehearsal findings

22 October 2026. Synthetic local evidence; engineering severity applies to the exercised journey, not clinical risk.

| Finding | Severity | Resolution and recheck |
| --- | --- | --- |
| Native modal actions sat under the status bar and could not receive taps. | 2 | Device safe-area insets replace fixed padding in editor/history. Creation, keyboard dismissal, correction and closing history passed. |
| Thick source-region borders obscured text on small page images. | 2 | Outside outlines on web/native; source screenshots and a zero-violation web source audit inspected. Android zoom and pan expose the original text. |
| Resetting zoom retained the previous horizontal offset, leaving a partial/blank page. | 2 | A profile-scoped scroll ref resets to x=0 when zoom changes. The follow-up rehearsal asserts full-page image bounds after reset. |
| Mobile upload icon lacked an accessible name; source links had small touch targets. | 3 | Named upload link and 44px source actions; populated responsive Axe audits pass. |

The Android driver also accounts for the installed debug double-R shortcut, waits for updated bounds and scrolls to controls below the fold. These are test-driver changes, not clinical behavior. Full native and focused source rehearsals passed after the fixes. Earlier diagnostic logs/screenshots remain in the ignored local test workspace. Manual screen-reader/TalkBack, native RTL, physical-device/iOS and participant acceptance remain separate.
