# Evidence record

Use `PASS` only for a check actually run and observed. Use `FAIL` with reproduction steps, `NOT RUN` with the missing environment and replay steps, or `INFERRED` for a source-based hypothesis. A structural check cannot establish UX quality. Do not include personal data, credentials, or private screenshots.

| Field | Value |
| --- | --- |
| Scenario and task |  |
| Fixture version | Commit SHA, or `UNCOMMITTED` plus file hash |
| Environment | OS, browser/version, device or emulation |
| Viewport | CSS width × height; zoom if relevant |
| Steps | Numbered reproduction steps |
| Observed result | Include status label per assertion |
| Artifacts | Screenshot, network log, or command output path |
| Desktop check | Result and viewport, or `NOT RUN` |
| Limitations | Real keyboard, browser, or other untested conditions |

Keep baseline observation separate from later implementation and skill evaluation.

For a user-authorized pilot in a **different project**, use the portable [external pilot evidence v1](external-pilot-evidence.md) contract and its offline exporter. Keep local screenshots/logs with the project owner; report metadata validation is not UX approval.
