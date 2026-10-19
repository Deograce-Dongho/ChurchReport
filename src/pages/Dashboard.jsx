import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  Plus,
  Printer,
  Users,
} from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { formatShortDate } from '../lib/periods'

// Number of most recent services used for the average attendance
const RECENT_COUNT = 4

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

const shortcuts = [
  {
    title: 'Sunday Report',
    description: 'Create the weekly service report.',
    path: '/sunday-report',
    icon: FileText,
  },
  {
    title: 'Members & Visitors',
    description: 'Manage people and follow their attendance.',
    path: '/members',
    icon: Users,
  },
  {
    title: 'Statistics',
    description: 'Review attendance over a period.',
    path: '/statistics',
    icon: ChartNoAxesColumn,
  },
  {
    title: 'Print Report',
    description: 'Preview, download or print a report.',
    path: '/print-report',
    icon: Printer,
  },
]

export default function Dashboard() {
  const [services, setServices] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [serviceRows, peopleRows] = await Promise.all([
          listServices(), // newest first
          getMembers(),
        ])

        if (cancelled) return

        setServices(serviceRows)
        setPeople(peopleRows)
      } catch (err) {
        console.error('Could not load the dashboard:', err)
        if (!cancelled) {
          setLoadError(err.message || 'Could not load the dashboard.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  // Most recent services, newest first
  const recentServices = useMemo(
    () => services.slice(0, RECENT_COUNT),
    [services]
  )

  const lastService = recentServices[0] ?? null

  const {
    attendanceById,
    ready,
    error: attendanceError,
    retry,
  } = useServicesAttendance(recentServices)

  const memberCount = useMemo(
    () => people.filter((person) => person.person_type !== 'visitor').length,
    [people]
  )
  const visitorCount = people.length - memberCount

  const lastTotal = lastService ? attendanceById[lastService.$id]?.length : null

  const average = useMemo(() => {
    if (!ready || recentServices.length === 0) return null

    const total = recentServices.reduce(
      (sum, service) => sum + (attendanceById[service.$id]?.length ?? 0),
      0
    )

    return total / recentServices.length
  }, [ready, recentServices, attendanceById])

  const cardClass = 'rounded-xl border border-slate-200 bg-white p-5'
  const placeholder = loading ? '…' : '—'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Welcome to ChurchReport
          </h1>
          <p className="mt-2 text-slate-500">
            Manage your Sunday services in one place.
          </p>
        </div>

        <Link
          to="/sunday-report"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          New Sunday Report
        </Link>
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      {attendanceError && !ready && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span>{attendanceError}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className={cardClass}>
          <CalendarDays size={24} className="text-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Last service</p>
          {lastService ? (
            <>
              <p className="mt-1 text-lg font-bold text-[#142D4E]">
                {formatShortDate(lastService.service_date)}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {lastService.sermon_title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {lastService.preacher_name}
                {lastTotal != null && ` · ${lastTotal} present`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              {loading ? 'Loading...' : 'No service recorded yet.'}
            </p>
          )}
        </article>

        <article className={cardClass}>
          <Users size={24} className="text-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Members</p>
          <p className="mt-1 text-2xl font-bold text-[#142D4E]">
            {loading || loadError ? placeholder : memberCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {loading || loadError ? '' : `${visitorCount} visitor(s) on record`}
          </p>
        </article>

        <article className={cardClass}>
          <ChartNoAxesColumn size={24} className="text-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Average attendance</p>
          <p className="mt-1 text-2xl font-bold text-[#142D4E]">
            {average != null ? numberFormat.format(average) : placeholder}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {recentServices.length > 0
              ? `Over the last ${recentServices.length} service(s)`
              : 'No services yet'}
          </p>
        </article>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {shortcuts.map(({ title, description, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon size={28} className="text-blue-600" />
            <h2 className="mt-4 font-semibold text-[#142D4E]">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}