# Mobile UX decision record

Use one short record per consequential UX choice. Read the applicable [playbook](../SKILL.md) and distinguish the quality of a proposed decision from a verified implementation result.

| Field | Required content |
| --- | --- |
| Evidence | Observed symptom with artifact and `PASS`/`FAIL`, or `INFERRED`/`NOT RUN` with source and limit |
| Mobile task | Actor, goal, route, frequency/urgency and risk/reversibility where relevant; distinguish sourced priority from inference |
| Source / priority | Owning component → handler/rule and token; data/action invariants, density and supported states/themes. For hierarchy changes, a compact [Information Priority Map](decisions/content-hierarchy.md); omit unrelated fields for cosmetic edits |
| Candidates | At least two feasible patterns, including status quo when appropriate |
| Selected | Pattern and task-based reason |
| Rejected | A genuinely viable alternative and a concrete, task-based trade-off; describe unmeasured risks as risks |
| Preserved | Existing routes/Back/deep links, permissions, validation, domain data, actions, desktop, keyboard/focus/zoom as relevant; cite the owning source for any proposed behavior change |
| Verify | Steps, browser/device/viewport, expected observable result, and evidence status |

Do not ask a non-designer to choose pattern terminology when the task and repository provide enough context. Ask only for a missing business priority, irreversible or high-risk decision, or contradictory repository evidence. Name uncertainty and select a reversible option when safe. Multiple choices can be valid; explain trade-offs rather than scoring a keyword.

Before proposing eligibility, permission, validation, normalization or a new action, inspect the existing handler and business rule. If no rule is visible, keep current behavior and mark the proposed guard as a question for the product owner. A status label alone does not establish permission; an email typo suggestion alone does not make an otherwise accepted address invalid.

Label source facts with path/symbol separately from inferred priorities and rendered measurements. Reading a token value is a source fact, not a measured contrast result. Keep unresolved rules explicit; do not populate missing fields with invented business behavior.

`PASS` means a check ran and met its assertion; name the check, assertion and artifact. `FAIL` means an executed check failed. `INFERRED` means a bounded conclusion from source or design review, even when the source was inspected directly. `NOT RUN` means the proposed behavior was not checked. State metadata integrity checks separately from UX results. When test output is cited, tie it to the executed source and run; a checked-in historical PASS or matching prompt/timestamp does not test the current interface. Apply the labels to every claim, not just a closing checklist: do not write "verified", "passes", "satisfies" or "conforms" for a proposed UI without an executed check. A good decision record is not evidence that the proposed UI was implemented or improved. The [evidence template](evidence-template.md) records executed checks.
