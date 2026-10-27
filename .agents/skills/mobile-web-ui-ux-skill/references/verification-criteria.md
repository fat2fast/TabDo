# Mobile UX Verification Criteria

## Purpose

Check whether the proposed or implemented change helps users complete mobile tasks. **Do not give arbitrary numeric design scores or unmeasured benefit percentages.** A quantitative improvement needs a named baseline, after measurement and method. Otherwise describe the expected benefit as a hypothesis. Compare baseline and modified experience using observable evidence; a proposed UI remains `NOT RUN` until implemented and checked.

## Scenario evaluation

1. **Task completion:** Can the primary mobile user complete the specified task with the intended controls?
2. **Discoverability:** Can the user find the relevant action without guessing or relying on hover?
3. **Content integrity:** Are mandatory information and existing functions still reachable?
4. **Interaction clarity:** Can the user understand active state, feedback, errors, loading and recovery?
5. **Accessibility:** Are semantic controls, labels, keyboard focus, zoom and non-gesture alternatives preserved?
6. **Mobile robustness:** Does layout behave at small widths, long text, focus/keyboard and portrait/landscape when relevant?
7. **Regression:** Are desktop appearance/flows and route/business behavior intact?

## Suggested device-width matrix

320, 375, 390, 430 CSS px, plus one representative tablet and desktop viewport. Choose device profiles based on the target population; widths do not prove iOS/Android browser compatibility.

## Evidence labels

- **PASS:** An identified check ran and met its assertion; name the method and artifact. State whether it checked source, metadata or rendered behavior.
- **FAIL:** An identified check ran and failed its assertion; include reproduction steps.
- **NOT RUN:** A proposed interaction or assertion was not executed; provide the missing environment and replay steps.
- **INFERRED:** A bounded conclusion from inspected source or a design hypothesis; name its basis and limits. Inspecting source does not make an unrun interaction check `PASS`.

A headless click/fill on `input[type=date]` proves input reachability and value synchronization; it does not prove selection from the platform calendar popup, unsupported-picker fallback, or physical virtual-keyboard clearance. Mark those separately. For build/browser evidence, use artifacts from the same run and source revision; identify a dirty local worktree as such.

Keep source and metadata checks separate from UX results. A successful prompt-hash check, for example, establishes provenance, not form behavior.

## Baseline / after format

```text
Scenario and version:
Task:
Before: steps + obstacles + artifacts
After: steps + artifacts
Checks executed + browser/viewport:
Regressions:
Limitations / untested:
```

## Completion

Structural validation cannot establish UX quality. Record task and interaction results on the implemented UI before claiming improvement. Test on real devices for browser, keyboard or PWA behavior that emulation may miss.

## Rendered color and state evidence

For representative affected controls, retain actual state triggers/oracles, foreground/background paint sources, font size/weight, applicable threshold and unrounded contrast ratio. Use the [accessibility playbook](decisions/accessibility.md) for text/nontext distinctions and exceptions. Exercise supported normal/hover/active/keyboard-focus/selected/disabled/error/warning/success states; unsupported states need reasons. Color-only meaning, accessible names and associated errors need separate assertions. A palette-only computation or a zero-violation scan cannot settle unresolved painting or incomplete scanner findings.

Keep screenshots and measurements bound to the executed source and run. A native test attachment can record check identity, browser/viewport, trigger, passed state oracle, criterion, measurements, disposition and referenced artifact hashes. Resolve files inside that run's artifact root; reject missing, stale, changed or escaping files. Match mandatory outcomes by source spec and browser project as well as title. Expected-negative probes pass only when they detect their injected defect and restore the original state.

Solid-color helpers have rendering limits. Complex gradients/images/blending require focused rendered review or a blocker. Browser gamut mapping, supported focus-ring geometry and canvas assumptions need browser reference tests and disclosed precision; uncertain threshold boundaries remain review required. Label dirty local evidence EXPLORATORY and retain an actual source snapshot; a HEAD SHA alone does not identify uncommitted changes. Authoritative release evidence requires clean committed source/CI. Headless Chromium evidence covers its tested states; it is not device, human, screen-reader or full WCAG-conformance proof.

## Reviewed visual references

Freeze the responsive/state matrix before generation. Include normal widths and actual supported empty/error/selected/long-label states, with task/data/action assertions. Do not fabricate loading or role states. Keep genuine two-dimensional comparisons contained and usable.

Create only missing references in a controlled runner, preserve existing hashes and inspect every image before approval. Normal checks never overwrite references after a mismatch. Bind each approved snapshot to its ID, file hash, browser/font environment and reviewer verdict. Store current actual and expected copies in run artifacts; reject absent, changed, substituted or unapproved evidence. Pin fonts and verify the faces actually used by the browser, not only the requested CSS family. Desktop preservation references and improved-mobile regression references serve different purposes.

Test effective320 CSS-pixel reflow separately from text resizing. A root-font or headless viewport proxy must be named as such. Actual400% browser zoom and200% text-only review require a headed browser with the applicable setting, measured starting content viewport/text size, screenshots of settings and tasks, observed keyboard/Back outcomes and restoration. Record NOT RUN when unavailable; proxies cannot close the real-browser gate.
