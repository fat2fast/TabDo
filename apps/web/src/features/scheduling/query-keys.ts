export const scheduleQueryKeys = {
  all: ['schedule-blocks'] as const,
  range: (start: string, end: string) => ['schedule-blocks', 'range', start, end] as const,
  byTask: (taskId: string) => ['schedule-blocks', 'task', taskId] as const,
}
