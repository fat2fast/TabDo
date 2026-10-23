# Overlay decisions

Choose an overlay only when it keeps the parent task understandable. Use [decision record](../decision-contract.md).

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Brief confirmation or alert | Modal dialog | Content is long or task needs route/history |
| Medium contextual choices | Drawer or sheet with explicit close | Height/keyboard leaves too little working area |
| Long form, complex editing, deep link | Full page with stable URL and Back | Interrupting flow would be disproportionate for a brief choice |

For modal overlays, move focus inside on open, contain tab focus while modal, provide Escape and visible Close/Cancel, restore focus to trigger on close, and prevent background interaction/scroll. For a page, browser Back and direct URL must work. Account for viewport, safe area, keyboard and stacking without obscuring controls. Do not assume every mobile task needs a bottom sheet.
