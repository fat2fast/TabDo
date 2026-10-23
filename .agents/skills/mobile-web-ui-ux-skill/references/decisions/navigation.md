# Navigation decisions

Choose by route structure and switching frequency; retain existing URLs and permissions.

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Three to five stable peer destinations used repeatedly | Bottom navigation reduces switching cost | Deep hierarchy, many routes, form keyboard or another bottom control competes |
| Many grouped destinations used occasionally | Labeled menu/drawer keeps route tree intact | Frequent top tasks disappear inside it; expose those separately |
| Two to four sibling views within a route | Local tabs expose peer views and active state | Views are unrelated or tab switch would silently discard work |
| Focused flow or nested detail | Contextual action plus explicit Back/breadcrumb | It conceals a required global destination or replaces browser history |
| Access-controlled routes | Filter entries using existing authorization result | UI-only hiding is mistaken for access control |

A narrow persistent sidebar that squeezes a record list is a symptom, not a fixed breakpoint rule. Compare a compact header with an accessible drawer, a retained sidebar with adequate content width, and other project navigation. When using a drawer, preserve every permitted route, close by button/Escape/outside click, contain background interaction, return focus, and close it if a viewport change restores desktop navigation. Keep a persistent sidebar when it leaves the primary task comfortably usable. Test at both sides of the project's actual breakpoint.

For each choice, record [evidence, task, candidates, selected, rejected, preserved, verify](../decision-contract.md). Keep direct URLs and browser Back, active/current state, focus on route changes, and all permitted destinations. Test direct deep link, Back after details, keyboard traversal and restricted roles when the actual auth system is available. Do not invent auth for a fixture.
