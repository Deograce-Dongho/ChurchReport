import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  Plus,
  Printer,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { formatShortDate } from '../lib/periods'
import AttendanceChart from '../components/AttendanceChart'

// Average attendance uses the four latest services.
const RECENT_COUNT = 4

// The dashboard chart displays the eight latest services.
const CHART_COUNT = 8

// Attendance goal used for the "achieved" indicator.
const ATTENDANCE_TARGET = 50

const numberFormat = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 1,
})

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

// Small rounded icon badge used in the cards.
function IconBadge({ icon: Icon, size = 18 }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand-600">
      <Icon size={size} strokeWidth={2} />
    </span>
  )
}

// Summary card: label + icon, content, divider, footer.
function StatCard({ label, icon, children, footer }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <IconBadge icon={icon} />
      </div>

      <div className="mt-3 min-w-0 flex-1">{children}</div>

      <div className="mt-4 flex min-h-9 items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {footer}
      </div>
    </article>
  )
}

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
          listServices(),
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

  // Four latest services for the average attendance.
  const recentServices = useMemo(
    () => services.slice(0, RECENT_COUNT),
    [services]
  )

  // Eight latest services, ordered from oldest to newest.
  const chartServices = useMemo(
    () => services.slice(0, CHART_COUNT).reverse(),
    [services]
  )

  const lastService = recentServices[0] ?? null

  const {
    attendanceById,
    ready,
    error: attendanceError,
    retry,
  } = useServicesAttendance(chartServices)

  const memberList = useMemo(
    () => people.filter((person) => person.person_type !== 'visitor'),
    [people]
  )

  const memberCount = memberList.length
  const visitorCount = people.length - memberCount

  // Growth vs. the end of the previous month, based on creation date.
  const memberGrowth = useMemo(() => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const previous = memberList.filter(
      (person) =>
        person.$createdAt && new Date(person.$createdAt) < startOfMonth
    ).length

    if (previous === 0) return null

    return ((memberCount - previous) / previous) * 100
  }, [memberList, memberCount])

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.$id, person])),
    [people]
  )

  const lastTotal = lastService
    ? attendanceById[lastService.$id]?.length
    : null

  // Prepare the chart data.
  const chartData = useMemo(() => {
    if (!ready) return []

    return chartServices.map((service) => {
      const records = attendanceById[service.$id] ?? []

      const visitors = records.filter(
        (record) =>
          peopleById.get(record.memberId)?.person_type === 'visitor'
      ).length

      return {
        date: service.service_date,
        members: records.length - visitors,
        visitors,
        total: records.length,
      }
    })
  }, [ready, chartServices, attendanceById, peopleById])

  // Average attendance remains based on the four latest services.
  const average = useMemo(() => {
    if (!ready || recentServices.length === 0) return null

    const total = recentServices.reduce(
      (sum, service) => sum + (attendanceById[service.$id]?.length ?? 0),
      0
    )

    return total / recentServices.length
  }, [ready, recentServices, attendanceById])

  const achieved =
    average != null
      ? Math.min(Math.round((average / ATTENDANCE_TARGET) * 100), 999)
      : null

  const placeholder = loading ? '…' : '—'
  const showMembers = !loading && !loadError

  return (
    <section className="space-y-6 sm:space-y-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
            Welcome to ChurchReport
          </h1>

          <p className="mt-1.5 text-slate-500">
            Manage your Sunday services in one place.
          </p>
        </div>

        <Link
          to="/sunday-report"
          className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
        >
          <Plus size={18} />
          New Sunday Report
        </Link>
      </div>

      {/* General loading error */}
      {loadError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      {/* Attendance loading error */}
      {attendanceError && !ready && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span className="min-w-0 break-words">{attendanceError}</span>

          <button
            type="button"
            onClick={retry}
            className="min-h-11 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {/* Last service */}
        <StatCard
          label="Last service"
          icon={CalendarDays}
          footer={
            lastService ? (
              <>
                <span className="flex min-w-0 items-center gap-1.5">
                  <User size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">{lastService.preacher_name}</span>
                </span>

                {lastTotal != null && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    {lastTotal} present
                  </span>
                )}
              </>
            ) : null
          }
        >
          {lastService ? (
            <>
              <p className="text-2xl font-bold tracking-tight text-brand-900">
                {formatShortDate(lastService.service_date)}
              </p>

              <p className="mt-1 break-words text-sm text-slate-600">
                {lastService.sermon_title}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {loading ? 'Loading...' : 'No service recorded yet.'}
            </p>
          )}
        </StatCard>

        {/* Members */}
        <StatCard
          label="Members"
          icon={Users}
          footer={
            <span className="flex items-center gap-1.5">
              <UserPlus size={13} className="text-amber-500" />
              {showMembers
                ? `${visitorCount} visitor${visitorCount === 1 ? '' : 's'} on record`
                : ''}
            </span>
          }
        >
          <p className="text-3xl font-bold tracking-tight text-brand-900">
            {showMembers ? memberCount : placeholder}
          </p>

          {showMembers && memberGrowth != null && (
            <p className="mt-1 text-sm text-slate-500">
              <span
                className={`font-semibold ${
                  memberGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {memberGrowth >= 0 ? '+' : ''}
                {numberFormat.format(memberGrowth)}%
              </span>{' '}
              from previous month
            </p>
          )}
        </StatCard>

        {/* Average attendance */}
        <StatCard
          label="Average attendance"
          icon={TrendingUp}
          footer={
            <>
              <span>
                Target goal: {numberFormat.format(ATTENDANCE_TARGET)}
              </span>

              {achieved != null && (
                <span className="font-semibold text-brand-600">
                  {achieved}% achieved
                </span>
              )}
            </>
          }
        >
          <p className="text-3xl font-bold tracking-tight text-brand-900">
            {average != null ? numberFormat.format(average) : placeholder}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {recentServices.length > 0
              ? `Over the last ${recentServices.length} service${
                  recentServices.length === 1 ? '' : 's'
                }`
              : 'No services yet'}
          </p>
        </StatCard>
      </div>

      {/* Attendance chart */}
      {ready && !loadError && (
        <AttendanceChart
          data={chartData}
          title="Attendance trend"
          subtitle="Weekly evolution across recent congregations"
        />
      )}

      {/* Quick access */}
      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quick access
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          {shortcuts.map(({ title, description, path, icon }) => (
            <Link
              key={path}
              to={path}
              className="group flex min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-brand-600/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <IconBadge icon={icon} />

              <h3 className="mt-5 font-semibold text-brand-900">{title}</h3>

              <p className="mt-1.5 flex-1 text-sm text-slate-500">
                {description}
              </p>

              <ArrowRight
                size={16}
                className="mt-4 self-end text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}