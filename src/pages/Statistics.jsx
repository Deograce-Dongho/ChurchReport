import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { usePeriod } from '../lib/usePeriod'
import { formatShortDate, servicesInRange, toInputDate } from '../lib/periods'
import PeriodPicker from '../components/PeriodPicker'
import logo from '../assets/logo.jpg'

// Set VITE_CHURCH_NAME in .env (and in Vercel) to print your church name.
const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Church Name'

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

export default function Statistics() {
  const [services, setServices] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Selected period: a preset or custom dates
  const period = usePeriod('3m')
  const { range } = period
  const periodLabel = range.valid ? range.label : ''

  const [downloading, setDownloading] = useState(false)
  const [pdfError, setPdfError] = useState('')

  // Load all services and people once
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

  // Services of the period, oldest first
  const orderedServices = useMemo(
    () => (range.valid ? servicesInRange(services, range.start, range.end) : []),
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

  // Totals and one row per service
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
        if (record.presenceType === 'In person') row.inPerson++
        else row.online++

        const isVisitor = peopleById.get(record.memberId)?.person_type === 'visitor'

        if (isVisitor) {
          row.visitors++
          row.visitorIds.push(record.memberId)
        } else {
          row.members++
        }
      }

      return row
    })

    const sum = (key) => rows.reduce((total, row) => total + row[key], 0)

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
      averageMembers: serviceCount ? memberAttendances / serviceCount : 0,
      memberAttendances,
      visitorAttendances,
      uniqueVisitors: new Set(rows.flatMap((row) => row.visitorIds)).size,
      inPerson,
      online,
      inPersonPercent,
      onlinePercent: totalAttendances ? 100 - inPersonPercent : 0,
    }
  }, [ready, orderedServices, attendanceById, peopleById])

  const canDownload = range.valid && ready && !!stats && stats.serviceCount > 0

  async function handleDownloadPDF() {
    if (!canDownload || downloading) return

    setPdfError('')
    setDownloading(true)

    try {
      // jsPDF is only downloaded when a PDF is requested
      const { downloadStatisticsPdf } = await import('../lib/pdf/downloads')

      await downloadStatisticsPdf(
        { periodLabel, stats },
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
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">
          Attendance Statistics
        </h1>
        <p className="mt-1 text-slate-500">
          Choose a period, review the figures and download them as a PDF.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-3 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Download size={18} />
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      {pdfError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {pdfError}
        </p>
      )}

      {attendanceError && !ready && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
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

      {loading ? (
        <p className="text-sm text-slate-500">Loading statistics...</p>
      ) : loadError || !range.valid ? null : !ready ? (
        attendanceError ? null : (
          <p className="text-sm text-slate-500">Loading statistics...</p>
        )
      ) : !stats || stats.serviceCount === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 sm:p-8">
          No services recorded between {periodLabel}.{' '}
          <Link to="/sunday-report" className="font-medium text-brand-600 underline">
            Create a Sunday report
          </Link>
          .
        </p>
      ) : (
        // On-screen preview. The downloaded PDF is built separately, as text
        // (see src/lib/pdf/statisticsPdf.js): keep both in sync.
        <article
          className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-8"
        >
          <header className="flex items-center gap-4 border-b border-slate-300 pb-5">
            <img
              src={logo}
              alt=""
              className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
            />

            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-brand-900 sm:text-2xl">
                {CHURCH_NAME}
              </h2>
              <p className="mt-1 text-slate-600">Attendance Statistics</p>
              <p className="mt-1 text-sm text-slate-500">Period: {periodLabel}</p>
            </div>
          </header>

          <div className="mt-5">
            <h3 className="font-semibold">Summary</h3>

            <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-slate-500">Services held</dt>
              <dd>{stats.serviceCount}</dd>

              <dt className="text-slate-500">Total attendances</dt>
              <dd className="font-semibold">{stats.totalAttendances}</dd>

              <dt className="text-slate-500">Average / service</dt>
              <dd>{numberFormat.format(stats.average)}</dd>

              <dt className="text-slate-500">In person</dt>
              <dd>{`${stats.inPerson} (${stats.inPersonPercent}%)`}</dd>

              <dt className="text-slate-500">Online</dt>
              <dd>{`${stats.online} (${stats.onlinePercent}%)`}</dd>

              <dt className="text-slate-500">Members</dt>
              <dd>
                {`${stats.memberAttendances} attendances, on average ${numberFormat.format(
                  stats.averageMembers
                )} per service`}
              </dd>

              <dt className="text-slate-500">Visitors</dt>
              <dd>
                {`${stats.visitorAttendances} attendances, ${stats.uniqueVisitors} different visitor(s)`}
              </dd>
            </dl>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold">Attendance by service</h3>

            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Attendance by service table"
            >
              <table className="mt-2 w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 font-medium">Sermon</th>
                    <th className="py-2 pr-2 font-medium">In person</th>
                    <th className="py-2 pr-2 font-medium">Online</th>
                    <th className="py-2 pr-2 font-medium">Members</th>
                    <th className="py-2 pr-2 font-medium">Visitors</th>
                    <th className="py-2 font-medium">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {stats.rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap py-1.5 pr-2 text-slate-700">
                        {formatShortDate(row.date)}
                      </td>
                      <td className="py-1.5 pr-2 text-slate-700">{row.title}</td>
                      <td className="py-1.5 pr-2">{row.inPerson}</td>
                      <td className="py-1.5 pr-2">{row.online}</td>
                      <td className="py-1.5 pr-2">{row.members}</td>
                      <td className="py-1.5 pr-2">{row.visitors}</td>
                      <td className="py-1.5 font-semibold">{row.total}</td>
                    </tr>
                  ))}

                  <tr className="font-bold text-brand-900">
                    <td className="py-2 pr-2" colSpan={2}>
                      Total
                    </td>
                    <td className="py-2 pr-2">{stats.inPerson}</td>
                    <td className="py-2 pr-2">{stats.online}</td>
                    <td className="py-2 pr-2">{stats.memberAttendances}</td>
                    <td className="py-2 pr-2">{stats.visitorAttendances}</td>
                    <td className="py-2">{stats.totalAttendances}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <footer className="mt-10 flex items-end justify-between gap-6 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <span>Generated on {formatShortDate(new Date())}</span>
          </footer>
        </article>
      )}
    </section>
  )
}
