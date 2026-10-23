# Mobile web accessibility checklist

Source: [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), checked 2026-10-14. Use the exact criterion and exceptions; check rendered behavior with assistive technology before claiming conformance. `NOT RUN` for proposed UI until implemented.

| Criterion / level | Assertion to check | Status |
| --- | --- | --- |
| [1.3.1 A](https://www.w3.org/TR/WCAG22/#info-and-relationships), [4.1.2 A](https://www.w3.org/TR/WCAG22/#name-role-value) | Labels, table relationships, roles, values and expanded state are exposed | NOT RUN |
| [3.3.1 A](https://www.w3.org/TR/WCAG22/#error-identification), [3.3.2 A](https://www.w3.org/TR/WCAG22/#labels-or-instructions), [4.1.3 AA](https://www.w3.org/TR/WCAG22/#status-messages) | Error identified in text near input; status announced without unnecessary focus move | NOT RUN |
| [2.1.1 A](https://www.w3.org/TR/WCAG22/#keyboard), [2.4.7 AA](https://www.w3.org/TR/WCAG22/#focus-visible), [2.4.11 AA](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum) | Every task works via keyboard; focus visible and not entirely obscured | NOT RUN |
| [1.4.3 AA](https://www.w3.org/TR/WCAG22/#contrast-minimum), [1.4.11 AA](https://www.w3.org/TR/WCAG22/#non-text-contrast) | Normal/large text contrast thresholds and essential non-text indicators checked | NOT RUN |
| [1.4.4 AA](https://www.w3.org/TR/WCAG22/#resize-text), [1.4.10 AA](https://www.w3.org/TR/WCAG22/#reflow) | Resize/reflow without loss; two-dimensional content exception assessed, not assumed | NOT RUN |
| [2.5.7 AA](https://www.w3.org/TR/WCAG22/#dragging-movements), [2.5.8 AA](https://www.w3.org/TR/WCAG22/#target-size-minimum) | Single-pointer alternative to drag unless dragging is essential or an unmodified user-agent control; targets ≥24×24 CSS px or documented spacing/equivalent/inline/user-agent/essential exception | NOT RUN |
| [2.5.5 AAA](https://www.w3.org/TR/WCAG22/#target-size-enhanced) | 44×44 CSS px or AAA exception if AAA is a target; do not label this AA | NOT RUN |

The [playbook](decisions/accessibility.md) gives decision context. A larger-than-required target is a design recommendation, not a separate WCAG rule. Native pt/dp units do not transfer directly to CSS px.

## Representative state audit

For each affected text/primary action/status/error/border/focus pair, record criterion, actual state trigger and oracle, computed paint stack, ratio/threshold and artifact. Treat normal, hover, active, focus, selected, disabled and actual error/warning/success transitions separately. Mark unsupported states with a source reason. Apply inactive/UA/decorative exceptions per criterion; do not exempt enabled selected/error controls.

Check non-color meaning and names independently of contrast. Verify error text associations and real keyboard focus, including clipping/overlap by persistent controls. A scanner's incomplete result is review pending until applicable findings receive a disposition. Missing/unsupported paint measurements are review required, not PASS. A reviewed exception needs its criterion and reason. Use negative probes for low contrast, removed status meaning and hidden focus; assert detection and restored original state. The [verification criteria](verification-criteria.md) define run/source and artifact limits.
