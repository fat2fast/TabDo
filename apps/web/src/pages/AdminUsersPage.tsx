import React, { useState } from 'react'
import { useAuth } from '../features/auth/auth-provider'
import { useAdminUsers, useAdminUserLifecycle, type AdminUserItem } from '../features/admin/api/admin-users'
import { CreateUserForm } from '../features/admin/CreateUserForm'
import { useConfirm } from '../components/ui/confirm-dialog'
import { useI18n } from '../features/i18n/i18n-provider'
import { CustomDropdown } from '../components/ui/custom-dropdown'

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const confirm = useConfirm()
  const lifecycleMutation = useAdminUserLifecycle()

  // State
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers({
    page,
    pageSize: 10,
    search: search.trim() || undefined,
    role: roleFilter,
    status: statusFilter,
  })

  const users = data?.users || []
  const totalPages = data?.totalPages || 1
  const totalUsers = data?.total || 0

  const handleToggleLifecycle = async (targetUser: AdminUserItem) => {
    setFeedbackMsg(null)
    const isActivating = !targetUser.isActive

    const isConfirmed = await confirm({
      title: isActivating ? t('admin.activateConfirmTitle') : t('admin.deactivateConfirmTitle'),
      message: isActivating ? t('admin.activatePrompt') : t('admin.deactivatePrompt'),
      confirmText: isActivating ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
      variant: isActivating ? 'warning' : 'danger',
    })

    if (!isConfirmed) return

    try {
      await lifecycleMutation.mutateAsync({
        action: isActivating ? 'activate' : 'deactivate',
        userId: targetUser.id,
      })
      setFeedbackMsg({
        type: 'success',
        text: isActivating
          ? `Đã kích hoạt lại tài khoản ${targetUser.email} thành công.`
          : `Đã vô hiệu hóa tài khoản ${targetUser.email} thành công.`,
      })
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Thao tác không thành công. Vui lòng thử lại.',
      })
    }
  }

  return (
    <div className="admin-users-page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#1e1b4b' }}>
              {t('admin.usersTitle')}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
              {t('admin.usersSubtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title={isFetching ? t('common.loading') : 'Làm mới danh sách'}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: isFetching ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: isFetching ? 'spin 1s linear infinite' : 'none',
                  color: isFetching ? '#0284c7' : '#64748b',
                }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>{isFetching ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>
            <button
              type="button"
              className="admin-submit-button"
              onClick={() => setShowCreateForm(true)}
              style={{
                padding: '0.625rem 1.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t('admin.createUser')}</span>
            </button>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={feedbackMsg.type === 'success' ? 'alert-success' : 'alert-error'}
          role={feedbackMsg.type === 'success' ? 'status' : 'alert'}
          style={{ marginBottom: '1.5rem' }}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Modal Popup Create User Form */}
      {showCreateForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCreateForm(false)}
          role="dialog"
          aria-modal="true"
          data-testid="create-user-modal"
        >
          <div
            className="modal-content card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%', padding: '24px' }}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {t('admin.createUser')}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {t('admin.createUserModalDesc')}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateForm(false)}
                aria-label={t('common.close')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <CreateUserForm
              isModal
              onClose={() => setShowCreateForm(false)}
              onUserCreated={() => {
                refetch()
                setShowCreateForm(false)
                setFeedbackMsg({
                  type: 'success',
                  text: t('admin.createSuccess'),
                })
              }}
            />
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div
        className="card filter-bar-card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', flex: 1, minWidth: '260px', position: 'relative', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t('common.role')}:
            </label>
            <div style={{ width: '130px' }}>
              <CustomDropdown<'all' | 'admin' | 'user'>
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'admin', label: t('admin.adminRole') },
                  { value: 'user', label: t('admin.user') },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t('common.status')}:
            </label>
            <div style={{ width: '130px' }}>
              <CustomDropdown<'all' | 'active' | 'inactive'>
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'active', label: t('common.active') },
                  { value: 'inactive', label: t('common.inactive') },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ fontWeight: 500 }}>{t('common.loading')}</p>
          </div>
        ) : isError ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.05rem', fontWeight: 600 }}>
              Không thể tải dữ liệu danh sách người dùng
            </h4>
            <p style={{ margin: '0 auto 1.25rem auto', color: '#64748b', fontSize: '0.875rem', maxWidth: '480px', lineHeight: 1.5 }}>
              {(error as Error)?.message || 'Edge Function trả về lỗi kết nối. Nếu đang chạy cục bộ, vui lòng đảm bảo Edge Functions đang được phục vụ.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="admin-submit-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '0 auto',
                padding: '0.5rem 1.25rem',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>{t('common.retry')}</span>
            </button>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p>{t('admin.noUsersFound')}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              className="admin-users-table"
              style={{
                width: '100%',
                minWidth: '780px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  <th style={{ padding: '0.95rem 1.25rem', minWidth: '220px' }}>{t('admin.user')}</th>
                  <th style={{ padding: '0.95rem 1.25rem', width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>{t('common.role')}</th>
                  <th style={{ padding: '0.95rem 1.25rem', width: '140px', textAlign: 'center', whiteSpace: 'nowrap' }}>{t('common.status')}</th>
                  <th style={{ padding: '0.95rem 1.25rem', minWidth: '180px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span title={t('admin.taskCountsTooltip')}>{t('admin.taskCounts')}</span>
                  </th>
                  <th style={{ padding: '0.95rem 1.25rem', width: '160px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id
                  const isAdmin = u.role === 'admin'
                  const canModify = !isCurrent && !isAdmin
                  const avatarInitial = (u.displayName || u.email || 'U').charAt(0).toUpperCase()

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: u.isActive ? 'transparent' : '#fff8f8',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* User Info with Avatar */}
                      <td style={{ padding: '0.95rem 1.25rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              backgroundColor: isAdmin ? '#ede9fe' : '#e0f2fe',
                              color: isAdmin ? '#7c3aed' : '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              flexShrink: 0,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                          >
                            {avatarInitial}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0f172a' }}>
                              <span>{u.displayName || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t('admin.noName')}</span>}</span>
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    backgroundColor: '#ede9fe',
                                    color: '#7c3aed',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                  }}
                                >
                                  {t('admin.you')}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '0.95rem 1.25rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            backgroundColor: isAdmin ? '#ede9fe' : '#f1f5f9',
                            color: isAdmin ? '#7c3aed' : '#475569',
                          }}
                        >
                          {isAdmin ? t('admin.adminRole') : t('admin.user')}
                        </span>
                      </td>

                      {/* Status Badges with visual dot indicator */}
                      <td style={{ padding: '0.95rem 1.25rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              backgroundColor: u.isActive ? '#dcfce7' : '#fee2e2',
                              color: u.isActive ? '#15803d' : '#b91c1c',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: u.isActive ? '#16a34a' : '#dc2626',
                                flexShrink: 0,
                              }}
                            />
                            {u.isActive ? t('common.active') : t('common.inactive')}
                          </span>
                          {u.mustChangePassword && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                              }}
                            >
                              {t('admin.mustChangePasswordBadge')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Task Counts Summary */}
                      <td style={{ padding: '0.95rem 1.25rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            whiteSpace: 'nowrap',
                            backgroundColor: '#f8fafc',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <span
                            title="Tổng số công việc"
                            style={{
                              fontWeight: 700,
                              color: '#0f172a',
                              fontSize: '0.85rem',
                            }}
                          >
                            {u.taskCount}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>/</span>
                          <span style={{ color: '#64748b' }} title="Chờ làm (Todo)">{u.todoCount}</span>
                          <span style={{ color: '#cbd5e1' }}>/</span>
                          <span style={{ color: '#d97706', fontWeight: 600 }} title="Đang làm (In Progress)">{u.inProgressCount}</span>
                          <span style={{ color: '#cbd5e1' }}>/</span>
                          <span style={{ color: '#059669', fontWeight: 600 }} title="Đã hoàn thành (Done)">{u.doneCount}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.95rem 1.25rem', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                          {canModify ? (
                            <button
                              type="button"
                              onClick={() => handleToggleLifecycle(u)}
                              disabled={lifecycleMutation.isPending}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                border: '1px solid',
                                backgroundColor: u.isActive ? '#fff1f2' : '#f0fdf4',
                                borderColor: u.isActive ? '#fecdd3' : '#bbf7d0',
                                color: u.isActive ? '#e11d48' : '#16a34a',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                              }}
                            >
                              {u.isActive ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                </svg>
                              )}
                              <span>{u.isActive ? t('admin.deactivate') : t('admin.activate')}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.825rem', color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                              {isCurrent ? t('admin.currentAccount') : t('admin.cannotModify')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Pagination */}
        {totalUsers > 0 && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            <div>
              {t('admin.page')} <strong>{page}</strong> {t('admin.of')} <strong>{totalPages}</strong> ({totalUsers} {t('admin.accountsCount')})
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.825rem' }}
              >
                {t('common.prev')}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.825rem' }}
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
