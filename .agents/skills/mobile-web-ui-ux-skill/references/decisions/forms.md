# Mobile form decisions

Inspect required fields, validation rules, server responses, focus order and recovery before changing form presentation.

| Conditions | Candidate and trade-off | Reject when |
| --- | --- | --- |
| Short coherent form | One column, persistent visible labels, natural submit flow | Splitting into a wizard adds unnecessary friction |
| Long form with meaningful stages | Sections or steps with progress indicator and preserved values | Back navigation loses input, validation context or deep-link state |
| Date and range inputs | Choose manual entry, a native picker, or both according to task, locale, precision and existing contract; when both exist, synchronize one canonical value | A picker adds friction or manual entry is blocked without a product reason |
| Derived values and date bounds | Explain calculation (e.g. inclusive days) and validate date bounds ONLY when supported by source rules | Inventing unverified product validation rules |
| Mobile file attachment | Prominent mobile file picker button; offer camera only if capture is supported | Drag-and-drop emphasized as primary mobile affordance |
| Email/phone/numeric data | Semantic `type`, fitting `inputmode`, and correct `autocomplete` | Masking or keyboard choice blocks paste or valid formats |
| Validation/server error | Inline error associated through `aria-describedby`, focus first error, preserve valid values | Error appears away from field or destroys valid user entries |
| Submit CTA placement | Reachable CTA verified against keyboard and input clearance (in-flow or safe sticky bar) | CTA obscures focused inputs or gets hidden behind virtual keyboard |

## Form Patterns & Validation Guidance

- **Date Inputs & Derived Days:** Use a picker when calendar selection helps; keep manual entry when users know or paste exact dates. If both controls exist, share one canonical state, tolerate partial typing, expose the same field error on each, and leave server rules authoritative. Calculate inclusive days or enforce bounds only when the product contract requires them. The request-form fixture's 2026–2027 range and 5 MB upload limit are fixture-owned examples, not general rules.
- **Mobile File Upload:** Use standard touch-friendly file selectors. Emphasize file browse over drag-and-drop. Include camera capture (`capture="environment"`) only when camera workflow is explicitly required.
- **Error Recovery:** On rejection, retain valid entries and files. Associate field errors through `aria-describedby` and `aria-invalid`; focus the first invalid control after the error renders. On edit, clear only that field's stale server error or revalidate the same rule, and explain that the server rechecks on submit. Leave unrelated errors visible.
- **CTA Reachability vs CSS Position:** Assess submit actions by **functional clearance and reachability**, not by a rigid CSS rule (`position: static`). Both in-flow submit buttons and sticky bottom bars are acceptable provided the CTA does not obscure active input fields, labels, or the virtual keyboard during user interaction.

Keep labels visible; placeholders are hints. Preserve existing client and server validation, submitted values, paste, password manager behavior, zoom and success/error paths. Make email typo suggestions optional: accepting a suggestion must be an explicit user action, while declining it must not block an address that existing validation accepts. Do not lowercase an entire email address: [SMTP preserves the local part's case](https://www.rfc-editor.org/rfc/rfc5321#section-2.4). Do not add a stricter domain rule without an existing product requirement. Use `aria-invalid` only on invalid fields; move focus deliberately after submit errors. A resized desktop viewport is not a physical keyboard test. Use the [decision contract](../decision-contract.md).