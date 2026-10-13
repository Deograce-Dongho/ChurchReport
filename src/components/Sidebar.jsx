
import { NavLink } from 'react-router-dom'
import {
  Church,
  LayoutDashboard,
  FileText,
  Users,
  ChartNoAxesColumn,
  Printer,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sunday Report', path: '/sunday-report', icon: FileText },
  { name: 'Members & Visitors', path: '/members', icon: Users },
  { name: 'Statistics', path: '/statistics', icon: ChartNoAxesColumn },
  { name: 'Print Report', path: '/print-report', icon: Printer },
]

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-[#142D4E] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
        <Church size={30} />
        <div>
          <h1 className="text-lg font-bold">ChurchReport</h1>
          <p className="text-xs text-blue-200">
            Sunday Service Management
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-6">
        {navigation.map(({ name, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={20} />
            <span>{name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-4">
        <p className="text-xs text-blue-200">
          Church Management
        </p>
      </div>
    </aside>
  )
}
