export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  userId: string
  categoryId?: string | null
  parentId?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  startAt?: string | null
  dueAt?: string | null
  sourceUrl?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}
