import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { usePeriod } from '../lib/usePeriod'
import { downloadElementAsPDF } from '../lib/pdfExport'
import { formatShortDate, servicesInRange, toInputDate } from '../lib/periods'
import PeriodPicker from '../components/PeriodPicker'

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

  const reportRef = useRef(null)

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
      await downloadElementAsPDF(
        reportRef.current,
        `Statistics-${toInputDate(range.start)}-to-${toInputDate(range.end)}.pdf`,
        { pageNumbers: true }
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
        <h1 className="text-2xl font-bold text-[#142D4E]">
          Attendance Statistics
        </h1>
        <p className="mt-1 text-slate-500">
          Choose a period, review the figures and download them as a PDF.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
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
            className="flex items-center gap-2 rounded-lg bg-[#142D4E] px-4 py-3 text-sm font-medium text-white hover:bg-[#1d416c] disabled:cursor-not-allowed disabled:opacity-50"
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

      {loading ? (
        <p className="text-sm text-slate-500">Loading statistics...</p>
      ) : loadError || !range.valid ? null : !ready ? (
        attendanceError ? null : (
          <p className="text-sm text-slate-500">Loading statistics...</p>
        )
      ) : !stats || stats.serviceCount === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No services recorded between {periodLabel}.{' '}
          <Link to="/sunday-report" className="font-medium text-blue-600">
            Create a Sunday report
          </Link>
          .
        </p>
      ) : (
        // This article is both the on-screen preview and the source of the PDF.
        <article
          ref={reportRef}
          className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-slate-900"
        >
          <header className="border-b border-slate-300 pb-5">
            <h2 className="text-2xl font-bold text-[#142D4E]">{CHURCH_NAME}</h2>
            <p className="mt-1 text-slate-600">Attendance Statistics</p>
            <p className="mt-1 text-sm text-slate-500">Period: {periodLabel}</p>
          </header>

          <div className="mt-5">
            <h3 className="font-semibold">Summary</h3>

            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-slate-500">Services held</dt>
              <dd>{stats.serviceCount}</dd>

              <dt className="text-slate-500">Total attendances</dt>
              <dd className="font-semibold" style={{ fontWeight: 700 }}>
                {stats.totalAttendances}
              </dd>

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

            <div className="overflow-x-auto">
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
                    <tr
                      key={row.id}
                      className="border-b border-slate-100"
                      style={{ breakInside: 'avoid' }}
                    >
                      <td
                        className="py-1.5 pr-2 text-slate-700"
                        style={{ whiteSpace: 'nowrap' }}
                      >
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

                  <tr
                    className="font-semibold text-[#142D4E]"
                    style={{ fontWeight: 700, breakInside: 'avoid' }}
                  >
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

          <footer
            className="mt-10 flex items-end justify-between gap-6 border-t border-slate-300 pt-4 text-xs text-slate-500"
            style={{ breakInside: 'avoid' }}
          >
            <span>Generated on {formatShortDate(new Date())}</span>
          </footer>
        </article>
      )}
    </section>
  )
}