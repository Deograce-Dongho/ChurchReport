
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const pageTitles = {
  '/': 'Dashboard',
  '/sunday-report': 'Sunday Report',
  '/members': 'Members & Visitors',
  '/statistics': 'Statistics',
  '/print-report': 'Print Report',
}

export default function DashboardLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'ChurchReport'

  return (
    <div className="flex min-h-screen bg-[#F7F9FC]">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center border-b border-slate-200 bg-white px-8">
          <h2 className="text-xl font-semibold text-[#142D4E]">
            {title}
          </h2>
        </header>

        <main className="p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
