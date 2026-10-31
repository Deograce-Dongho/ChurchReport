import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  FileText,
  Minus,
  Plus,
  Printer,
  RotateCcw,
} from 'lucide-react'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { getAttendanceForService } from '../lib/attendanceService'
import { richTextClass, sanitizeHtml, hasText } from '../lib/richText'
import ServicePicker from '../components/ServicePicker'
import logo from '../assets/logo.jpg'

const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Church Name'

// What the secretary can include in the report
const CONTENT_OPTIONS = [
  { id: 'keyPoints', label: 'Sermon key points' },
  { id: 'summary', label: 'Attendance summary' },
  { id: 'members', label: 'Members list' },
  { id: 'visitors', label: 'Visitors list' },
]

// In the on-screen preview long lists are shortened; print and PDF are complete.
const PREVIEW_LIMIT = 10

const ZOOM_MIN = 60
const ZOOM_MAX = 150
const ZOOM_STEP = 10

// Browsers remove backgrounds when printing unless told otherwise.
const PRINT_EXACT =
  '[-webkit-print-color-adjust:exact] [print-color-adjust:exact]'

const SECTION_TONES = {
  brand: {
    box: 'border-brand-600 bg-brand-50 text-brand-900',
  },
  amber: {
    box: 'border-amber-500 bg-amber-50 text-amber-900',
  },
}

// Section heading: tinted band, coloured bar, capitals, optional right label.
function SectionTitle({ children, meta, tone = 'brand' }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-r-md border-l-4 px-3 py-1.5 ${SECTION_TONES[tone].box} ${PRINT_EXACT}`}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider">{children}</h3>

      {meta && (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide opacity-75">
          {meta}
        </span>
      )}
    </div>
  )
}

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

// Small coloured pill: green for in person, blue for online.
function PresenceBadge({ type }) {
  const isPerson = type === 'In person'
  const isOnline = type === 'Online'

  const pill = isPerson
    ? 'bg-emerald-50 text-emerald-700'
    : isOnline
      ? 'bg-blue-50 text-blue-700'
      : 'bg-slate-100 text-slate-600'

  const dot = isPerson
    ? 'bg-emerald-500'
    : isOnline
      ? 'bg-blue-500'
      : 'bg-slate-400'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${pill} ${PRINT_EXACT}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {type}
    </span>
  )
}

function AttendanceTable({
  rows,
  nameLabel,
  modeLabel,
  emptyText,
  expanded,
  onExpand,
  kind,
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
  }

  const hiddenCount = Math.max(0, rows.length - PREVIEW_LIMIT)

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr
            className={`bg-slate-900 text-[11px] uppercase tracking-wider text-white ${PRINT_EXACT}`}
          >
            <th className="w-12 px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">{nameLabel}</th>
            <th className="w-40 px-3 py-2 font-semibold">{modeLabel}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const hiddenInPreview = !expanded && index >= PREVIEW_LIMIT

            return (
              <tr
                key={`${row.id}-${index}`}
                className={`break-inside-avoid border-b border-slate-100 odd:bg-white even:bg-slate-50/70 ${PRINT_EXACT} ${
                  hiddenInPreview ? 'hidden print:table-row' : ''
                }`}
              >
                <td className="px-3 py-1.5 text-xs text-slate-400">
                  {index + 1}
                </td>
                <td className="break-words px-3 py-1.5 text-slate-900">
                  {row.name}
                </td>
                <td className="px-3 py-1.5">
                  <PresenceBadge type={row.presenceType || 'Unknown'} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hiddenCount > 0 && !expanded && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 print:hidden">
          <span>
            Showing top {PREVIEW_LIMIT} of {rows.length} {kind}. All{' '}
            {rows.length} entries are included in the printout and the PDF.
          </span>

          <button
            type="button"
            onClick={onExpand}
            className="font-medium text-brand-600 hover:underline"
          >
            Show all
          </button>
        </div>
      )}
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
  const [zoom, setZoom] = useState(100)
  const [expandedMembers, setExpandedMembers] = useState(false)
  const [expandedVisitors, setExpandedVisitors] = useState(false)

  // What is shown in the preview, the printout and the PDF
  const [include, setInclude] = useState({
    keyPoints: true,
    summary: true,
    members: true,
    visitors: true,
  })

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
      setExpandedMembers(false)
      setExpandedVisitors(false)

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

  const showList = include.members || include.visitors
  const allSelected = CONTENT_OPTIONS.every((option) => include[option.id])

  const stats = [
    {
      label: 'Total',
      value: attendees.length,
      box: 'border-slate-200 bg-slate-50',
      label_: 'text-slate-500',
    },
    {
      label: 'In person',
      value: inPersonCount,
      box: 'border-sky-100 bg-sky-50',
      label_: 'text-sky-700',
    },
    {
      label: 'Online',
      value: onlineCount,
      box: 'border-indigo-100 bg-indigo-50',
      label_: 'text-indigo-700',
    },
    {
      label: 'Members',
      value: memberRows.length,
      box: 'border-emerald-100 bg-emerald-50',
      label_: 'text-emerald-700',
    },
    {
      label: 'Visitors',
      value: visitorRows.length,
      box: 'border-amber-100 bg-amber-50',
      label_: 'text-amber-700',
    },
  ]

  function toggleInclude(id) {
    setInclude((current) => ({ ...current, [id]: !current[id] }))
  }

  function toggleAll() {
    const next = !allSelected

    setInclude(
      Object.fromEntries(CONTENT_OPTIONS.map((option) => [option.id, next]))
    )
  }

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
          include,
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
    <section className="space-y-5">
      {/* Page header + actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-600">
            Document center
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="font-medium normal-case tracking-normal text-slate-400">
              Sunday service archive
            </span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-brand-900">
            Print Report
          </h1>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Preview, configure and export Sunday service attendance sheets and
            sermon highlights.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-auto">
            <label
              htmlFor="service-select"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
            >
              Selected service
            </label>

            <ServicePicker
              id="service-select"
              services={services}
              value={selectedId}
              onChange={setSelectedId}
              disabled={loading || services.length === 0 || downloading}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!service || busy || downloading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Download size={18} />
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!service || busy || downloading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Printer size={18} />
              Print report
            </button>
          </div>
        </div>
      </div>

      {/* What to include */}
      <fieldset
        disabled={downloading}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <legend className="float-left text-[11px] font-semibold uppercase tracking-wider text-brand-900">
            Include in the report
          </legend>

          <button
            type="button"
            onClick={toggleAll}
            className="ml-auto text-xs font-medium text-brand-600 hover:underline"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="clear-both mt-1 flex flex-col gap-x-8 sm:flex-row sm:flex-wrap">
          {CONTENT_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={include[option.id]}
                onChange={() => toggleInclude(option.id)}
                className="h-5 w-5 cursor-pointer accent-brand-900"
              />
              {option.label}
            </label>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          The service information and the sermon title are always included.
          This choice applies to the preview, the printout and the PDF.
        </p>
      </fieldset>

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
          <Link
            to="/sunday-report"
            className="font-medium text-brand-600 underline"
          >
            Create the first Sunday report
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Preview toolbar */}
          <div className="flex justify-center print:hidden">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
              <FileText size={14} className="mr-1 text-brand-100" />
              <span className="mr-2 font-medium">A4 Standard Preview</span>

              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-40"
              >
                <Minus size={14} />
              </button>

              <span className="w-10 text-center tabular-nums">{zoom}%</span>

              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>

              <span className="mx-1 h-4 w-px bg-white/20" />

              <button
                type="button"
                aria-label="Reset zoom"
                onClick={() => setZoom(100)}
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                aria-label="Print report"
                onClick={handlePrint}
                disabled={busy || downloading}
                className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-40"
              >
                <Printer size={14} />
              </button>
            </div>
          </div>

          {/* Preview and browser print. The downloaded PDF is built separately,
              as text (see src/lib/pdf/serviceReportPdf.js): keep both in sync. */}
          <div
            style={{ '--zoom': zoom / 100 }}
            className="[zoom:var(--zoom)] print:[zoom:1]"
          >
            <article
              ref={printAreaRef}
              id="print-area"
              className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              {/* Letterhead */}
              <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-600 pb-5">
                <div className="flex min-w-0 items-center gap-4">
                  <img
                    src={logo}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border-2 border-brand-600 bg-white object-contain p-1 sm:h-16 sm:w-16"
                  />

                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold text-brand-900 sm:text-2xl">
                      {CHURCH_NAME}
                    </h2>
                    <p className="mt-0.5 text-sm font-semibold text-brand-600">
                      Sunday Service Report
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatLongDate(service.service_date)}
                    </p>
                  </div>
                </div>
              </header>

              {/* Sermon title */}
              <div className="mt-6 border-l-4 border-brand-600 pl-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Sermon title
                </p>
                <h3 className="mt-1 break-words font-serif text-2xl font-bold leading-snug text-brand-900 sm:text-3xl">
                  {service.sermon_title || 'Not specified'}
                </h3>
              </div>

              {/* Service information */}
              <div className="mt-6">
                <SectionTitle>Service information</SectionTitle>

                <dl className="mt-3 flex flex-wrap gap-x-12 gap-y-2 px-1 text-sm">
                  <div className="flex gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Date
                    </dt>
                    <dd className="font-medium">
                      {formatLongDate(service.service_date)}
                    </dd>
                  </div>

                  <div className="flex gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Preacher
                    </dt>
                    <dd className="break-words font-medium">
                      {service.preacher_name || 'Not specified'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Key points */}
              {include.keyPoints && (
                <div className="mt-6">
                  <SectionTitle meta={service.scripture_reference || undefined}>
                    Sermon key points
                  </SectionTitle>

                  {hasText(service.sermon_key_points) ? (
                    <div
                      className={`mt-3 break-words px-1 text-sm text-slate-700 ${richTextClass}`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(service.sermon_key_points),
                      }}
                    />
                  ) : (
                    <p className="mt-3 px-1 text-sm text-slate-700">
                      No key points recorded.
                    </p>
                  )}
                </div>
              )}

              {/* Summary cards */}
              {include.summary && (
                <div className="mt-6">
                  <SectionTitle meta={`Total: ${attendees.length} persons`}>
                    Attendance summary
                  </SectionTitle>

                  {reportLoading ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Loading attendance...
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 print:grid-cols-5">
                      {stats.map((stat) => (
                        <div
                          key={stat.label}
                          className={`break-inside-avoid rounded-lg border px-3 py-2.5 ${stat.box} ${PRINT_EXACT}`}
                        >
                          <p
                            className={`text-[10px] font-bold uppercase tracking-wider ${stat.label_}`}
                          >
                            {stat.label}
                          </p>
                          <p className="mt-0.5 text-2xl font-bold text-slate-900">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Attendance lists */}
              {showList && !reportLoading && (
                <>
                  {include.members && (
                    <div className="mt-6">
                      <SectionTitle meta={`Members (${memberRows.length})`}>
                        Attendance list
                      </SectionTitle>

                      <AttendanceTable
                        rows={memberRows}
                        kind="regular members"
                        nameLabel="Name"
                        modeLabel="Attendance type"
                        emptyText="No members recorded for this service."
                        expanded={expandedMembers}
                        onExpand={() => setExpandedMembers(true)}
                      />
                    </div>
                  )}

                  {include.visitors && (
                    <div className="mt-6">
                      <SectionTitle
                        tone="amber"
                        meta={`Visitors (${visitorRows.length})`}
                      >
                        Visitors &amp; guests
                      </SectionTitle>

                      <AttendanceTable
                        rows={visitorRows}
                        kind="visitors"
                        nameLabel="Visitor name"
                        modeLabel="Mode"
                        emptyText="No visitors recorded for this service."
                        expanded={expandedVisitors}
                        onExpand={() => setExpandedVisitors(true)}
                      />
                    </div>
                  )}
                </>
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
          </div>
        </>
      )}
    </section>
  )
}