# Agent Workflow — Mobile UX Improvement

## Step 1: Observe the real problem

- Map user request to the principal mobile task.
- Inspect component/rendered UI, including states (empty, loading, error, long text).
- Separate **observed** symptoms from conjecture based only on source code.

## Step 2: Select priority

Prioritize blockers for task completion first, then discoverability/clarity, then comfort and polish. Describe impact and confidence, not an invented numeric UX score.

## Step 3: Decide

For each consequential choice, use the [decision contract](decision-contract.md): evidence and its status, mobile task, candidates, selected and rejected patterns with reasons, preserved behavior, and verification. A reasoned choice is not a verified implementation.

Read only the applicable focused playbook(s). Consider the current design system, content density and browser conventions.

## Step 4: Implement (if authorized)

- Make scoped, reversible changes.
- Prefer semantic HTML and stable state transitions.
- Preserve desktop behavior, navigation URLs, auth checks and critical data.
- Do not add dependencies merely for cosmetic behavior.

## Step 5: Verify

- Run existing repo tests/build when feasible.
- Test narrow width and common mobile widths, content overflow and important paths.
- For forms test keyboard focus, validation, submit and error recovery.
- Test desktop at a representative width.
- Separate automated checks, hands-on checks, assumptions and untested items.

## Step 6: Explain in plain language

Summarize what was hard to use, what changed, how it improves the task, and what testing remains. Use [report template](report-template.md).

## Safe patch checkpoint

Before editing a consequential flow, record a compact map: route/component → owning state → handler/API/business rule → token/style owner → shared consumers → desktop guards. Use the [business archetypes](business-task-archetypes.md) only when domain context changes the choice. Preserve unknown rules.

Map supported loading/empty/error/success/selection states to their actual owners and transitions. Do not invent a fetch delay, permission, validation or success state to fill a checklist. Select the smallest reversible patch, identify affected shared consumers, and record a scoped rollback boundary (owned diff only, preserving user edits). Recheck exact data/actions/labels and desktop after each shared token/component change; a before/after screenshot alone does not prove handler preservation.
