export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  snapshot: (dateStr: string, timeZone: string) =>
    ['dashboard', 'snapshot', dateStr, timeZone] as const,
  inProgress: () => ['dashboard', 'in-progress'] as const,
  priority: (dateStr: string, timeZone: string) =>
    ['dashboard', 'priority', dateStr, timeZone] as const,
  schedule: (dateStr: string, timeZone: string) =>
    ['dashboard', 'schedule', dateStr, timeZone] as const,
  upcoming: (dateStr: string, timeZone: string) =>
    ['dashboard', 'upcoming', dateStr, timeZone] as const,
}
