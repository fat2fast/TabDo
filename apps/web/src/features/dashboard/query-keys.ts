export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  snapshot: (dateStr: string, timeZone: string) =>
    ['dashboard', 'snapshot', dateStr, timeZone] as const,
}
