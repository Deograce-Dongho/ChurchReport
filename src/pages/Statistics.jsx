import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { usePeriod } from '../lib/usePeriod'
import {
  formatShortDate,
  servicesInRange,
  toInputDate,
} from '../lib/periods'

import PeriodPicker from '../components/PeriodPicker'
import AttendanceChart from '../components/AttendanceChart'

const numberFormat = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 1,
})

// Tone of the main value in a KPI card.
const VALUE_TONES = {
  default: 'text-brand-900',
  blue: 'text-sky-700',
  orange: 'text-orange-600',
}

// One summary card: label, big value, small note.
function KpiCard({ label, value, note, tone = 'default' }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5">
      <p className="text-xs font-medium leading-tight text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${VALUE_TONES[tone]}`}
      >
        {value}
      </p>

      {note && (
        <p className="mt-1 text-xs text-slate-400">{note}</p>
      )}
    </article>
  )
}

const thClass =
  'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'

export default function Statistics() {
  const [services, setServices] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Selected period.
  const period = usePeriod('3m')
  const { range } = period
  const periodLabel = range.valid ? range.label : ''

  const [downloading, setDownloading] = useState(false)
  const [pdfError, setPdfError] = useState('')

  // Load services and people once.
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
        console.error('Could not load statistics data:', err)

        if (!cancelled) {
          setLoadError(err.message || 'Could not load the statistics.')
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

  // Services of the selected period, oldest first.
  const orderedServices = useMemo(
    () =>
      range.valid
        ? servicesInRange(services, range.start, range.end)
        : [],
    [services, range]
  )

  const {
    attendanceById,
    ready,
    error: attendanceError,
    retry,
  } = useServicesAttendance(orderedServices)

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.$id, person])),
    [people]
  )

  // Calculate statistics and one row per service.
  const stats = useMemo(() => {
    if (!ready) return null

    const rows = orderedServices.map((service) => {
      const records = attendanceById[service.$id] ?? []

      const row = {
        id: service.$id,
        date: service.service_date,
        title: service.sermon_title,
        total: records.length,
        inPerson: 0,
        online: 0,
        members: 0,
        visitors: 0,
        visitorIds: [],
      }

      for (const record of records) {
        if (record.presenceType === 'In person') {
          row.inPerson++
        } else {
          row.online++
        }

        const isVisitor =
          peopleById.get(record.memberId)?.person_type === 'visitor'

        if (isVisitor) {
          row.visitors++
          row.visitorIds.push(record.memberId)
        } else {
          row.members++
        }
      }

      return row
    })

    const sum = (key) =>
      rows.reduce((total, row) => total + row[key], 0)

    const inPerson = sum('inPerson')
    const online = sum('online')

    const memberAttendances = sum('members')
    const visitorAttendances = sum('visitors')

    const serviceCount = rows.length
    const totalAttendances = inPerson + online

    const inPersonPercent = totalAttendances
      ? Math.round((inPerson / totalAttendances) * 100)
      : 0

    return {
      rows,
      serviceCount,
      totalAttendances,
      average: serviceCount ? totalAttendances / serviceCount : 0,
      averageMembers: serviceCount
        ? memberAttendances / serviceCount
        : 0,
      memberAttendances,
      visitorAttendances,
      uniqueVisitors: new Set(rows.flatMap((row) => row.visitorIds))
        .size,
      inPerson,
      online,
      inPersonPercent,
      onlinePercent: totalAttendances ? 100 - inPersonPercent : 0,
    }
  }, [ready, orderedServices, attendanceById, peopleById])

  // Chart data.
  const chartData = useMemo(
    () =>
      stats
        ? stats.rows.map((row) => ({
            date: row.date,
            members: row.members,
            visitors: row.visitors,
            total: row.total,
          }))
        : [],
    [stats]
  )

  // Summary cards.
  const kpis = useMemo(() => {
    if (!stats) return []

    return [
      {
        label: 'Services held',
        value: stats.serviceCount,
        note: 'In this period',
      },
      {
        label: 'Total attendances',
        value: stats.totalAttendances,
        note: 'In person + online',
      },
      {
        label: 'Average / service',
        value: numberFormat.format(stats.average),
        note: 'Attendees',
        tone: 'blue',
      },
      {
        label: 'In person',
        value: stats.inPerson,
        note: `${stats.inPersonPercent}%`,
      },
      {
        label: 'Online',
        value: stats.online,
        note: `${stats.onlinePercent}%`,
      },
      {
        label: 'Members',
        value: stats.memberAttendances,
        note: `Avg ${numberFormat.format(stats.averageMembers)} / service`,
        tone: 'blue',
      },
      {
        label: 'Visitors',
        value: stats.visitorAttendances,
        note: `${stats.uniqueVisitors} distinct`,
        tone: 'orange',
      },
    ]
  }, [stats])

  const canDownload =
    range.valid && ready && !!stats && stats.serviceCount > 0

  // Download PDF.
  async function handleDownloadPDF() {
    if (!canDownload || downloading) return

    setPdfError('')
    setDownloading(true)

    try {
      const { downloadStatisticsPdf } = await import(
        '../lib/pdf/downloads'
      )

      await downloadStatisticsPdf(
        {
          periodLabel,
          stats,
        },
        `Statistics-${toInputDate(range.start)}-to-${toInputDate(range.end)}.pdf`
      )
    } catch (err) {
      console.error('Could not generate PDF:', err)

      setPdfError(
        'Could not generate the PDF. Please try again or check the browser console.'
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="space-y-6 sm:space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
          Attendance Statistics
        </h1>

        <p className="mt-1.5 text-slate-500">
          Choose a period, review the figures and download them as a PDF.
        </p>
      </div>

      {/* Period filters and PDF button */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PeriodPicker
            variant="chips"
            label="Period"
            idPrefix="stats-period"
            period={period}
            disabled={loading || downloading}
          />

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!canDownload || downloading}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Download size={18} />

            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
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

      {/* PDF error */}
      {pdfError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {pdfError}
        </p>
      )}

      {/* Attendance error */}
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

      {/* Loading, empty state or statistics */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading statistics...</p>
      ) : loadError || !range.valid ? null : !ready ? (
        attendanceError ? null : (
          <p className="text-sm text-slate-500">Loading statistics...</p>
        )
      ) : !stats || stats.serviceCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 sm:p-8">
          No services recorded between {periodLabel}.{' '}
          <Link
            to="/sunday-report"
            className="font-medium text-brand-600 underline"
          >
            Create a Sunday report
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Summary overview */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Summary overview
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </div>
          </div>

          {/* Attendance chart */}
          <AttendanceChart
            data={chartData}
            title="Attendance trend"
            subtitle={`Attendance across ${stats.serviceCount} service${
              stats.serviceCount === 1 ? '' : 's'
            }`}
          />

          {/* Attendance table */}
          <section className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-base font-bold text-brand-900">
                Attendance by service
              </h2>

              <p className="text-xs text-slate-400">
                {stats.serviceCount} individual service session
                {stats.serviceCount === 1 ? '' : 's'} recorded
              </p>
            </div>

            <div
              className="overflow-x-auto rounded-xl border border-slate-200"
              tabIndex={0}
              role="region"
              aria-label="Attendance by service table"
            >
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Sermon title</th>
                    <th className={`${thClass} text-right`}>In person</th>
                    <th className={`${thClass} text-right`}>Online</th>
                    <th className={`${thClass} text-right`}>Members</th>
                    <th className={`${thClass} text-right`}>Visitors</th>
                    <th className={`${thClass} text-right`}>Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {stats.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-brand-900">
                        {formatShortDate(row.date)}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {row.title}
                      </td>

                      <td className="px-4 py-3.5 text-right text-slate-700">
                        {row.inPerson}
                      </td>

                      <td className="px-4 py-3.5 text-right text-slate-500">
                        {row.online}
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium text-sky-700">
                        {row.members}
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium text-orange-600">
                        {row.visitors}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-brand-900">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Grand total */}
                <tfoot>
                  <tr className="border-t border-slate-200 bg-sky-50/60 font-bold text-brand-900">
                    <td className="px-4 py-3.5" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {stats.inPerson}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {stats.online}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sky-700">
                      {stats.memberAttendances}
                    </td>
                    <td className="px-4 py-3.5 text-right text-orange-600">
                      {stats.visitorAttendances}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {stats.totalAttendances}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Generated on {formatShortDate(new Date())} · Period:{' '}
              {periodLabel}
            </p>
          </section>
        </>
      )}
    </section>
  )
}