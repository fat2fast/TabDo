import React, { useEffect, useState } from 'react'
import { SignInView } from '../../components/sign-in-view.js'
import { TodayView } from '../../components/today-view.js'
import { QuickAddView } from '../../components/quick-add-view.js'
import { SettingsView } from '../../components/settings-view.js'
import type {
  ExtensionMessage,
  ExtensionResult,
  ExtensionState,
} from '../../lib/types.js'

export async function sendBackgroundMessage<T = unknown>(
  message: ExtensionMessage
): Promise<ExtensionResult<T>> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message || 'Lỗi gửi tin nhắn' })
        } else {
          resolve(response as ExtensionResult<T>)
        }
      })
    })
  }
  // In tests or direct environments without chrome.runtime:
  const { handleExtensionMessage } = await import('../../lib/controller.js')
  return handleExtensionMessage(message) as Promise<ExtensionResult<T>>
}

export type PopupTab = 'today' | 'quick-add' | 'settings'

export function App() {
  const [state, setState] = useState<ExtensionState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PopupTab>('today')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompletingTaskId, setIsCompletingTaskId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch initial state on mount
  useEffect(() => {
    let mounted = true

    async function loadInitialState() {
      setIsLoading(true)
      const res = await sendBackgroundMessage<ExtensionState>({ type: 'get-state' })
      if (!mounted) return

      if (res.ok) {
        setState(res.data)
        // Auto-refresh fresh data and reconcile alarms from remote in background
        if (res.data.status === 'authenticated') {
          sendBackgroundMessage<ExtensionState>({ type: 'sync' }).then((syncRes) => {
            if (mounted && syncRes.ok && syncRes.data?.status) {
              setState(syncRes.data)
            }
          })
        }
      } else {
        setState({
          status: 'unauthenticated',
          user: null,
          todayTasks: [],
          syncMetadata: { lastSuccessfulSyncAt: null, lastSyncError: res.error, isStale: false },
        })
      }
      setIsLoading(false)
    }

    loadInitialState()
    return () => {
      mounted = false
    }
  }, [])

  const handleSignIn = async (credentials: { email: string; password: string }) => {
    setAuthError(null)
    setIsSubmitting(true)
    const res = await sendBackgroundMessage<{ state: ExtensionState }>({
      type: 'sign-in',
      payload: credentials,
    })
    setIsSubmitting(false)

    if (res.ok) {
      setState(res.data.state)
      setActiveTab('today')
    } else {
      setAuthError(res.error || 'Đăng nhập không thành công')
    }
  }

  const handleSignOut = async () => {
    setIsSubmitting(true)
    await sendBackgroundMessage({ type: 'sign-out' })
    setIsSubmitting(false)
    setState({
      status: 'unauthenticated',
      user: null,
      todayTasks: [],
      syncMetadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })
    setActiveTab('today')
  }

  const handleSync = async () => {
    setIsSyncing(true)
    const res = await sendBackgroundMessage<ExtensionState>({ type: 'sync' })
    setIsSyncing(false)
    if (res.ok) {
      setState(res.data)
    }
  }

  const handleQuickAdd = async (title: string) => {
    setIsSubmitting(true)
    const res = await sendBackgroundMessage({
      type: 'quick-add',
      payload: { title },
    })
    setIsSubmitting(false)

    if (res.ok) {
      // Re-sync to refresh state and return to Today
      await handleSync()
      setActiveTab('today')
    } else {
      throw new Error(res.error || 'Không thể tạo công việc')
    }
  }

  const handleCompleteTask = async (taskId: string, previousUpdatedAt?: string) => {
    setIsCompletingTaskId(taskId)
    const res = await sendBackgroundMessage({
      type: 'complete-task',
      payload: { taskId, previousUpdatedAt },
    })
    setIsCompletingTaskId(null)

    if (res.ok) {
      await handleSync()
    }
  }

  const handleOpenTask = async (taskId: string) => {
    await sendBackgroundMessage({
      type: 'open-task',
      payload: { taskId },
    })
  }

  const handleOpenWebApp = () => {
    const webUrl = (import.meta.env.VITE_TABDO_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '')
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: `${webUrl}/dashboard` })
    }
  }

  if (isLoading) {
    return (
      <div className="tabdo-popup-loading">
        <div className="tabdo-spinner" />
        <p>Đang tải TabDo...</p>
      </div>
    )
  }

  if (state?.status === 'inactive') {
    return (
      <div className="tabdo-popup-blocked" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--tabdo-danger, #ef4444)', marginBottom: '0.5rem' }}>Tài khoản bị vô hiệu hóa</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.
        </p>
        <button
          type="button"
          className="tabdo-btn tabdo-btn-secondary"
          onClick={handleSignOut}
          disabled={isSubmitting}
        >
          Đăng xuất
        </button>
      </div>
    )
  }

  if (state?.status === 'password_change_required') {
    return (
      <div className="tabdo-popup-blocked" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--tabdo-primary, #4f46e5)', marginBottom: '0.5rem' }}>Cần đổi mật khẩu</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Bạn cần đổi mật khẩu khởi tạo trên Web trước khi tiếp tục sử dụng TabDo Extension.
        </p>
        <button
          type="button"
          className="tabdo-btn tabdo-btn-primary"
          onClick={() => {
            const webUrl = (import.meta.env.VITE_TABDO_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '')
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: `${webUrl}/change-password` })
            }
          }}
          style={{ width: '100%', marginBottom: '0.5rem' }}
        >
          Đổi mật khẩu trên Web
        </button>
        <button
          type="button"
          className="tabdo-btn tabdo-btn-secondary"
          onClick={handleSignOut}
          disabled={isSubmitting}
          style={{ width: '100%' }}
        >
          Đăng xuất
        </button>
      </div>
    )
  }

  if (!state || state.status === 'unauthenticated' || !state.user) {
    return (
      <SignInView
        onSignIn={handleSignIn}
        isLoading={isSubmitting}
        error={authError}
      />
    )
  }

  if (activeTab === 'quick-add') {
    return (
      <QuickAddView
        onAdd={handleQuickAdd}
        onCancel={() => setActiveTab('today')}
        isLoading={isSubmitting}
      />
    )
  }

  if (activeTab === 'settings') {
    return (
      <SettingsView
        user={state.user}
        syncMetadata={state.syncMetadata}
        onSync={handleSync}
        onSignOut={handleSignOut}
        onOpenWebApp={handleOpenWebApp}
        onBack={() => setActiveTab('today')}
        isSyncing={isSyncing}
        isSigningOut={isSubmitting}
      />
    )
  }

  return (
    <TodayView
      user={state.user}
      tasks={state.todayTasks}
      syncMetadata={state.syncMetadata}
      onCompleteTask={handleCompleteTask}
      onOpenTask={handleOpenTask}
      onGoToQuickAdd={() => setActiveTab('quick-add')}
      onGoToSettings={() => setActiveTab('settings')}
      onSync={handleSync}
      isSyncing={isSyncing}
      isCompletingTaskId={isCompletingTaskId}
    />
  )
}
