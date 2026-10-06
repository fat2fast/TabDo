import { isTaskOverdue } from './task-datetime.js'

export function isOverdue(dueAt: string | null | undefined, status: string, now: Date = new Date()) {
  return isTaskOverdue(dueAt, status, now)
}

export * from './task-datetime.js'
