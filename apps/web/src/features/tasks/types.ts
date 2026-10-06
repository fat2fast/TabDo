import type {
  Category,
  CreateCategoryInput,
  CreateTaskInput,
  DueDateKind,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateCategoryInput,
  UpdateTaskInput,
} from '@tabdo/types'

export type TaskView = 'inbox' | 'today' | 'upcoming' | 'overdue' | 'completed'

export type TaskSortOption =
  | 'default'
  | 'due_asc'
  | 'due_desc'
  | 'priority'
  | 'created_desc'
  | 'updated_desc'

export interface TaskListQueryInput {
  view: TaskView
  search?: string
  status?: TaskStatus
  priority?: TaskPriority
  categoryId?: string | null
  dueFrom?: string
  dueTo?: string
  sort?: TaskSortOption
  limit?: number
  timeZone: string
  now: Date
}

export interface TaskRow {
  id: string
  user_id: string
  category_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date_kind: DueDateKind
  priority_rank?: number
  start_at: string | null
  due_at: string | null
  source_url: string | null
  completed_at: string | null
  recurrence_rule: string | null
  created_at: string
  updated_at: string
  subtasks_count?: number
}

export interface CategoryRow {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDateKind: row.due_date_kind,
    startAt: row.start_at,
    dueAt: row.due_at,
    sourceUrl: row.source_url,
    completedAt: row.completed_at,
    recurrenceRule: row.recurrence_rule,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type {
  Category,
  CreateCategoryInput,
  CreateTaskInput,
  DueDateKind,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateCategoryInput,
  UpdateTaskInput,
}
