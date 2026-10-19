
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer } from 'lucide-react'
import html2pdf from 'html2pdf.js'

import { getMembers } from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { getAttendanceForService } from '../lib/attendanceService'

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
              className="border-b border-slate-100"
              style={{ breakInside: 'avoid' }}
            >
              <td className="py-1.5 text-slate-500">{index + 1}</td>
              <td className="py-1.5 text-slate-900">{row.name}</td>
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

// Remove Tailwind classes from the PDF copy and apply safe inline styles.
function preparePDFCopy(original) {
  const clone = original.cloneNode(true)
  const nodes = [clone, ...clone.querySelectorAll('*')]

  nodes.forEach((node) => {
    // Prevent Tailwind CSS v4 color functions from affecting the PDF.
    node.removeAttribute('class')
    node.removeAttribute('id')

    node.style.setProperty('box-shadow', 'none', 'important')
    node.style.setProperty('text-shadow', 'none', 'important')
    node.style.setProperty('background-image', 'none', 'important')
    node.style.setProperty('font-family', 'Arial, sans-serif', 'important')
    node.style.setProperty('box-sizing', 'border-box', 'important')

    if (node.tagName === 'ARTICLE') {
      Object.assign(node.style, {
        width: '760px',
        maxWidth: 'none',
        margin: '0',
        padding: '32px',
        border: '1px solid #e2e8f0',
        borderRadius: '0',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontSize: '14px',
        lineHeight: '1.5',
      })
    }

    if (node.tagName === 'HEADER') {
      Object.assign(node.style, {
        borderBottom: '1px solid #cbd5e1',
        paddingBottom: '20px',
      })
    }

    if (node.tagName === 'H2') {
      Object.assign(node.style, {
        color: '#142D4E',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0',
      })
    }

    if (node.tagName === 'H3') {
      Object.assign(node.style, {
        color: '#142D4E',
        fontSize: '16px',
        fontWeight: '700',
        margin: '0 0 8px 0',
      })
    }

    if (node.tagName === 'H4') {
      Object.assign(node.style, {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '700',
        margin: '16px 0 8px 0',
      })
    }

    if (node.tagName === 'P') {
      Object.assign(node.style, {
        color: '#334155',
        margin: '8px 0',
        whiteSpace: 'pre-wrap',
      })
    }

    if (node.tagName === 'DL') {
      Object.assign(node.style, {
        display: 'grid',
        gridTemplateColumns: '128px 1fr',
        rowGap: '4px',
        margin: '8px 0 0 0',
      })
    }

    if (node.tagName === 'DT') {
      node.style.color = '#64748b'
    }

    if (node.tagName === 'DD') {
      node.style.color = '#111827'
      node.style.margin = '0'
    }

    if (node.tagName === 'TABLE') {
      Object.assign(node.style, {
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '13px',
        marginTop: '8px',
      })
    }

    if (node.tagName === 'TH') {
      Object.assign(node.style, {
        color: '#475569',
        fontWeight: '600',
        padding: '8px 4px',
        borderBottom: '1px solid #cbd5e1',
      })
    }

    if (node.tagName === 'TD') {
      Object.assign(node.style, {
        color: '#334155',
        padding: '6px 4px',
        borderBottom: '1px solid #e2e8f0',
      })
    }

    if (node.tagName === 'FOOTER') {
      Object.assign(node.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '24px',
        marginTop: '40px',
        paddingTop: '16px',
        borderTop: '1px solid #cbd5e1',
        color: '#64748b',
        fontSize: '11px',
        breakInside: 'avoid',
      })
    }

    if (node.tagName === 'SPAN') {
      node.style.color = '#64748b'
    }

    if (node.tagName === 'DIV') {
      node.style.backgroundColor = 'transparent'
    }
  })

  return clone
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

  // Download a PDF from a sanitized copy of the report.
  async function handleDownloadPDF() {
    const element = printAreaRef.current

    if (!element || !service || reportLoading || downloading) return

    setError('')
    setDownloading(true)

    let temporaryContainer

    try {
      const clone = preparePDFCopy(element)

      temporaryContainer = document.createElement('div')
      Object.assign(temporaryContainer.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: '780px',
        padding: '0',
        margin: '0',
        backgroundColor: '#ffffff',
        color: '#111827',
        zIndex: '-1',
      })

      temporaryContainer.appendChild(clone)
      document.body.appendChild(temporaryContainer)

      await html2pdf()
        .set({
          margin: 10,
          filename: `Sunday-Report-${fileDate(service.service_date)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', 'footer'],
          },
        })
        .from(clone)
        .save()
    } catch (err) {
      console.error('Could not generate PDF:', err)
      setError(
        'Could not generate the PDF. Please try again or check the browser console.'
      )
    } finally {
      if (temporaryContainer?.parentNode) {
        temporaryContainer.parentNode.removeChild(temporaryContainer)
      }

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
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Print Report
          </h1>
          <p className="mt-1 text-slate-500">
            Preview, download or print a Sunday service report.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
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
              className="w-72 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600 disabled:opacity-60"
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

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!service || busy || downloading}
            className="flex items-center gap-2 rounded-lg bg-[#142D4E] px-4 py-3 font-medium text-white hover:bg-[#1d416c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={18} />
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!service || busy || downloading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer size={18} />
            Print report
          </button>
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
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 print:hidden">
          No saved reports yet.{' '}
          <Link to="/sunday-report" className="font-medium text-blue-600">
            Create the first Sunday report
          </Link>
          .
        </p>
      ) : (
        <article
          ref={printAreaRef}
          id="print-area"
          className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-slate-900"
        >
          <header className="border-b border-slate-300 pb-5">
            <h2 className="text-2xl font-bold text-[#142D4E]">
              {CHURCH_NAME}
            </h2>
            <p className="mt-1 text-slate-600">Sunday Service Report</p>
          </header>

          <div className="mt-5">
            <h3 className="font-semibold">Service information</h3>

            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-slate-500">Date</dt>
              <dd>{formatLongDate(service.service_date)}</dd>

              <dt className="text-slate-500">Preacher</dt>
              <dd>{service.preacher_name || 'Not specified'}</dd>

              <dt className="text-slate-500">Sermon title</dt>
              <dd>{service.sermon_title || 'Not specified'}</dd>
            </dl>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold">Sermon key points</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
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
              <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
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

          <footer
            className="mt-10 flex items-end justify-between gap-6 border-t border-slate-300 pt-4 text-xs text-slate-500"
            style={{ breakInside: 'avoid' }}
          >
            <span>
              Generated on {formatShortDate(new Date().toISOString())}
            </span>

            <span className="w-56 border-b border-slate-400 pb-6 text-right">
              Secretary&apos;s signature
            </span>
          </footer>
        </article>
      )}
    </section>
  )
}
