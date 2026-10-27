# Action hierarchy decisions

Classify each action by frequency, consequence and recovery. Use [decision record](../decision-contract.md).

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Frequent primary action in a short page | Visible inline CTA near task completion | It becomes hard to find after a long form |
| Long task with persistent completion action | Sticky CTA with content/keyboard clearance | It covers content, competes with another footer or keyboard |
| Infrequent secondary actions | Labeled contextual menu with visible trigger | Critical action is hidden behind guessing or hover |
| Destructive or irreversible action | Distinct label plus confirmation/review; undo when feasible | Confirmation alone lacks context, or undo cannot restore data |

Keep a visible route to the primary action and a safe route to cancel. Before recommending a review step, confirmation or guard, identify which records the current handler accepts and what rule establishes eligibility. Preserve that eligible set through the proposed interaction unless the source or user supplies a different rule. A status label alone cannot justify excluding a record. If a proposed restriction depends on an unknown eligibility or role policy, flag that policy as a product question while retaining the observed behavior; do not present a new gate or skip-ineligible flow as required implementation. Disable repeat submission during loading when the underlying action supports that state, and announce progress and completion. Do not silently change permissions or business effects. Do not make swipe/long press the only way to act.
