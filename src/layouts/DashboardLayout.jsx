import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'

import Sidebar from '../components/Sidebar'
import { useAuth } from '../lib/AuthContext'
import logo from '../assets/logo.jpg'

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

  // The drawer remembers the page it was opened on: as soon as the route
  // changes it counts as closed, without any extra effect.
  const [openedOn, setOpenedOn] = useState(null)
  const drawerOpen = openedOn === location.pathname

  const menuButtonRef = useRef(null)

  function openDrawer() {
    setOpenedOn(location.pathname)
  }

  function closeDrawer() {
    setOpenedOn(null)
  }

  // While the drawer is open: Escape closes it, the page behind does not
  // scroll, and the focus goes back to the menu button when it closes.
  useEffect(() => {
    if (!drawerOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpenedOn(null)
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      menuButtonRef.current?.focus()
    }
  }, [drawerOpen])

  // Rotating the device or widening the window to desktop size closes it
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')

    function handleChange(event) {
      if (event.matches) setOpenedOn(null)
    }

    query.addEventListener('change', handleChange)

    return () => query.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar open={drawerOpen} onClose={closeDrawer} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 bg-brand-600 px-2 text-white shadow-md sm:px-4 lg:h-20 lg:px-8 print:hidden">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={openDrawer}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="app-sidebar"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            >
              <Menu size={24} />
            </button>

            <img
              src={logo}
              alt=""
              className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5 lg:hidden"
            />

            <h2 className="truncate text-lg font-semibold text-white lg:text-xl">
              {title}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <span className="hidden max-w-[16rem] truncate text-sm text-white/80 md:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-white/40 px-3 text-sm font-medium text-white hover:bg-white/10"
            >
              <LogOut size={16} />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </button>
          </div>
        </header>

        <main className="overflow-x-clip p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}