import { useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'

import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
} from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { usePeriod } from '../lib/usePeriod'
import { servicesInRange, toInputDate } from '../lib/periods'
import { LEVELS, LEVELS_BY_ID, getLevelId } from '../lib/regularity'
import IconButton from '../components/IconButton'
import PeriodPicker from '../components/PeriodPicker'

const PAGE_SIZE = 25

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  person_type: 'member',
}

// First group of the "Show" list. The other values are regularity levels.
const CATEGORY_FILTERS = [
  { id: 'all', label: 'All people' },
  { id: 'member', label: 'All members' },
  { id: 'visitor', label: 'All visitors' },
]

const byName = (a, b) =>
  String(a.person.name ?? '').localeCompare(String(b.person.name ?? ''), undefined, {
    sensitivity: 'base',
  })

// 44 px tall fields; 16 px text on a phone so iOS does not zoom in on focus
const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-600 sm:text-sm'

const selectClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-600 sm:w-auto sm:text-sm'

export default function Members() {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // "Show" list: a category (all / members / visitors) or a regularity level
  const [filter, setFilter] = useState('all')

  // Attendance period
  const period = usePeriod()
  const { range } = period

  const [services, setServices] = useState([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [servicesError, setServicesError] = useState('')

  // PDF export
  const [exporting, setExporting] = useState(false)
  const [pdfError, setPdfError] = useState('')

  async function loadMembers() {
    setLoading(true)
    setError('')

    try {
      const data = await getMembers()
      setMembers(data)
    } catch (err) {
      console.error('Could not load members:', err)
      setError(
        err.message ||
          'Could not load people. Check your Appwrite configuration and permissions.'
      )
    } finally {
      setLoading(false)
    }
  }

  // First load (the page starts with loading = true)
  useEffect(() => {
    let cancelled = false

    getMembers()
      .then((data) => {
        if (!cancelled) setMembers(data)
      })
      .catch((err) => {
        console.error('Could not load members:', err)
        if (!cancelled) {
          setError(
            err.message ||
              'Could not load people. Check your Appwrite configuration and permissions.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Load the services once; the attendance is loaded per selected period.
  useEffect(() => {
    let cancelled = false

    async function loadServices() {
      try {
        const rows = await listServices()
        if (!cancelled) setServices(rows)
      } catch (err) {
        console.error('Could not load services:', err)
        if (!cancelled) {
          setServicesError(err.message || 'Could not load the services.')
        }
      } finally {
        if (!cancelled) setServicesLoaded(true)
      }
    }

    loadServices()

    return () => {
      cancelled = true
    }
  }, [])

  // Services held in the selected period, oldest first
  const periodServices = useMemo(
    () => (range.valid ? servicesInRange(services, range.start, range.end) : []),
    [services, range]
  )

  const {
    attendanceById,
    ready,
    error: attendanceError,
    retry,
  } = useServicesAttendance(periodServices)

  // 'ready' | 'loading' | 'unavailable' (invalid period or loading failed)
  const regularityStatus =
    !range.valid || servicesError || (attendanceError && !ready)
      ? 'unavailable'
      : servicesLoaded && ready
        ? 'ready'
        : 'loading'

  const regularityReady = regularityStatus === 'ready'
  const periodTotal = periodServices.length

  // memberId -> number of services attended in the period
  const attendedByMember = useMemo(() => {
    const counts = new Map()

    for (const service of periodServices) {
      for (const record of attendanceById[service.$id] ?? []) {
        counts.set(record.memberId, (counts.get(record.memberId) ?? 0) + 1)
      }
    }

    return counts
  }, [periodServices, attendanceById])

  // One row per person, with the regularity level (members only)
  const rows = useMemo(
    () =>
      members.map((person) => {
        const attended = attendedByMember.get(person.$id) ?? 0
        const isVisitor = person.person_type === 'visitor'

        return {
          person,
          attended,
          levelId:
            isVisitor || !regularityReady || periodTotal === 0
              ? null
              : getLevelId(attended, periodTotal),
        }
      }),
    [members, attendedByMember, regularityReady, periodTotal]
  )

  const levelSelected = LEVELS_BY_ID[filter] ? filter : null

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter(({ person, levelId }) => {
      const isVisitor = person.person_type === 'visitor'

      if (filter === 'member' && isVisitor) return false
      if (filter === 'visitor' && !isVisitor) return false
      if (levelSelected && levelId !== levelSelected) return false

      return [
        person.name,
        person.email,
        person.phone,
        person.person_type,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(term)
      )
    })
  }, [rows, search, filter, levelSelected])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  )

  // Stay on a valid page (e.g. after deleting the last person of a page)
  const currentPage = Math.min(page, totalPages)

  const visibleRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // The Regularity column makes no sense when only visitors are shown
  const showRegularity = filter !== 'visitor'
  const columnCount = showRegularity ? 8 : 7

  let emptyMessage = 'No people to display yet. Click "+ Add person" to begin.'

  if (levelSelected && regularityStatus === 'loading') {
    emptyMessage = 'Loading regularity...'
  } else if (levelSelected && regularityStatus === 'unavailable') {
    emptyMessage = 'Regularity is not available for the selected period.'
  } else if (levelSelected && periodTotal === 0) {
    emptyMessage =
      'No services were recorded in this period, so there are no regularity levels.'
  } else if (search || filter !== 'all') {
    emptyMessage = 'No matching people found.'
  }

  // ---------- PDF ----------

  const pdfKind =
    filter === 'visitor'
      ? 'Visitors'
      : filter === 'member' || levelSelected
        ? 'Members'
        : 'Members & Visitors'

  const pdfWithAttendance = regularityReady && periodTotal > 0

  const pdfFilterSummary = [
    `Category: ${pdfKind === 'Members & Visitors' ? 'Members and visitors' : pdfKind}`,
    levelSelected
      ? `Regularity: ${LEVELS_BY_ID[levelSelected].label} (${LEVELS_BY_ID[levelSelected].rule})`
      : null,
    search.trim() ? `Search: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(' - ')

  const canDownload =
    !loading &&
    !exporting &&
    filteredRows.length > 0 &&
    regularityStatus !== 'loading'

  // The PDF holds every filtered row (not only the page of 25), as real text.
  async function handleDownloadPDF() {
    if (!canDownload) return

    setPdfError('')
    setExporting(true)

    try {
      // jsPDF is only downloaded when a PDF is requested
      const { downloadMembersPdf } = await import('../lib/pdf/downloads')

      await downloadMembersPdf(
        {
          title: pdfKind,
          filterSummary: pdfFilterSummary,
          periodLabel: pdfWithAttendance ? range.label : '',
          rows: [...filteredRows].sort(byName),
          periodTotal,
          showAttendance: pdfWithAttendance,
          showRegularity: pdfWithAttendance && filter !== 'visitor',
        },
        `${pdfKind.replace(/ & /g, '-and-').replace(/ /g, '-')}-${toInputDate(new Date())}.pdf`
      )
    } catch (err) {
      console.error('Could not generate PDF:', err)
      setPdfError(
        'Could not generate the PDF. Please try again or check the browser console.'
      )
    } finally {
      setExporting(false)
    }
  }

  // ---------- Form ----------

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function openEditForm(person) {
    setEditingId(person.$id)
    setForm({
      name: person.name ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      person_type: person.person_type ?? 'member',
    })
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.name.trim()) {
      setError('Please enter a name.')
      return
    }

    setSaving(true)

    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        person_type: form.person_type,
      }

      if (editingId) {
        await updateMember(editingId, data)
        setNotice('Person updated successfully.')
      } else {
        await createMember(data)
        setNotice('Person added successfully.')
      }

      closeForm()
      await loadMembers()
    } catch (err) {
      console.error('Could not save person:', err)
      setError(
        err.message ||
          'Could not save this person. Check your table columns and permissions.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(person) {
    const confirmed = window.confirm(
      `Delete ${person.name}? This action may affect records linked to this person.`
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await deleteMember(person.$id)
      setNotice(`${person.name} was deleted.`)
      await loadMembers()
    } catch (err) {
      console.error('Could not delete person:', err)
      setError(
        err.message ||
          'Could not delete this person. Check linked records and permissions.'
      )
    }
  }

  function handleSearch(event) {
    setSearch(event.target.value)
    setPage(1)
  }

  function handleFilterChange(event) {
    setFilter(event.target.value)
    setPage(1)
  }

  // ---------- Pieces shared by the cards (small screens) and the table ----------

  function attendanceText(attended) {
    if (regularityStatus === 'unavailable') return '—'
    if (regularityStatus === 'loading') return '…'
    if (periodTotal === 0) return '—'
    return `${attended} / ${periodTotal}`
  }

  function regularityCell(level, attended) {
    if (regularityStatus === 'loading') {
      return <span className="text-slate-500">…</span>
    }

    if (!level) return <span className="text-slate-500">—</span>

    return (
      <>
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${level.badge}`}
        >
          {level.label}
        </span>
        <span className="ml-2 text-xs text-slate-500">
          {Math.round((attended / periodTotal) * 100)}%
        </span>
      </>
    )
  }

  function personActions(person) {
    return (
      <div className="flex items-center gap-1">
        <IconButton
          label={`Edit ${person.name}`}
          tooltip="Edit"
          onClick={() => openEditForm(person)}
        >
          <Pencil size={18} />
        </IconButton>
        <IconButton
          label={`Delete ${person.name}`}
          tooltip="Delete"
          tone="red"
          onClick={() => handleDelete(person)}
        >
          <Trash2 size={18} />
        </IconButton>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-900">
            Members & Visitors
          </h1>
          <p className="mt-1 text-slate-500">
            Manage people in your church community and follow their attendance.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="min-h-11 w-full shrink-0 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 sm:w-auto"
        >
          + Add person
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {pdfError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {pdfError}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold text-brand-900">
            {editingId ? 'Edit person' : 'Add a person'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Full name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="Enter full name"
                className={fieldClass}
              />
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Category *
              <select
                name="person_type"
                value={form.person_type}
                onChange={handleChange}
                required
                className={fieldClass}
              >
                <option value="member">Member</option>
                <option value="visitor">Visitor</option>
              </select>
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={fieldClass}
                placeholder="name@example.com"
              />
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Phone
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                maxLength={30}
                className={fieldClass}
                placeholder="Phone number"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Fields marked with * are required.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save changes'
                  : 'Add person'}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {/* Toolbar: stacked on a phone, in a row from `sm` / `lg` */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search name, email or phone..."
            aria-label="Search name, email or phone"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-brand-600 sm:max-w-md sm:text-sm"
          />

          <span className="text-sm text-slate-500">
            {filteredRows.length} people
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
            <div className="w-full sm:w-auto">
              <label
                htmlFor="people-filter"
                className="mb-1 block text-xs text-slate-600"
              >
                Show
              </label>
              <select
                id="people-filter"
                value={filter}
                onChange={handleFilterChange}
                className={selectClass}
              >
                <optgroup label="Category">
                  {CATEGORY_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Regularity (members only)">
                  {LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <PeriodPicker
              period={period}
              variant="select"
              idPrefix="members-period"
              label="Attendance period"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!canDownload}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto lg:mt-5"
          >
            <Download size={18} />
            {exporting ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {(servicesError || attendanceError) && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span className="min-w-0 break-words">
              Regularity could not be loaded: {servicesError || attendanceError}
            </span>
            {!servicesError && (
              <button
                type="button"
                onClick={retry}
                className="min-h-11 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <p className="mt-3 break-words text-xs text-slate-500">
          {!range.valid
            ? 'Choose a valid period to see attendance and regularity.'
            : regularityReady && periodTotal === 0
              ? 'No services were recorded in this period.'
              : `Rate = services attended / ${
                  regularityReady ? periodTotal : 'the'
                } service(s) held in the period. ${LEVELS.map(
                  (level) => `${level.label}: ${level.rule}`
                ).join(' · ')}.`}
          {regularityReady && periodTotal > 0 && periodTotal < 4
            ? ' Only a few services: the levels are only indicative.'
            : ''}
        </p>

        {/* Small screens (< 768 px): one card per person */}
        <ul className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <li className="py-10 text-center text-sm text-slate-500">
              Loading people...
            </li>
          ) : visibleRows.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-500">
              {emptyMessage}
            </li>
          ) : (
            visibleRows.map(({ person, attended, levelId }) => {
              const level = levelId ? LEVELS_BY_ID[levelId] : null

              return (
                <li
                  key={person.$id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-brand-900">
                        {person.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700">
                          {person.person_type || 'member'}
                        </span>
                        <span className="text-xs text-slate-600">
                          {person.status || 'active'}
                        </span>
                      </div>
                    </div>

                    <div className="-mr-2 -mt-1 shrink-0">
                      {personActions(person)}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="min-w-0 break-words text-slate-700">
                      {person.email || '—'}
                    </dd>

                    <dt className="text-slate-500">Phone</dt>
                    <dd className="min-w-0 break-words text-slate-700">
                      {person.phone || '—'}
                    </dd>

                    <dt className="text-slate-500">Attendance</dt>
                    <dd className="text-slate-700">
                      {attendanceText(attended)}
                    </dd>

                    {showRegularity && (
                      <>
                        <dt className="text-slate-500">Regularity</dt>
                        <dd>{regularityCell(level, attended)}</dd>
                      </>
                    )}
                  </dl>
                </li>
              )
            })
          )}
        </ul>

        {/* From 768 px: table; it scrolls inside its own box and the Name
            column stays in place */}
        <div
          className="mt-4 hidden overflow-x-auto md:block"
          tabIndex={0}
          role="region"
          aria-label="People table"
        >
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-4 shadow-[1px_0_0_#e2e8f0]">
                  Name
                </th>
                <th className="px-3 py-4">Email</th>
                <th className="px-3 py-4">Phone</th>
                <th className="px-3 py-4">Category</th>
                <th className="px-3 py-4">Status</th>
                <th className="px-3 py-4">Attendance</th>
                {showRegularity && <th className="px-3 py-4">Regularity</th>}
                <th className="px-3 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Loading people...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ person, attended, levelId }) => {
                  const level = levelId ? LEVELS_BY_ID[levelId] : null

                  return (
                    <tr key={person.$id} className="group hover:bg-slate-50">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-4 font-medium text-brand-900 shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50">
                        {person.name}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {person.email || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {person.phone || '—'}
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700">
                          {person.person_type || 'member'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="text-xs text-slate-600">
                          {person.status || 'active'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {attendanceText(attended)}
                      </td>
                      {showRegularity && (
                        <td className="whitespace-nowrap px-3 py-4">
                          {regularityCell(level, attended)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2">
                        {personActions(person)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 text-sm text-slate-500">
            Page {currentPage} of {totalPages}
            {filteredRows.length > 0 &&
              ` · Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                currentPage * PAGE_SIZE,
                filteredRows.length
              )} of ${filteredRows.length}`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
