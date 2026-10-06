export const reminderQueryKeys = {
  all: ['reminders'] as const,
  byTask: (taskId: string) => ['reminders', 'task', taskId] as const,
  upcoming: () => ['reminders', 'upcoming'] as const,
}
