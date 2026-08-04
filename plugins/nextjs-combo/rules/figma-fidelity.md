# Figma fidelity rules

Applies to every change implemented from a Figma design. These are constraints, not
suggestions — an implementation that violates one is wrong even if it looks fine.

## 1. The design is the source of truth, not your reading of it

Never implement from memory of a payload, a summary, or a screenshot description. Every
value you write must be traceable to a Figma spec line: `get_design_context`,
`get_variable_defs`, or an explicit human decision recorded in the mapping file.

If a value is not in the spec, it is a **gap**. Stop and ask. Do not pick a plausible one.

## 2. Assets are files, never generated

- Never hand-write SVG path data for an icon, logo or illustration.
- Never substitute a glyph from `lucide`, `heroicons`, `react-icons`, Material Symbols,
  Font Awesome, or any icon package, unless the project already uses that package **and**
  the mapping file records the substitution as approved.
- Never add a new icon or image dependency to satisfy a design.
- Never emit a placeholder shape (`<rect>`, coloured div, emoji) in place of an asset.

Every asset comes from the Figma MCP asset endpoint via `figma-asset-fetcher`, or it is
reported as unresolved with an export link. Unresolved is an acceptable outcome. Invented
is not.

## 3. No invented values

The following are guessed constantly and must always come from the spec:

| Category | Must match exactly |
|---|---|
| Typography | family, size, weight, line-height, letter-spacing |
| Colour | fill, text, border, and background — including alpha |
| Background | solid vs gradient, gradient stops and angle, image fills |
| Border | width, colour, style, and each corner radius separately |
| Spacing | padding per side, gap, margin, and fixed vs hug vs fill sizing |
| Effects | shadow offset/blur/spread/colour, blur, opacity |

Rounding a value to a "nicer" number is a defect. `padding: 14px` does not become `16px`
because the scale would prefer it.

## 4. Design tokens: reuse, but never absorb a visible delta

Prefer the project's token when its resolved value equals the Figma value. When they
differ:

- delta ≤ 1px, or a colour delta under ~1% per channel → use the project token,
- anything visible → the design wins, and the conflict is recorded for a human to rule on.

A token whose *name* matches but whose *value* differs is the most common way a design
silently drifts. Compare values, not names.

## 5. Reuse components before building them

Check the project's component library and the Code Connect map first. Extend an existing
component with a new variant rather than creating a parallel one. A second `Button` is a
worse outcome than a slightly awkward variant prop.

## 6. Verify before claiming done

A Figma-driven UI change is not complete until `figma-visual-verifier` returns `PASS`.
`FAIL` with open blockers or majors means the work continues. Never self-certify parity by
re-reading your own code.

## 7. When the design is unclear, stop

Say what is missing, give the Figma node link, and ask for a screenshot or a decision.
Blocking on a question costs minutes. Shipping a guess costs a review cycle and usually
survives it.
