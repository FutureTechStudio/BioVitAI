# Colors and typography

The source of truth is `shared/design-tokens/src/index.ts`; `tools/bioflow-tokens.mjs` generates the web CSS adapter. Native interfaces consume the same values. Run the generator after editing tokens; `--check` detects drift.

The approved canvas, mint, pearl, deep teal, celadon, aqua, green, analytical blue, navy and border palette is preserved. Slate, warning, error and neutral foregrounds are darkened for readable text on pale surfaces. Natural green is a decorative/progress token, never an automatic clinical assessment. No organ interpretation is active.

Manrope is bundled locally with the SIL Open Font License. Web uses the variable font; Android uses static 400/500/600/700 instances generated from that font. No runtime Google Fonts request is made. Use 28–34px page headings, 18–22px section headings, 14–15px body text and tabular numerals for measurements. Native text respects system scaling.

Use the 4/8px spacing scale, 18px cards, 12px controls and 160–220ms transitions. Focus indicators are high-contrast teal; reduced motion disables animation and transitions.
