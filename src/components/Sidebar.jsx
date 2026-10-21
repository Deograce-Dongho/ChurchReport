import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  ChartNoAxesColumn,
  Printer,
  X,
} from 'lucide-react'

import logo from '../assets/logo.jpg'

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sunday Report', path: '/sunday-report', icon: FileText },
  { name: 'Members & Visitors', path: '/members', icon: Users },
  { name: 'Statistics', path: '/statistics', icon: ChartNoAxesColumn },
  { name: 'Print Report', path: '/print-report', icon: Printer },
]

// Navigation menu.
//   - from `lg` (1024 px): a fixed column on the left;
//   - below `lg`: a drawer that slides in over a dimmed page.
//
// `open` and `onClose` only matter for the drawer. The parent closes it on
// Escape; this component closes it on a click outside and after a link click,
// moves the focus into it when it opens, and keeps Tab inside while it is open.
export default function Sidebar({ open = false, onClose = () => {} }) {
  const asideRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])

  function handleKeyDown(event) {
    if (!open || event.key !== 'Tab') return

    const items = asideRef.current?.querySelectorAll(
      'a[href], button:not([disabled])'
    )

    if (!items || items.length === 0) return

    const first = items[0]
    const last = items[items.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-brand-950/60 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        ref={asideRef}
        onKeyDown={handleKeyDown}
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-brand-900 text-white shadow-xl transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none lg:sticky lg:inset-y-auto lg:top-0 lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:visible lg:translate-x-0 lg:shadow-none print:hidden ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5 lg:px-6 lg:py-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* The logo is designed for a light background: it sits on a
                white tile so it stays readable on the dark sidebar */}
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
              <img src={logo} alt="" className="h-full w-full object-contain" />
            </span>

            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">
                ChurchReport
              </p>
              <p className="text-xs text-brand-200">
                Sunday Service Management
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 lg:space-y-2 lg:py-6">
          {navigation.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-brand-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className="min-w-0">{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-xs text-brand-200">Church Management</p>
        </div>
      </aside>
    </>
  )
}
