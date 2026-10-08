import React from 'react'
import { Link } from 'react-router-dom'
import { useAdminStats } from '../features/admin/api/admin-users'
import { useI18n } from '../features/i18n/i18n-provider'

export function AdminDashboardPage() {
  const { t } = useI18n()
  const { data: stats, isLoading, isError, error, refetch } = useAdminStats()

  if (isLoading) {
    return (
      <div className="admin-page-container" style={{ padding: '2rem 0' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {t('admin.dashboardTitle')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            {t('admin.dashboardSubtitle')}
          </p>
        </div>
        <div
          className="card loading-card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#64748b',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          <div className="spinner" style={{ margin: '0 auto 1.25rem auto' }}></div>
          <p style={{ fontWeight: 500 }}>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="admin-page-container" style={{ padding: '2rem 0' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {t('admin.dashboardTitle')}
          </h2>
        </div>
        <div
          className="card error-card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            border: '1px solid #fee2e2',
            background: 'linear-gradient(180deg, #ffffff 0%, #fef2f2 100%)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontSize: '1.1rem', fontWeight: 700 }}>
            {t('admin.statsLoadError')}
          </h4>
          <p style={{ margin: '0 auto 1.5rem auto', color: '#64748b', fontSize: '0.875rem', maxWidth: '480px', lineHeight: 1.6 }}>
            {(error as Error)?.message || t('admin.statsErrorDefault')}
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
              padding: '0.625rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>{t('common.retry')}</span>
          </button>
        </div>
      </div>
    )
  }

  const totalTasks = stats?.totalTasks ?? 0
  const doneTasks = stats?.doneTasks ?? 0
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div className="admin-page-container">
      {/* Header section */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {t('admin.dashboardTitle')}
            </h2>
            <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              {t('admin.dashboardSubtitle')}
            </p>
          </div>
          <Link
            to="/admin/users"
            className="admin-submit-button"
            style={{
              textDecoration: 'none',
              padding: '0.625rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>{t('admin.usersTitle')}</span>
          </Link>
        </div>
      </div>

      {/* Modern Metrics Grid */}
      <div
        className="admin-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {/* Card 1: Users */}
        <div
          className="card stat-card"
          style={{
            padding: '1.5rem',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(145deg, #ffffff 0%, #fbfcfe 100%)',
            boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('admin.totalUsers')}
              </span>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#f3e8ff',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(147, 51, 234, 0.15)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {stats?.totalUsers ?? 0}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              marginTop: '1.5rem',
              paddingTop: '0.875rem',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: 500 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              <span>{t('admin.activeUsers')}:</span>
              <strong style={{ fontWeight: 700 }}>{stats?.activeUsers ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#e11d48', fontWeight: 500 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f43f5e', display: 'inline-block' }}></span>
              <span>{t('admin.inactiveUsers')}:</span>
              <strong style={{ fontWeight: 700 }}>{stats?.inactiveUsers ?? 0}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Total Tasks System-wide */}
        <div
          className="card stat-card"
          style={{
            padding: '1.5rem',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(145deg, #ffffff 0%, #fbfcfe 100%)',
            boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('admin.totalTasks')}
              </span>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {totalTasks}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '0.875rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>{t('admin.completionRate')}:</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: completionRate >= 50 ? '#dcfce7' : '#f1f5f9',
                  color: completionRate >= 50 ? '#15803d' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                }}
              >
                {completionRate}%
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${completionRate}%`,
                  height: '100%',
                  borderRadius: '999px',
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Tasks Breakdown */}
        <div
          className="card stat-card"
          style={{
            padding: '1.5rem',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(145deg, #ffffff 0%, #fbfcfe 100%)',
            boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('admin.taskStatus')}
              </span>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.15)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            {/* 3 Status Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <div
                style={{
                  padding: '0.625rem 0.5rem',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
                  {t('admin.todoTasks')}
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {stats?.todoTasks ?? 0}
                </div>
              </div>
              <div
                style={{
                  padding: '0.625rem 0.5rem',
                  borderRadius: '10px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', marginBottom: '0.2rem' }}>
                  {t('admin.inProgressTasks')}
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#b45309', lineHeight: 1.2 }}>
                  {stats?.inProgressTasks ?? 0}
                </div>
              </div>
              <div
                style={{
                  padding: '0.625rem 0.5rem',
                  borderRadius: '10px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.2rem' }}>
                  {t('admin.doneTasks')}
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#15803d', lineHeight: 1.2 }}>
                  {stats?.doneTasks ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Segmented Distribution Progress Bar */}
          <div style={{ marginTop: '1.5rem', paddingTop: '0.875rem', borderTop: '1px solid #f1f5f9' }}>
            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
                display: 'flex',
                gap: '1px',
              }}
            >
              {totalTasks > 0 ? (
                <>
                  <div
                    style={{
                      width: `${((stats?.doneTasks ?? 0) / totalTasks) * 100}%`,
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease',
                    }}
                    title={`${t('admin.doneTasks')}: ${stats?.doneTasks ?? 0}`}
                  />
                  <div
                    style={{
                      width: `${((stats?.inProgressTasks ?? 0) / totalTasks) * 100}%`,
                      backgroundColor: '#f59e0b',
                      transition: 'width 0.3s ease',
                    }}
                    title={`${t('admin.inProgressTasks')}: ${stats?.inProgressTasks ?? 0}`}
                  />
                  <div
                    style={{
                      width: `${((stats?.todoTasks ?? 0) / totalTasks) * 100}%`,
                      backgroundColor: '#94a3b8',
                      transition: 'width 0.3s ease',
                    }}
                    title={`${t('admin.todoTasks')}: ${stats?.todoTasks ?? 0}`}
                  />
                </>
              ) : (
                <div style={{ width: '100%', backgroundColor: '#e2e8f0' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Elevated Privacy Banner (Zero-Knowledge Content Access) */}
      <div
        className="card privacy-banner"
        style={{
          padding: '1.375rem 1.75rem',
          borderRadius: '14px',
          border: '1px solid #ede9fe',
          borderLeft: '5px solid #8b5cf6',
          backgroundColor: '#faf5ff',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.25rem',
          boxShadow: '0 4px 12px -2px rgba(139, 92, 246, 0.06)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#ede9fe',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#3b0764' }}>
              {t('admin.privacyTitle')}
            </h4>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#7c3aed',
                backgroundColor: '#ede9fe',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              RLS Verified
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#581c87', lineHeight: 1.6, opacity: 0.9 }}>
            {t('admin.privacyDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
