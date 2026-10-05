export function isOverdue(dueAt: string | null | undefined, status: string) {
  return Boolean(dueAt && status !== 'done' && new Date(dueAt).getTime() < Date.now())
}
