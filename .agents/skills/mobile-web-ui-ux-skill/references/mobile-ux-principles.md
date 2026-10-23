# Mobile Web UX Principles

These are **design heuristics**, not universal mandates.

1. **Task-first hierarchy.** Make the primary job and its next action obvious; secondary content should not crowd it out.
2. **Touch without hover.** Essential functionality must have visible, keyboard- and touch-operable controls, not hover-only affordances.
3. **Browser expectations.** Respect Back, deep linking, scrolling, zoom, focus and address bar behavior.
4. **Responsive content, not just columns.** Tables may need priority fields, disclosures or purposeful horizontal scroll; don't blindly make everything a card.
5. **Keyboard-aware forms.** Use correct input modes, labels, validation and visible submit controls. Fixed buttons can be obscured by mobile keyboards.
6. **Accessible and inclusive.** Use readable text, predictable focus order and generous hit areas; support zoom, reduced motion and long/localized labels.
7. **Action discoverability.** Place frequent actions where users can find them without covering content or creating competing sticky bars.
8. **Progressive disclosure.** De-emphasize optional details while keeping required information obtainable.
9. **Performance is experience.** Minimize blocking JS, unexpected shifts, and interaction delays; avoid expensive decoration that hampers low-end devices.
10. **Web / PWA distinction.** A browser tab and an installed standalone PWA may provide different browser controls; inspect their actual contexts.

## Priority rules

- Fix blocked workflows before aesthetic polish.
- Favor familiar accessible HTML controls unless a custom component materially helps.
- Do not turn every site into a native app lookalike.
- Don't choose a pattern based solely on screen width; include the user's job and data characteristics.

## Evidence requirements

Every material recommendation should cite an observed screen/source behavior or mark itself as a hypothesis to verify. For standards-specific claims (WCAG, browser API support) use current primary references rather than memory alone.

## Visual decisions follow the task

Use the [content hierarchy playbook](decisions/content-hierarchy.md) to choose density and ordering: triage and aligned comparison need different treatment. Reuse typography and spacing tokens while retaining exact labels, dates, amounts and units. Plan the supported loading/empty/error/success states as well as the populated screen.

Use the [accessibility playbook](decisions/accessibility.md) for semantic foreground/background roles and the smallest measured contrast correction. Keep brand recognition, provide meaning beyond color, and distinguish 200% text resize from effective-320 reflow. Neither attractive screenshots nor palette arithmetic alone establish rendered usability.
