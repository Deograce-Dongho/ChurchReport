import { Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import Sidebar from '../components/Sidebar'
import { useAuth } from '../lib/AuthContext'

const pageTitles = {
  '/': 'Dashboard',
  '/sunday-report': 'Sunday Report',
  '/members': 'Members & Visitors',
  '/statistics': 'Statistics',
  '/print-report': 'Print Report',
}

export default function DashboardLayout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const title = pageTitles[location.pathname] ?? 'ChurchReport'

  return (
    <div className="flex min-h-screen bg-[#F7F9FC]">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h2 className="text-xl font-semibold text-[#142D4E]">{title}</h2>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        <main className="p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}