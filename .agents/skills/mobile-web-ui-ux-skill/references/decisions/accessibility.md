# Mobile web accessibility decisions

Use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for normative criteria and the [checklist](../accessibility-checklist.md) for assertions. Use the [decision record](../decision-contract.md); do not claim conformance from source review alone.

- **Structure/labels:** associate visible labels and errors, use native buttons/links/tables where semantics fit ([1.3.1 A](https://www.w3.org/TR/WCAG22/#info-and-relationships), [3.3.2 A](https://www.w3.org/TR/WCAG22/#labels-or-instructions), [4.1.2 A](https://www.w3.org/TR/WCAG22/#name-role-value)).
- **Keyboard/focus:** all controls operable by keyboard; focus visible, and the focused component is not entirely hidden by author-created content ([2.1.1 A](https://www.w3.org/TR/WCAG22/#keyboard), [2.4.7 AA](https://www.w3.org/TR/WCAG22/#focus-visible), [2.4.11 AA](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum)). Preserve logical focus entry/return for modal overlays.
- **Text and reflow:** support text resize and single-column reflow except genuinely two-dimensional content ([1.4.4 AA](https://www.w3.org/TR/WCAG22/#resize-text), [1.4.10 AA](https://www.w3.org/TR/WCAG22/#reflow)). Do not discard data to remove scroll.
- **Contrast:** normal text 4.5:1 and large text 3:1 ([1.4.3 AA](https://www.w3.org/TR/WCAG22/#contrast-minimum)); essential control indicators and focus visuals have [1.4.11 AA](https://www.w3.org/TR/WCAG22/#non-text-contrast) conditions.
- **Error/status:** identify an input error in text, announce status without stealing focus, expose expanded state where applicable ([3.3.1 A](https://www.w3.org/TR/WCAG22/#error-identification), [4.1.3 AA](https://www.w3.org/TR/WCAG22/#status-messages), [4.1.2 A](https://www.w3.org/TR/WCAG22/#name-role-value)).
- **Targets:** [2.5.8 AA](https://www.w3.org/TR/WCAG22/#target-size-minimum) requires 24×24 CSS px or one of its exceptions, including spacing; [2.5.5 AAA](https://www.w3.org/TR/WCAG22/#target-size-enhanced) is 44×44 CSS px with different exceptions. Do not map native pt/dp directly to CSS px.

For a target-size exception, state the exact condition and measure the rendered hit areas and neighboring targets before claiming that SC 2.5.8 passes. Words such as "generous spacing" do not establish the required geometry. Passing one criterion is not proof of full WCAG AA conformance. Treat palette contrast and keyboard behavior as `NOT RUN` until tested in the rendered interface.

Apply these constraints to navigation, tables, forms, actions, content, overlays and touch decisions from the start. A horizontal comparison table can be valid under the two-dimensional reflow exception; maintain headers and row identity.

## Semantic color and measured correction

Inspect existing token owners before changing styles. Map roles using project names; illustrative pairs are surface/on-surface, primary/on-primary, error/on-error, success/on-success, warning/on-warning and border/focus-ring against adjacent surfaces. These are roles, not a required new palette or token library.

For each affected pair, record locator, trigger, actual state, computed foreground/background, resolved opacity/ancestor surfaces, threshold, unrounded ratio and disposition. Exercise supported normal, hover, keyboard focus, selected, active, disabled, error, warning and success states; mark unsupported states with a reason. Assert the state before measuring it. Test supported themes only. Resolve alpha and ancestor opacity in paint order; gradients, images, blending or unresolved overlays require focused rendered review or a blocker, never an assumed white background or hex-only PASS.

| Criterion | Applicable threshold and boundary |
| --- | --- |
| [1.4.3 AA](https://www.w3.org/TR/WCAG22/#contrast-minimum) | Normal text ≥4.5:1; large text ≥3:1. Large means at least 18pt (24 CSS px), or 14pt (18⅔ CSS px) bold, or equivalent for CJK fonts. Use actual rendered font size/weight; do not round ratios up. |
| [1.4.11 AA](https://www.w3.org/TR/WCAG22/#non-text-contrast) | ≥3:1 against adjacent colors for visual information needed to identify controls/states and essential graphical objects. A decorative border is not automatically essential. |
| [1.4.1 A](https://www.w3.org/TR/WCAG22/#use-of-color) | Convey status/error/selection beyond color: visible descriptive text or recognizable shape/icon, with accessible semantics. A passing contrast ratio does not establish this criterion. |
| [2.4.7 AA](https://www.w3.org/TR/WCAG22/#focus-visible) | Show keyboard focus. For author-supplied indicators, evaluate the applicable 1.4.11 adjacent-color conditions as well; do not confuse these with the stricter 2.4.13 AAA geometry requirements. |

Apply exceptions per criterion: 1.4.3 excludes incidental text (including inactive controls, decoration, invisible text and incidental text in pictures) and logotypes. Its inactive exception does not cover an enabled selected/hover/error state. Under 1.4.11 inactive controls and controls whose appearance is determined by the user agent without author modification have exceptions; graphical objects have an essential-presentation exception. Disabled text being exempt from a ratio does not waive labels, state meaning or focus rules elsewhere. Record the exact reason rather than exempting all non-default states. See [W3C non-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

For a measured failing pair, try the smallest scoped foreground/on-color or surface correction first. Preserve brand primary when a suitable on-color works; adjust the owning token only after checking its consumers and supported states/themes. Do not globally replace a brand palette to fix one badge. Repeat the same rendered check and desktop/state regression checks after the patch. Color-only errors need text/semantics even when their colors pass. Automated scans cover detectable issues only; unresolved review is not PASS or full WCAG conformance.
