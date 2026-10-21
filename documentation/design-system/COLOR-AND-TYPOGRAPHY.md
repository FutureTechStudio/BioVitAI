# Colors and typography

The source of truth is `shared/design-tokens/src/index.ts`; `tools/bioflow-tokens.mjs` generates the web CSS adapter. Native interfaces consume the same values. Run the generator after editing tokens; `--check` detects drift.

The owner-requested refinement uses green for brand/wellness, blue for analytical evidence, amber/coral for review or attention states, and restrained violet for the assistant. White and mist surfaces remain dominant. Bright accent tokens are decorative; dark green, blueInk, warning, coralInk and violetInk provide readable foregrounds. Organ accents identify regions, never a clinical assessment. No organ interpretation is active.

Manrope is bundled locally with the SIL Open Font License. Web uses the variable font; Android uses static 400/500/600/700 instances generated from that font. No runtime Google Fonts request is made. Use 28–34px page headings, 18–22px section headings, 14–15px body text and tabular numerals for measurements. Native text respects system scaling.

Use the 4/8px spacing scale, 18px cards, 12px controls and 160–220ms transitions. Focus indicators are high-contrast teal; reduced motion disables animation and transitions.
