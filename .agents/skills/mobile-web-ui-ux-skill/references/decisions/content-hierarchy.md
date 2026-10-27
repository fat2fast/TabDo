# Content hierarchy decisions

Prioritize content by mobile task while retaining a labeled route to everything required. Use [decision record](../decision-contract.md).

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Identity and status needed to scan | Summary with detail route | Required status, amount or ID is hidden or truncated ambiguously |
| Optional groups of long information | Native details/accordion with clear label and state | Users must open many groups just to complete task |
| Context lost while scrolling | Small sticky context header | It obscures content at zoom or competes with sticky CTA |
| Long translated names/IDs | Wrapping, safe word break, copy affordance | Truncation removes distinguishing information |

Test reflow at an effective 320 CSS px width (for example, 1280px viewport at 400% zoom) and test 200% text resizing separately; verify access to full names, IDs, totals, errors and actions. If information is collapsed, name the control and test keyboard/touch opening. A genuine two-dimensional comparison can retain horizontal scrolling with clear association, but cell text must remain readable.

## Information Priority Map

For a consequential layout choice, write one compact map: **required decision data → primary action → supporting context → optional detail → critical status**. This is a discovery order, not a rigid vertical order: place a blocking error or urgent status where it informs the decision. Name each source field, its existing label/value/unit and the owning route/component/handler. Record how desktop retains its current task and data. Unknown status or action rules remain unknown; do not invent them to complete the map.

| Task / data | Feasible density choice | Counterexample / alternative |
| --- | --- | --- |
| Scan many independent records and act on one | Compact labeled list with existing identity, task data and action; disclose optional detail | Spaced cards can suit a few rich records, but tall repetition can bury triage actions. Bulk aligned comparison may require a table. |
| Compare attributes across products | Aligned semantic table/matrix with row context and purposeful contained scrolling | Independent cards can suit browsing; they make cross-column comparison harder when units and attributes must align. |
| Browse image-led items | Spaced cards or compact list depending on imagery and density | Do not force cards when exact spec comparison is the primary task. |
| Complete related inputs | Labeled form sections with errors beside fields and clear submit state | An accordion is unsuitable when users must open every group repeatedly or it hides required errors. |

Use the project's type scale for headings, values, labels and supporting text; apply spacing tokens to group related label/value/action content. Emphasis should follow task importance, not make every amount or badge equally prominent. Keep monetary precision/currency, measurement units, date/time-zone meaning and full distinguishing identifiers. Wrap long translations; do not silently abbreviate semantics.

Define supported loading, empty, error and success states, selection and recovery with their source owners. Keep retry/reset/actions consistent with existing handlers. Check sticky stacking, target overlap, long labels, keyboard focus and desktop along with the populated screen. Test 200% text resizing separately from effective-320 CSS px reflow; viewport resizing alone does not prove text scaling. Screenshots need task/state assertions; they cannot prove the chosen density helps users without further evidence.
