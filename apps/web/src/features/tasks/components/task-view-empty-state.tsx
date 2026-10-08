import React from 'react'
import type { TaskView } from '../types'
import { TaskEmptyState } from './task-empty-state'

export interface TaskViewEmptyStateProps {
  view: TaskView
  hasFilters?: boolean
  onClearFilters?: () => void
}

const VIEW_EMPTY_TEXT: Record<TaskView, { title: string; description: string }> = {
  inbox: {
    title: 'Danh sách công việc trống.',
    description: 'Bắt đầu bằng cách tạo công việc mới ở thanh nhập phía trên.',
  },
  today: {
    title: 'Hôm nay chưa có công việc đến hạn.',
    description: 'Thêm công việc có hạn chót trong ngày để theo dõi tại đây.',
  },
  upcoming: {
    title: 'Không có công việc sắp tới.',
    description: 'Các công việc có hạn chót sau hôm nay sẽ hiển thị ở đây.',
  },
  overdue: {
    title: 'Không có công việc quá hạn.',
    description: 'Tuyệt vời! Bạn đang theo đúng tiến độ của tất cả công việc.',
  },
  completed: {
    title: 'Chưa có công việc hoàn thành.',
    description: 'Các công việc sau khi hoàn thành sẽ được lưu trữ tại đây.',
  },
}

export function TaskViewEmptyState({
  view,
  hasFilters,
  onClearFilters,
}: TaskViewEmptyStateProps) {
  if (hasFilters) {
    return (
      <TaskEmptyState
        title="Không tìm thấy công việc phù hợp"
        description="Hãy thử thay đổi hoặc xóa bộ lọc để xem các công việc khác."
      >
        {onClearFilters && (
          <button type="button" className="btn-secondary" onClick={onClearFilters}>
            Xóa bộ lọc
          </button>
        )}
      </TaskEmptyState>
    )
  }

  const { title, description } = VIEW_EMPTY_TEXT[view] || VIEW_EMPTY_TEXT.inbox

  return <TaskEmptyState title={title} description={description} />
}
