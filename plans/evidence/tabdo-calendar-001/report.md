# External pilot UX report

Pilot: tabdo-calendar-001
Project alias: tabdo
Task: Calendar agenda view and responsive unscheduled tasks sidebar lifecycle
Route label: calendar-route
Skill version: 0.4.1
Baseline: 31dc37588173893176c487400ed9ea124b28f4ce
After: 53207fabbd7f6e2d242c9db3ba2842cca2206797

## UX choice
Selected: Responsive MobileAgenda presentation with decoupled unscheduled tasks modal
Rejected: Dense multi-day grid forced onto phone viewports or always-open mobile sidebar
Reason: Vertical day grouping fits narrow screens and separating sidebar state prevents surprise modals on resize
Preserved: Desktop multi-day grid, schedule block CRUD operations, and user timezone conversion

## Observed checks (not human approval)
- cal-before-desktop-grid [before/DESKTOP]: PASS via unit — Baseline calendar displayed time grid on desktop viewports; observed: Day and week grid views rendered with scheduling slots on desktop
- cal-before-mobile-agenda [before/TASK]: INFERRED via source-review — Baseline lacked narrow-width agenda list presentation for mobile viewports; observed: Desktop grid was clipped and required horizontal scrolling on phone screens
- cal-after-agenda-display [after/TASK]: PASS via unit — Calendar renders MobileAgenda day grouped list when on mobile viewports; observed: Agenda cards display timezone-aware events with schedule detail modal transition
- cal-after-modal-lifecycle [after/A11Y]: PASS via unit — Unscheduled tasks modal opens on explicit toggle with dialog role and focus trap; observed: Modal opens with body scroll lock and closes on close button or Escape key
- cal-regression-breakpoint-modal [regression/DESKTOP]: PASS via unit — Resizing from desktop to mobile does not automatically pop up unscheduled modal; observed: Desktop sidebar state separated from mobile panel preventing unintended modal opening
- cal-physical-touch-drag [regression/BUSINESS]: NOT RUN via unavailable — Cross-day touch drag-and-drop rescheduling on physical mobile device; observed: Physical device touch gestures excluded from automated test suite

## Limitations and next steps
- Touch drag-and-drop between days on touchscreens not tested in headless environment
- Physical mobile browser rotation animations not verified
- Tested on simulated desktop and mobile viewports with automated regression suite

This report is scoped pilot evidence, not an independent visual approval or a Tier B skill-superiority result.
