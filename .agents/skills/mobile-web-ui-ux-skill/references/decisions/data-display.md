# Dense data decisions

First identify whether users scan records, compare columns, filter, or act on a selection. Inventory identity, mandatory fields, sorting, filtering, export, bulk actions and per-record permissions before changing presentation.

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Scan individual records | Mobile list or cards with labeled details; identity and task-required existing metadata/actions visible without horizontal scroll | Side-by-side comparison or dense bulk editing dominates |
| Aligned cross-record comparison | Horizontal semantic table with visible pinned row identity, intact units, and explicit scroll cues | Context or actions disappear without a recovery path, or converting to cards destroys cross-metric alignment |
| Dense table with a few mobile priorities | Priority summary list plus full details route for secondary fields | Any mandatory field or action becomes unreachable |
| Filter-heavy workflow | Compact filter panel with visible active filter chips and reset | Filter state becomes hidden or requires repeated navigation |
| Multi-select and bulk action | Selectable list or compact table with selection count, persistent state across filters, and clear action | Cards drop selection affordance, sort, or safe bulk action |

## Conditional Pattern Guidance

Both **mobile list/detail** and **semantic horizontally scrolling tables** are valid conditional choices depending on the primary user task:
- **Choose Mobile List / Detail** when the primary mobile task is triage or inspection of individual records. Ensure 0px sideways scroll is required for identity and task-required existing metadata/actions at 320px and 390px. For order triage this may include status and Follow-up; for read-only records, do not add status or a row action that the source does not provide.
- **Choose Semantic Scroll Table** when the primary mobile task is two-dimensional cross-record comparison (benchmarking pricing plans, spec sheets, or aligned metric matrices). Keep row identity pinned, show visual scroll cues, preserve all units, and provide full keyboard navigation. Do not decompose aligned comparisons into disconnected cards.
- **Preserve the project's desktop contract:** keep its table, routes and complete feature set at the established desktop breakpoint; determine that breakpoint from rendered space rather than copying a fixture's 1024px cutoff.

When selection, details and inline actions exist, give them separate focusable controls. Keep selected IDs and count coherent across filters; a contextual bulk bar can improve discovery in long lists when its geometry and keyboard behavior are checked. For dense bulk scanning, a compact table may be faster than tall cards. Do not infer an eligibility restriction from a status badge.

Preserve meaningful row identity, units, money/date formatting, data semantics, sort/filter/export and actions. If cards replace table markup, associate each value with a visible/accessible label. Horizontal scrolling is appropriate for genuinely two-dimensional data; test row context and keyboard reachability. Record the choice via the [decision contract](../decision-contract.md).