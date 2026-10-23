# External pilot UX report

Pilot: tabdo-nav-001
Project alias: tabdo
Task: Responsive bottom navigation, more sheet overlay and breakpoint scroll-lock lifecycle
Route label: app-shell-navigation
Skill version: 0.4.1
Baseline: 31dc37588173893176c487400ed9ea124b28f4ce
After: 53207fabbd7f6e2d242c9db3ba2842cca2206797

## UX choice
Selected: Bottom navigation bar with secondary sheet dialog for more items and breakpoint transition cleanup
Rejected: Persistent burger sidebar drawer or separate mobile app
Reason: Preserves primary task reachability within thumb zone while preventing invisible modals and scroll locks
Preserved: Desktop responsive sidebar, user authentication state, role-based admin route protection, and i18n locale

## Observed checks (not human approval)
- nav-before-desktop-sidebar [before/DESKTOP]: PASS via unit — Baseline desktop layout displays sidebar navigation and topbar controls; observed: Sidebar rendered correctly at desktop viewports on baseline commit
- nav-before-mobile-shell [before/TASK]: INFERRED via source-review — Baseline lacked mobile bottom navigation bar and mobile topbar layout; observed: Desktop sidebar was hidden by CSS on small screens without bottom nav fallback
- nav-after-bottom-bar [after/TASK]: PASS via unit — Bottom navigation bar renders top primary routes on mobile viewports; observed: Dashboard, Tasks, Calendar and More buttons visible with active indicator
- nav-after-more-sheet [after/A11Y]: PASS via unit — More menu opens as accessible sheet with dialog role and focus management; observed: Sheet dialog traps Tab focus and closes cleanly on Escape with focus restoration
- nav-regression-scroll-lock-cleanup [regression/DESKTOP]: PASS via unit — Switching from mobile to desktop automatically closes More menu and restores body scrolling; observed: Body overflow-hidden is cleanly cleared and sheet unmounts without persistent keyboard trap
- nav-physical-device-gesture [regression/BUSINESS]: NOT RUN via unavailable — Swipe velocity and touch feedback on physical Android and iOS hardware; observed: Physical device testing excluded from automated test suite

## Limitations and next steps
- Physical touchscreen hardware gesture lag not tested in jsdom
- PWA standalone display mode not verified
- Tested on simulated desktop and mobile viewports with automated regression suite

This report is scoped pilot evidence, not an independent visual approval or a Tier B skill-superiority result.
