import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-provider'
import { UserScopedQueryProvider } from './features/auth/user-scoped-query-provider'
import { PwaUpdateProvider } from './features/pwa/pwa-update-context'
import { SessionVerificationBoundary } from './features/auth/session-verification-boundary'
import { I18nProvider } from './features/i18n/i18n-provider'
import { ConfirmProvider } from './components/ui/confirm-dialog'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// 1. Mobile & Design Tokens
import './mobile-tokens.css'

// 2. Global Base Stylesheet
import './styles.css'

// 3. Mobile Responsive Layer (Must load after styles.css to ensure cascade overrides at same specificity)
import './features/layout/mobile-shell.css'
import './features/tasks/task-mobile.css'
import './features/scheduling/calendar-mobile.css'
import './features/dashboard/dashboard-mobile.css'
import './features/summary/summary-mobile.css'
import './features/auth/auth-mobile.css'
import './features/settings/settings-mobile.css'
import './features/admin/admin-mobile.css'

import { App } from './app/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <PwaUpdateProvider>
          <UserScopedQueryProvider>
          <I18nProvider>
            <SessionVerificationBoundary>
              <ConfirmProvider><App /></ConfirmProvider>
            </SessionVerificationBoundary>
          </I18nProvider>
          </UserScopedQueryProvider>
          </PwaUpdateProvider>
        </AuthProvider>
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
  </React.StrictMode>,
)
