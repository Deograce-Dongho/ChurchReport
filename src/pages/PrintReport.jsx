import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer } from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { getAttendanceForService } from '../lib/attendanceService'
import logo from '../assets/logo.jpg'

const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Church Name'

// Format dates using the local calendar.
function getDateParts(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    date,
  }
}

function formatLongDate(value) {
  const parts = getDateParts(value)
  if (!parts) return 'Invalid date'

  return parts.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShortDate(value) {
  const parts = getDateParts(value)
  if (!parts) return 'Invalid date'

  return parts.date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fileDate(value) {
  const parts = getDateParts(value)
  if (!parts) return 'unknown-date'

  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`
}

const byName = (a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

function AttendanceTable({ title, rows }) {
  if (rows.length === 0) return null

  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-800">
        {title} ({rows.length})
      </h4>

      <table className="mt-2 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-slate-600">
            <th className="w-10 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Attendance type</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.id}-${index}`}
              className="break-inside-avoid border-b border-slate-100"
            >
              <td className="py-1.5 text-slate-500">{index + 1}</td>
              <td className="break-words py-1.5 pr-2 text-slate-900">
                {row.name}
              </td>
              <td className="py-1.5 text-slate-700">
                {row.presenceType || 'Unknown'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PrintReport() {
  const [services, setServices] = useState([])
  const [people, setPeople] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const printAreaRef = useRef(null)

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

        const sortedServices = [...serviceRows].sort(
          (a, b) =>
            new Date(b.service_date).getTime() -
            new Date(a.service_date).getTime()
        )

        setServices(sortedServices)
        setPeople(peopleRows)
        setSelectedId(sortedServices[0]?.$id ?? '')
      } catch (err) {
        console.error('Could not load reports:', err)

        if (!cancelled) {
          setError(err.message || 'Could not load the reports.')
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

  // Load attendance for the selected service.
  useEffect(() => {
    let cancelled = false

    async function loadAttendance() {
      setRecords([])
      setError('')

      if (!selectedId) {
        setReportLoading(false)
        return
      }

      setReportLoading(true)

      try {
        const rows = await getAttendanceForService(selectedId)

        if (!cancelled) setRecords(rows)
      } catch (err) {
        console.error('Could not load attendance:', err)

        if (!cancelled) {
          setError(err.message || 'Could not load the attendance list.')
        }
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }

    loadAttendance()

    return () => {
      cancelled = true
    }
  }, [selectedId])

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.$id, person])),
    [people]
  )

  const service = services.find((item) => item.$id === selectedId) ?? null

  const attendees = useMemo(
    () =>
      records
        .map((record) => {
          const person = peopleById.get(record.memberId)

          return {
            id: record.memberId || record.$id,
            name: person?.name || 'Unknown person',
            isVisitor: person?.person_type === 'visitor',
            presenceType: record.presenceType || 'Unknown',
          }
        })
        .sort(byName),
    [records, peopleById]
  )

  const memberRows = attendees.filter((person) => !person.isVisitor)
  const visitorRows = attendees.filter((person) => person.isVisitor)

  const inPersonCount = attendees.filter(
    (person) => person.presenceType === 'In person'
  ).length

  const onlineCount = attendees.filter(
    (person) => person.presenceType === 'Online'
  ).length

  // Download the report as a PDF made of real text (not an image).
  async function handleDownloadPDF() {
    if (!service || reportLoading || downloading) return

    setError('')
    setDownloading(true)

    try {
      // jsPDF is only downloaded when a PDF is requested
      const { downloadServiceReportPdf } = await import('../lib/pdf/downloads')

      await downloadServiceReportPdf(
        {
          dateLong: formatLongDate(service.service_date),
          preacher: service.preacher_name,
          sermonTitle: service.sermon_title,
          keyPoints: service.sermon_key_points,
          summary: {
            total: attendees.length,
            inPerson: inPersonCount,
            online: onlineCount,
            members: memberRows.length,
            visitors: visitorRows.length,
          },
          memberRows,
          visitorRows,
        },
        `Sunday-Report-${fileDate(service.service_date)}.pdf`
      )
    } catch (err) {
      console.error('Could not generate PDF:', err)
      setError(
        'Could not generate the PDF. Please try again or check the browser console.'
      )
    } finally {
      setDownloading(false)
    }
  }

  // Open the browser print dialog.
  function handlePrint() {
    if (!service || reportLoading || !printAreaRef.current) return

    const previousTitle = document.title
    document.title = `Sunday-Report-${fileDate(service.service_date)}`

    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  const busy = loading || reportLoading

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-900">
            Print Report
          </h1>
          <p className="mt-1 text-slate-500">
            Preview, download or print a Sunday service report.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-auto">
            <label
              htmlFor="service-select"
              className="mb-1 block text-xs text-slate-600"
            >
              Service
            </label>

            <select
              id="service-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={loading || services.length === 0 || downloading}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-600 disabled:opacity-60 sm:w-72 sm:text-sm"
            >
              {services.length === 0 && (
                <option value="">No reports yet</option>
              )}

              {services.map((item) => (
                <option key={item.$id} value={item.$id}>
                  {formatShortDate(item.service_date)} - {item.sermon_title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!service || busy || downloading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-3 font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Download size={18} />
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!service || busy || downloading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Printer size={18} />
              Print report
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 print:hidden">
          Loading reports...
        </p>
      ) : !service ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 sm:p-8 print:hidden">
          No saved reports yet.{' '}
          <Link to="/sunday-report" className="font-medium text-brand-600 underline">
            Create the first Sunday report
          </Link>
          .
        </p>
      ) : (
        // Preview and browser print. The downloaded PDF is built separately,
        // as text (see src/lib/pdf/serviceReportPdf.js): keep both in sync.
        <article
          ref={printAreaRef}
          id="print-area"
          className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-8"
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
              <p className="mt-1 text-slate-600">Sunday Service Report</p>
            </div>
          </header>

          <div className="mt-5">
            <h3 className="font-semibold">Service information</h3>

            <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-slate-500">Date</dt>
              <dd>{formatLongDate(service.service_date)}</dd>

              <dt className="text-slate-500">Preacher</dt>
              <dd className="break-words">
                {service.preacher_name || 'Not specified'}
              </dd>

              <dt className="text-slate-500">Sermon title</dt>
              <dd className="break-words">
                {service.sermon_title || 'Not specified'}
              </dd>
            </dl>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold">Sermon key points</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
              {service.sermon_key_points?.trim() || 'No key points recorded.'}
            </p>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold">Attendance summary</h3>

            {reportLoading ? (
              <p className="mt-2 text-sm text-slate-500">
                Loading attendance...
              </p>
            ) : (
              <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-semibold">{attendees.length}</dd>

                <dt className="text-slate-500">In person</dt>
                <dd>{inPersonCount}</dd>

                <dt className="text-slate-500">Online</dt>
                <dd>{onlineCount}</dd>

                <dt className="text-slate-500">Members</dt>
                <dd>{memberRows.length}</dd>

                <dt className="text-slate-500">Visitors</dt>
                <dd>{visitorRows.length}</dd>
              </dl>
            )}
          </div>

          {!reportLoading && (
            <div className="mt-5">
              <h3 className="font-semibold">Attendance list</h3>

              {attendees.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No attendance recorded for this service.
                </p>
              ) : (
                <>
                  <AttendanceTable title="Members" rows={memberRows} />
                  <AttendanceTable title="Visitors" rows={visitorRows} />
                </>
              )}
            </div>
          )}

          <footer className="mt-10 flex break-inside-avoid flex-wrap items-end justify-between gap-6 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <span>
              Generated on {formatShortDate(new Date().toISOString())}
            </span>

            <span className="w-56 max-w-full border-b border-slate-400 pb-6 text-right">
              Secretary&apos;s signature
            </span>
          </footer>
        </article>
      )}
    </section>
  )
}
