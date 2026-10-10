# Phase 12 — Mobile-First Web Experience & Responsive Foundation

**Status:** Planned  
**Track:** UX Foundation  
**Depends on:** Phase 10; benefits from Phase 11 for safe deletion/undo  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Make the *existing* React/Vite User Portal pleasant on phones while retaining a desktop productivity layout. This is responsive web work, **not** a separate React Native/mobile application.

Existing evidence: `AppLayout` currently uses a fixed desktop sidebar; `.app-shell` has a 240px sidebar grid, while responsive rules are mainly at component level. Calendar has a desktop Day/Week time grid. No mobile-specific bottom navigation exists.

## 2. Navigation and adaptive layouts

- Desktop (e.g. 1024px+): keep sidebar + topbar, maintain efficient multi-column workspaces.
- Tablet (e.g. 768–1023px): collapsing sidebar/compact navigation; adapt grids and side panels.
- Phone (e.g. 360–767px): bottom navigation for Today/Dashboard, Tasks, Calendar, More; prominent create-task FAB or primary action. Choose exact labels after usability review.
- Do not put the Admin Portal into a complex mobile redesign; ensure its tables/forms remain readable and accessible.
- Respect safe areas (`env(safe-area-inset-bottom)`), virtual keyboards, reduced-motion preference, 200% text zoom, and one-handed reach.

The breakpoint values above are working design targets, not fixed system rules; validate with actual viewports and content density.

## 3. Mobile task experience

- Task list uses readable touch cards with title, status, priority and due date; do not truncate critical information irreversibly.
- Selecting a task opens an accessible full-screen sheet or page rather than a narrow desktop drawer.
- Keep checklist, attachments, reminder, recurrence and scheduling tabs accessible via scrollable tabs or progressive disclosure.
- Task creation should start with title only; advanced properties are one tap away.
- Replace desktop-only hover affordances with visible action buttons or context menus.
- Introduce loading skeletons and nonblocking toast/errors without occluding the bottom bar.

## 4. Mobile calendar baseline

- Present an Agenda/List mode as the preferred narrow-screen view, grouped by day.
- Day time-grid can remain available if touch interaction is reliable. Do not force a compressed 7-column Week grid onto phones.
- Selecting a schedule entry opens a touch-friendly editor; moving work time must not implicitly change task deadline.
- Handle timezone and midnight with existing shared date utilities.
- A full Month view belongs to Phase 17, not to this foundation phase.

## 5. Shared UI foundation and CSS maintainability

- Reuse existing custom components; avoid a wholesale Tailwind/shadcn migration just for responsiveness.
- Extract design tokens for spacing, font sizes, colors, radii, elevation and breakpoint conventions.
- Break up large `apps/web/src/styles.css` into feature/layout styles in incremental steps, preserving cascade order and screenshot parity.
- For navigation and drawer, provide keyboard focus trapping/restoration, accessible labels and Escape handling.
- Account dropdown, locale switching and `/admin` portal switching keep their current role behavior and single session.

## 6. Screens and ownership

Suggested files/features:

```text
apps/web/src/features/layout/MobileNavigation.tsx
apps/web/src/features/layout/MobileHeader.tsx
apps/web/src/features/tasks/components/MobileTaskCard.tsx
apps/web/src/features/scheduling/components/MobileAgenda.tsx
apps/web/src/styles/{tokens,layout,mobile}.css  (optional incremental split)
```

Prefer a single route and data model per feature. Do not maintain duplicated desktop vs mobile business logic.

## 7. Accessibility and interaction targets

- Adequately sized touch targets (aim for ~44×44 CSS px where feasible) and 8px minimum interactive spacing where useful.
- No unwanted page-level horizontal scrolling at 360, 390 and 428px.
- Support keyboard/screen reader interactions on tablets/desktops.
- Test iOS Safari and Android Chrome, including keyboard open and landscape orientation.
- Ensure menus/modals remain usable with zoom and longer Vietnamese/English labels.

## 8. Non-goals

- Native mobile apps.
- Web Push and offline writes (Phase 19).
- Dark mode as a separate theme (Phase 18).
- Full redesign of desktop information architecture.

## 9. Tests and milestones

1. Mobile shell, navigation, focus management.
2. Task list/create/detail responsive flow.
3. Calendar agenda and schedule editor.
4. Dashboard, Summary, Settings, auth screens and minimal Admin responsive support.
5. Visual QA at 360/390/428/768/1024/1440px; manual iOS/Android smoke tests.


---

## Implementation checklist (issue-ready)

- [ ] Audit every core route at 360/390/428/768/1024px before changing global CSS.
- [ ] Build a single responsive app shell with stable route state and correct signed-in/admin account menu behavior.
- [ ] Define bottom navigation item labels with existing VI/EN catalog and active-route behavior.
- [ ] Implement FAB placement that avoids overlap with bottom nav, toast and keyboard.
- [ ] Make task edit/read surfaces full-screen or sheet-based on phone; preserve shared forms and hooks.
- [ ] Implement mobile agenda for tasks/schedule blocks with date grouping and clear empty states.
- [ ] Ensure dialogs, date/time pickers, custom dropdowns and file controls support touch without overflow.
- [ ] Separate CSS layout tokens from feature styles gradually with screenshot regression baseline.
- [ ] Test landscape and 200% text zoom, not merely narrower desktop viewport.
- [ ] Add mobile smoke checks to Phase 10 successors without modifying old release acceptance.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** On a 390px phone, user signs in, creates task, adds reminder, completes it and sees updated Today without sideways scroll.
2. **Scenario 2:** Virtual keyboard opens during task creation: Submit and Cancel remain reachable and entered text stays visible.
3. **Scenario 3:** User opens task deep link from Extension: mobile detail opens, back returns to expected list view and filters.
4. **Scenario 4:** Admin enters User Portal on phone and switches portals using existing session; privacy/auth boundaries remain unchanged.

## Risks, tradeoffs and open decisions

- Risk: separate mobile components duplicate business logic; **mitigation:** share form hooks and domain mutation functions.
- Risk: fixed bottom bar covers dialogs; **mitigation:** safe-area variables plus keyboard-driven viewport testing.
- Decision: sidebar-on-tablet vs compact topbar based on usability review and viewport tests.

---

## 10. Definition of Done

- Existing personal productivity workflows work end to end at mobile widths without unusable overflow.
- User can create, edit, schedule, snooze, complete and review tasks comfortably via touch.
- Desktop flows and route permissions remain unchanged.
- Mobile navigation is accessible, keyboard-safe and accounts for safe areas.
