import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownDescriptionEditor } from '../components/ui/markdown-description-editor'
import { TaskChecklist } from '../components/task-checklist'
import { RelatedTasks } from '../components/related-tasks'
import {
  cleanDescriptionWithoutChecklist,
  embedTaskChecklist,
  extractTaskChecklist,
  type TaskChecklistItem,
} from '../utils/task-checklist'
import {
  cleanDescriptionWithoutAttachments,
  embedTaskAttachments,
  extractTaskAttachments,
} from '../utils/task-attachments'
import {
  cleanDescriptionWithoutLinks,
  embedLinkedTaskIds,
  extractLinkedTaskIds,
} from '../utils/task-linking'
import { getCleanTaskDescription } from '../utils/task-description'
import { TaskAttachments } from '../components/task-attachments'
import { TaskForm } from '../components/task-form'
import { TaskRow } from '../components/task-row'
import type { Task } from '../types'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

vi.mock('../../auth/auth-provider', () => {
  const mockAuth = {
    profile: {
      id: 'u-1',
      timezone: 'Asia/Ho_Chi_Minh',
      role: 'user',
      displayName: 'Test User',
    },
    session: {
      user: { id: 'u-1', email: 'test@tabdo.local' },
    },
  }
  return {
    useAuth: () => mockAuth,
    useOptionalAuth: () => mockAuth,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('Task Detail Enhancements (UI/UX Pro Max)', () => {
  describe('MarkdownDescriptionEditor', () => {
    it('renders textarea in edit mode and switches to preview mode', async () => {
      const user = userEvent.setup()
      let desc = '# Ghi chú công việc\n- [ ] Việc cần làm 1'
      const onChange = vi.fn((newVal) => {
        desc = newVal
      })

      const { rerender } = render(
        <MarkdownDescriptionEditor value={desc} onChange={onChange} />
      )

      const textarea = screen.getByLabelText('Mô tả')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue(desc)

      // Click "Xem trước" toggle tab
      const previewTab = screen.getByRole('button', { name: /xem trước/i })
      await user.click(previewTab)

      // In preview mode, rendered markdown contains h1 and checklist item
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ghi chú công việc')
      expect(screen.getByText('Việc cần làm 1')).toBeInTheDocument()

      // Click "Soạn thảo" to return to edit mode
      const editTab = screen.getByRole('button', { name: /soạn thảo/i })
      await user.click(editTab)

      expect(screen.getByLabelText('Mô tả')).toBeInTheDocument()
    })

    it('inserts markdown syntax on formatting button click', async () => {
      const user = userEvent.setup()
      let desc = 'Mô tả ban đầu'
      const onChange = vi.fn()

      render(<MarkdownDescriptionEditor value={desc} onChange={onChange} />)

      const boldButton = screen.getByRole('button', { name: /in đậm/i })
      await user.click(boldButton)

      expect(onChange).toHaveBeenCalledWith('**chữ in đậm**Mô tả ban đầu')
    })
  })

  describe('TaskChecklist', () => {
    it('parses checklist items from markdown description and calculates progress', () => {
      const desc = `Một số thông tin\n\n### Checklist\n- [ ] Bước 1\n- [x] Bước 2 hoàn thành\n- [ ] Bước 3`
      const onChange = vi.fn()

      render(<TaskChecklist description={desc} onChangeDescription={onChange} />)

      // Progress counter badge: 1/3 (33%)
      expect(screen.getByText('1/3 (33%)')).toBeInTheDocument()
      expect(screen.getByText('Bước 1')).toBeInTheDocument()
      expect(screen.getByText('Bước 2 hoàn thành')).toBeInTheDocument()
      expect(screen.getByText('Bước 3')).toBeInTheDocument()
    })

    it('toggles item completion status from [ ] to [x]', async () => {
      const user = userEvent.setup()
      const desc = `- [ ] Mua văn phòng phẩm\n- [x] Gửi email báo cáo`
      const onChange = vi.fn()

      render(<TaskChecklist description={desc} onChangeDescription={onChange} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).toBeChecked()

      // Click first checkbox
      await user.click(checkboxes[0])

      expect(onChange).toHaveBeenCalledWith('- [x] Mua văn phòng phẩm\n- [x] Gửi email báo cáo')
    })

    it('adds a new checklist item via inline form', async () => {
      const user = userEvent.setup()
      let desc = 'Công việc A'
      const onChange = vi.fn((newVal) => {
        desc = newVal
      })

      const { rerender } = render(
        <TaskChecklist description={desc} onChangeDescription={onChange} />
      )

      // Click "+ Thêm mục"
      const addBtn = screen.getByRole('button', { name: /\+ thêm mục/i })
      await user.click(addBtn)

      const input = screen.getByPlaceholderText(/nhập nội dung mục kiểm tra/i)
      await user.type(input, 'Kiểm tra chất lượng code')

      const saveBtn = screen.getByRole('button', { name: /^thêm$/i })
      await user.click(saveBtn)

      expect(onChange).toHaveBeenCalledWith(
        'Công việc A\n\n### Checklist\n- [ ] Kiểm tra chất lượng code'
      )
    })

    it('supports modern decoupled items and does not pollute description', async () => {
      const user = userEvent.setup()
      const items: TaskChecklistItem[] = [
        { id: '1', text: 'Mục 1', completed: false },
        { id: '2', text: 'Mục 2', completed: true },
      ]
      const onChangeItems = vi.fn()

      render(<TaskChecklist items={items} onChangeItems={onChangeItems} />)

      // Progress counter badge: 1/2 (50%)
      expect(screen.getByText('1/2 (50%)')).toBeInTheDocument()

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).toBeChecked()

      // Toggle first item
      await user.click(checkboxes[0])
      expect(onChangeItems).toHaveBeenCalledWith([
        { id: '1', text: 'Mục 1', completed: true },
        { id: '2', text: 'Mục 2', completed: true },
      ])
    })
  })

  describe('Task Checklist Utilities (Decoupled from Description)', () => {
    it('correctly embeds, extracts, and cleans checklist metadata without touching description text', () => {
      const base = 'Đây là nội dung mô tả chi tiết của công việc'
      const checklist: TaskChecklistItem[] = [
        { id: 'c1', text: 'Viết test case', completed: true },
        { id: 'c2', text: 'Review code', completed: false },
      ]

      const embedded = embedTaskChecklist(base, checklist)
      expect(embedded).toContain('<!-- tabdo_checklist: [{"id":"c1","text":"Viết test case","completed":true},{"id":"c2","text":"Review code","completed":false}] -->')

      const extracted = extractTaskChecklist(embedded)
      expect(extracted).toEqual(checklist)

      const cleaned = cleanDescriptionWithoutChecklist(embedded)
      expect(cleaned).toBe(base)
    })

    it('extracts legacy markdown checklists and cleans them from description editor', () => {
      const legacyDesc = 'Ghi chú công việc\n\n### Checklist\n- [ ] Việc 1\n- [x] Việc 2 đã xong'
      const extracted = extractTaskChecklist(legacyDesc)
      expect(extracted).toHaveLength(2)
      expect(extracted[0].text).toBe('Việc 1')
      expect(extracted[0].completed).toBe(false)
      expect(extracted[1].text).toBe('Việc 2 đã xong')
      expect(extracted[1].completed).toBe(true)

      const cleaned = cleanDescriptionWithoutChecklist(legacyDesc)
      expect(cleaned).toBe('Ghi chú công việc')
    })

    it('getCleanTaskDescription completely strips all metadata comments and legacy checklists', () => {
      const descWithAll = 'Nội dung mô tả thực tế\n\n<!-- tabdo_checklist: [{"id":"chk-1","text":"test checklist","completed":false}] -->\n\n<!-- tabdo_linked: ["t-1","t-2"] -->\n\n<!-- tabdo_attachments: [{"id":"a-1","name":"file.png","size":123,"type":"image/png","url":"https://example.com/file.png","createdAt":"2026-10-06T00:00:00Z"}] -->'
      expect(getCleanTaskDescription(descWithAll)).toBe('Nội dung mô tả thực tế')

      // Case when description only contains checklist (no user text) - exactly as seen in the user report
      const checklistOnly = '<!-- tabdo_checklist: [{"id":"chk-1791274266320-knvs","text":"aaaaaaaaaaaa","completed":false}] -->'
      expect(getCleanTaskDescription(checklistOnly)).toBe('')
      expect(extractTaskChecklist(checklistOnly)).toEqual([
        { id: 'chk-1791274266320-knvs', text: 'aaaaaaaaaaaa', completed: false },
      ])
    })
  })

  describe('Task Linking Utilities', () => {
    it('correctly embeds and extracts linked task IDs', () => {
      const base = 'Chi tiết công việc và yêu cầu kỹ thuật'
      const linked = ['task-123', 'task-456']

      const embedded = embedLinkedTaskIds(base, linked)
      expect(embedded).toContain('<!-- tabdo_linked: ["task-123","task-456"] -->')

      const extracted = extractLinkedTaskIds(embedded)
      expect(extracted).toEqual(['task-123', 'task-456'])

      const cleaned = cleanDescriptionWithoutLinks(embedded)
      expect(cleaned).toBe(base)
    })
  })

  describe('RelatedTasks component', () => {
    const mockTask: Task = {
      id: 'task-main',
      userId: 'u-1',
      title: 'Thiết kế giao diện chính',
      description: 'Mô tả',
      status: 'in_progress',
      priority: 'high',
      dueDateKind: 'date_time',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    it('renders empty note when no linked tasks exist and allows opening link modal', async () => {
      const user = userEvent.setup()
      const onUpdateLinked = vi.fn()

      render(
        <RelatedTasks
          currentTask={mockTask}
          linkedTaskIds={[]}
          onUpdateLinkedTaskIds={onUpdateLinked}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText(/công việc liên quan/i)).toBeInTheDocument()
      expect(
        screen.getByText(/chưa có công việc nào được liên kết thủ công/i)
      ).toBeInTheDocument()

      // Open link candidate modal
      const addLinkBtn = screen.getByRole('button', { name: /\+ liên kết công việc/i })
      await user.click(addLinkBtn)

      expect(screen.getByPlaceholderText(/tìm kiếm công việc/i)).toBeInTheDocument()
    })
  })

  describe('Task Attachments Utilities', () => {
    it('correctly embeds and extracts file attachments', () => {
      const base = 'Tài liệu hướng dẫn'
      const attachments = [
        {
          id: 'att-1',
          name: 'spec.pdf',
          size: 1024 * 500,
          type: 'application/pdf',
          url: 'https://example.com/spec.pdf',
          createdAt: '2026-10-05T00:00:00Z',
        },
      ]

      const embedded = embedTaskAttachments(base, attachments)
      expect(embedded).toContain('<!-- tabdo_attachments: [')
      expect(embedded).toContain('spec.pdf')

      const extracted = extractTaskAttachments(embedded)
      expect(extracted).toHaveLength(1)
      expect(extracted[0].name).toBe('spec.pdf')
      expect(extracted[0].size).toBe(512000)

      const cleaned = cleanDescriptionWithoutAttachments(embedded)
      expect(cleaned).toBe(base)
    })
  })

  describe('TaskRow enhancements', () => {
    it('renders "Chưa có hạn" when no due date is set, and renders checklist & attachment badges', () => {
      const taskWithBadges: Task = {
        id: 'task-rich',
        userId: 'u-1',
        title: 'Task with rich badges',
        description: 'Mô tả\n- [ ] Mục 1\n- [x] Mục 2 hoàn thành<!-- tabdo_attachments: [{"id":"att-1","name":"design.png","size":1024,"type":"image/png","url":"data:image/png;base64,abc","createdAt":"2026-10-05T00:00:00Z"}] -->',
        status: 'todo',
        priority: 'high',
        dueDateKind: 'date_time',
        dueAt: null,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      }

      render(<TaskRow task={taskWithBadges} onSelect={vi.fn()} />, {
        wrapper: createWrapper(),
      })

      // Checklist badge: 1/2
      expect(screen.getByText('☑ 1/2')).toBeInTheDocument()

      // Attachment badge: 1
      expect(screen.getByText('📎 1')).toBeInTheDocument()

      // Due chip displays "Chưa có hạn"
      expect(screen.getByText('Chưa có hạn')).toBeInTheDocument()
    })

    it('renders recurrence badge with summary on recurring task rows', () => {
      const recurringTask: Task = {
        id: 'task-recur',
        userId: 'u-1',
        title: 'Họp giao ban mỗi ngày',
        status: 'todo',
        priority: 'medium',
        dueDateKind: 'date_time',
        dueAt: '2026-10-10T09:00:00Z',
        recurrenceRule: 'FREQ=DAILY',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      }

      render(<TaskRow task={recurringTask} onSelect={vi.fn()} />, {
        wrapper: createWrapper(),
      })

      const badge = screen.getByTestId('task-recurrence-badge-task-recur')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('Hàng ngày')
    })
  })

  describe('TaskAttachments Dropzone & Interactivity', () => {
    it('renders dropzone prompt and allows toggling link input', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(<TaskAttachments attachments={[]} onChangeAttachments={onChange} />)

      // Check dropzone presence
      expect(screen.getByText(/kéo và thả tệp vào đây/i)).toBeInTheDocument()
      expect(screen.getByText(/hình ảnh, pdf, word, excel, zip/i)).toBeInTheDocument()

      // Toggle + Thêm link
      const addLinkBtn = screen.getByRole('button', { name: /\+ thêm link/i })
      await user.click(addLinkBtn)

      const urlInput = screen.getByPlaceholderText(/drive\.google\.com/i)
      expect(urlInput).toBeInTheDocument()

      await user.type(urlInput, 'https://example.com/document')
      const saveLinkBtn = screen.getByRole('button', { name: /gắn link/i })
      await user.click(saveLinkBtn)

      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'link',
          url: 'https://example.com/document',
        }),
      ])
    })
  })

  describe('TaskForm 2-Column Layout & Contextual Tabs', () => {
    const mockParentTask: Task = {
      id: 'task-parent-1',
      userId: 'u-1',
      title: 'Task Parent Title',
      description: 'Mô tả cha\n- [ ] Bước A\n- [ ] Bước B',
      status: 'todo',
      priority: 'medium',
      dueDateKind: 'date_time',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    it('renders 2-column layout and allows switching between workspace tabs', async () => {
      const user = userEvent.setup()

      render(<TaskForm task={mockParentTask} />, { wrapper: createWrapper() })

      // Form layout
      const form = screen.getByTestId('task-form')
      expect(form).toHaveClass('modern-2col-layout')

      // Title input
      expect(screen.getByLabelText(/tiêu đề/i)).toHaveValue('Task Parent Title')

      // Checklist tab is active by default with badge 2
      expect(screen.getByRole('tab', { name: /checklist/i })).toHaveClass('active')
      expect(screen.getByText('Bước A')).toBeInTheDocument()

      // Switch to "Đính kèm" tab
      const attachTab = screen.getByRole('tab', { name: /đính kèm/i })
      await user.click(attachTab)
      expect(attachTab).toHaveClass('active')
      expect(screen.getByTestId('task-attachments-widget')).toBeInTheDocument()
      expect(screen.getByText(/kéo và thả tệp vào đây/i)).toBeInTheDocument()

      // Switch to "Liên quan" tab
      const relatedTab = screen.getByRole('tab', { name: /liên quan/i })
      await user.click(relatedTab)
      expect(relatedTab).toHaveClass('active')
      expect(screen.getByRole('button', { name: /\+ liên kết công việc/i })).toBeInTheDocument()

      // Switch to "Lịch làm việc" tab
      const scheduleTab = screen.getByRole('tab', { name: /lịch làm việc/i })
      await user.click(scheduleTab)
      expect(scheduleTab).toHaveClass('active')
      expect(screen.getByTestId('task-scheduled-sessions-section')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+ lên lịch làm việc/i })).toBeInTheDocument()

      // Switch to "Lời nhắc" tab
      const remindersTab = screen.getByRole('tab', { name: /lời nhắc/i })
      await user.click(remindersTab)
      expect(remindersTab).toHaveClass('active')
      expect(screen.getByTestId('task-reminders-section')).toBeInTheDocument()

      // Sticky action footer is rendered and accessible
      expect(screen.getByTestId('task-form-sticky-footer')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /lưu thay đổi/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /xóa công việc/i })).toBeInTheDocument()
    })
  })
})


