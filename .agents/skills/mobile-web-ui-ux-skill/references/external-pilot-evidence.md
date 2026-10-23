# External pilot evidence — portable handoff v1

This contract applies only when a user-authorized UX audit or change on **another project** needs to be compared with this skill repository. Use the existing [decision contract](decision-contract.md) and [evidence record](evidence-template.md). A pilot is **not** an A/B experiment; do not claim skill superiority, real-device usability or WCAG conformance from package validity.

## Producer and consumer

- Project A keeps full internal evidence, any user data, browser screenshots, private traces and logs **outside** the exported package. It must have permission to audit/change the scoped task before executing work.
- Agent writes a **sanitized, explicit** `draft.json` matching v1 below and runs installed `scripts/pilot-evidence.py` locally. Nothing scans app source or talks to GitHub.
- Human inspects the exact exported bytes and approves a **specific digest** for public transfer. `validate --policy public` is a *best-effort* screen, not privacy certification.
- Skill owner performs local `import` with that digest into `evals/external-pilots/`; review.md starts `PENDING`. Nothing is staged, pushed, merged or deemed reviewed automatically.
- A reviewer classifies each finding: `DECISION`, `IMPLEMENTATION`, `VERIFICATION`, `PROJECT_SPECIFIC`, or `UNDETERMINED`; disposition `ACCEPTED`, `NEEDS_REPRO`, `INSUFFICIENT_EVIDENCE`, or `REJECTED`. Only a reproduced skill-level issue warrants updating a rule/test, with a nearby counterexample.

## Input and output

Input is an operator-created **JSON file** with strictly allowlisted fields. See the fictional, non-executed example in `examples/pilot-evidence-safe/draft.json` in the source repository (not installed to consumer projects). No attached binary evidence is accepted.

| Draft field | Required type / meaning |
| --- | --- |
| `schema_version`, `pilot_id` | Integer `1`; lowercase slug for unique pilot ID |
| `skill.version`, `skill.source_sha`, `skill.payload_sha256` | SemVer; full 40-digit Git SHA or literal `unknown`; full SHA-256 hash of installed payload. Never substitute a guessed source commit. |
| `project.alias`, `baseline_sha`, `after_sha`, `dirty_state` | Anonymous alias; 40-hex baseline; 40-hex after or `UNCOMMITTED`; `clean` or `dirty`. Dirty after requires `file_manifest_sha256`, covering changed files in a separate private reproducible inventory. |
| `project.public_pr_url` | Optional **approved**, clean GitHub PR URL without query/fragment. The program cannot prove a link or repository is public; user must verify. |
| `agent.runtime`, `agent.version` | Observed name/version or literal `unknown` |
| `task.id`, `task.summary`, `scope.route_id` | Non-sensitive task slug + summary; **route label**, not actual private URL |
| `environment.browser`, `environment.viewport` | Observed browser/method and `{width,height}` in CSS pixels |
| `created_utc` | UTC ISO-8601 timestamp ending in `Z` |
| `decision.selected`, `rejected`, `reason`, `preserved` | Source-grounded UX decision, rejected alternative, trade-off and preserved business behavior |
| `limitations` | List of bounded honest limits, e.g. actual device NOT RUN |
| `checks` | Array of 3–100 unique typed assertion records |

Each `checks[]` record requires `id` (slug), `phase` (`before|after|regression`), `target` (`TASK|DATA|BUSINESS|A11Y|DESKTOP|METADATA`), `status` (`PASS|FAIL|INFERRED|NOT RUN`), `method`, `assertion`, `observed`, `revision`. `revision` must match baseline SHA for `before`, and after SHA or `UNCOMMITTED` for `after|regression`. All packages require at least one before, after and regression record and an explicit desktop check; `NOT RUN` is valid.

Executed PASS/FAIL requires `method=browser|unit|typecheck|human-review` and a sanitized `evidence_ref=artifact:<slug>` pointing **outside** the public package to owner-managed evidence. Reviewer independently checks its availability. `INFERRED` uses `source-review`, and `NOT RUN` uses `unavailable`; neither has an executed artifact. Unsupported evidence must not be relabeled PASS. Package SHA-256 does not authenticate tool execution or human outcomes.

The exporter emits **exactly** `manifest.json`, `checks.json`, `report.md`: canonical UTF-8 JSON with hashes of checks/report and a report synthesized from named fields; `draft.json` is **never** exported. The manifest has `classification=sanitized-review-required` rather than `public-safe` or `approved`. Input/file caps are enforced; unknown fields, duplicate JSON keys and additional package files are errors. A package is not an author-signed record.

## Safe local commands (project A)

```bash
python3 .agents/skills/mobile-web-ui-ux-skill/scripts/pilot-evidence.py export --input <private-draft.json> --out <parent>/<pilot-id>
python3 .agents/skills/mobile-web-ui-ux-skill/scripts/pilot-evidence.py validate --package <parent>/<pilot-id> --policy public
```

Review the files **manually**, including aliases, free text and any approved PR link; ensure public disclosure is authorized. Record the **exact 64-character package digest** printed by validation. Any byte changed afterward requires another review and digest.

## Local import (skill repository only)

```bash
mkdir -p evals/external-pilots
python3 scripts/pilot-evidence.py import --package <approved-package> --destination evals/external-pilots --approve-public --approved-digest <64-hex-digest>
```

The importer validates twice, never overwrites an existing pilot ID and generates a separate `review.md` initialized to `PENDING` / `INSUFFICIENT_EVIDENCE`. The reviewer must complete it and inspect the PR diff before merge. Import does not upload or stage files; importing is not evidence of UX quality. Protect private evidence locators from public disclosure; the exported `artifact:<slug>` is an abstract reference, not an external file path.

## Explicit security boundaries

No private repository URL, project absolute paths, source files, customer IDs, screenshots, raw response bodies, `.env`, cookies, authorization headers, agent transcripts or raw logs. The CLI rejects many obvious patterns but **cannot identify every secret, customer value, confidential business datum or indirect identifier**; human review is mandatory. Never pass unknown proprietary content through a public PR solely because a linter passes.
