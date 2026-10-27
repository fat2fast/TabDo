# Touch interaction decisions

Prefer visible, labeled controls usable by touch, pointer and keyboard. Keep a gesture as an optional shortcut with an equivalent button or link for a critical task. Use [decision record](../decision-contract.md).

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Small adjacent targets | Increase target or spacing and check accidental taps | Dense controls overlap or target is only icon without name |
| Swipe/drag shortcut | Add visible button or single-pointer alternative | Gesture is the only path or fights page scrolling |
| Hover reveal on desktop | Show a visible trigger on touch and focus | Action exists only on hover |
| Tap triggers asynchronous work | Immediate state feedback and completion/error status | Repeated taps duplicate effects |

[WCAG 2.2 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) is **AA**, 24×24 CSS px with specified spacing/equivalent/inline/user-agent/essential exceptions. [2.5.5](https://www.w3.org/TR/WCAG22/#target-size-enhanced) is **AAA**, 44×44 CSS px with its own exceptions. For frequently used mobile controls, a project can adopt a preferred 44×44 CSS px hit region and measure it at representative widths. Check neighboring target overlap and visible keyboard focus as well as bounding boxes. Larger targets can be a design recommendation; do not present native pt/dp as CSS px or 44px as an AA rule. Test scroll conflicts and keyboard activation.
