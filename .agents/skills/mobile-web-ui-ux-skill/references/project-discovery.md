# Project Discovery

Use when starting work on an existing web project.

## Inspect only what matters

- Framework and app entry points: `package.json`, routes, SSR/client boundaries, styling.
- Layout and design tokens: breakpoints, typography, spacing, components, interaction conventions.
- Page(s) concerned and their shared components.
- Relevant tests and whether a runnable browser preview exists.
- If PWA features exist: manifest, service worker registration, display mode, offline fallback (do not rewrite these automatically).

## Infer user tasks

Identify up to three primary mobile tasks from UI structure, copy, route names and user request. Treat this as an **inference** without analytics or user research. State assumptions when material.

## Context capture (internal notes)

```text
Product category / actor:
Top three mobile tasks / source or inferred priority:
Frequency / urgency / risk / reversibility:
Data density / exact labels, amounts, units and dates:
Route -> component -> handler/API/rule source:
Shared token/style owner / design system / stack:
Supported loading, empty, error, success, selection states / themes:
Target browser/PWA context / existing mobile behavior:
Desktop behavior and data/action invariants to preserve:
Evidence: source fact (path/symbol), inference, rendered measurement or NOT RUN:
Unknown rules / blocking owner question:
```

Do not use private analytics, credentials or internal data outside the permitted project context.

For a consequential hierarchy change, capture a short Information Priority Map using the [content playbook](decisions/content-hierarchy.md). For a cosmetic edit, record only affected context. Trace permissions, validation, status transitions and eligibility to their owning handler/rule; a screenshot or status name cannot establish them. Keep existing behavior when the rule is unknown. Ask the owner only if a material decision is blocked.

For consequential domain decisions, consult [business task archetypes](business-task-archetypes.md). Record sensitive fields and source-owned business constraints without exporting private data. Trace route/component/state/handler/token/shared consumers before choosing the patch boundary; unsupported state or missing rule stays explicit.
