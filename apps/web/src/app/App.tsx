import { Link, Route, Routes } from 'react-router-dom'
import { DashboardPage } from '../pages/DashboardPage'
import { TasksPage } from '../pages/TasksPage'
import { CalendarPage } from '../pages/CalendarPage'
import { SummaryPage } from '../pages/SummaryPage'
import { SettingsPage } from '../pages/SettingsPage'

export function App() {
  return (
    <div className="app-shell">
      <aside>
        <h1>Task MVP</h1>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/tasks">Tasks</Link>
          <Link to="/calendar">Calendar</Link>
          <Link to="/summary">Summary</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
